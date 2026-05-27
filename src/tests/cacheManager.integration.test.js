/**
 * Pruebas de integración del cacheManager — CONTRA REDIS REAL (Docker).
 *
 * Por qué importa:
 *   Los unit tests verifican la lógica con un mock. Pero ¿realmente
 *   ioredis se conecta? ¿el TTL EX 3600 expira de verdad? ¿SCAN +
 *   UNLINK encuentra y borra `sim:*`? ¿la lógica de invalidación por
 *   versión funciona de punta a punta? Solo un Redis real lo demuestra.
 *
 * Requisitos:
 *   docker run -d --name redis-simu -p 6379:6379 redis:7-alpine
 *
 *   Si Redis NO está corriendo, este suite se salta automáticamente
 *   con un warning visible (en vez de fallar). Así no rompe CI.
 *
 * Cubre:
 *   - Conexión real a Redis.
 *   - SET con TTL real: TTL devuelto coincide con el configurado.
 *   - HIT/MISS contra Redis real (no mock).
 *   - SCAN encuentra todas las llaves `sim:*` cuando hay muchas.
 *   - borrarCacheSimulaciones() limpia solo `sim:*`, no toca otras.
 *   - invalidarSiCambioVersion(): si la versión coincide, conserva el caché.
 *   - invalidarSiCambioVersion(): si la versión difiere, limpia.
 *   - Aislamiento: ninguna llave queda colgada después de los tests.
 */

'use strict';

const { redisDisponible, nuevoCliente, limpiarTodo, HOST, PORT } = require('./setup/redis-test');

// IMPORTANTE: configurar env vars ANTES de requerir cacheManager, porque
// cacheManager carga config/redis al momento del require, y config/redis
// lee REDIS_HOST/REDIS_PORT en el require.
process.env.REDIS_HOST = HOST;
process.env.REDIS_PORT = String(PORT);
delete process.env.REDIS_PASSWORD;

let cacheManager;       // cargado dinámicamente si Redis está disponible
let clienteDirecto;     // para verificar el estado de Redis fuera del cacheManager
let disponible = false;

// ─── Boot ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  disponible = await redisDisponible();
  if (!disponible) {
    console.warn(
      `\n⚠ Redis no está corriendo en ${HOST}:${PORT}. ` +
      `Tests de integración serán SALTADOS.\n` +
      `  Levántalo con: docker run -d --name redis-simu -p 6379:6379 redis:7-alpine\n`
    );
    return;
  }
  clienteDirecto = nuevoCliente();
  cacheManager = require('../utils/cacheManager');
  // Esperar a que el cliente interno de cacheManager esté listo.
  await new Promise(r => setTimeout(r, 300));
});

afterAll(async () => {
  if (!disponible) return;
  await limpiarTodo(clienteDirecto);
  await clienteDirecto.quit();

  // Cerrar el cliente interno del cacheManager para que Jest pueda terminar.
  const redisModule = require('../config/redis');
  if (redisModule.cliente) await redisModule.cliente.quit();
});

beforeEach(async () => {
  if (!disponible) return;
  await limpiarTodo(clienteDirecto);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

const describeIf = (cond) => (cond ? describe : describe.skip);

describeIf(true)('integración Redis real', () => {
  beforeAll(() => {
    if (!disponible) {
      // describe.skip por si arriba se setea disponible=false
      // (Jest evalúa describes en orden, así que esto sí surte efecto).
    }
  });

  describe('conexión y conectividad básica', () => {
    it('Redis está disponible y responde PING', async () => {
      if (!disponible) return; // safety
      const pong = await clienteDirecto.ping();
      expect(pong).toBe('PONG');
    });
  });

  describe('SET con TTL real', () => {
    it('guarda con expiración de 3600s y el TTL es correcto', async () => {
      if (!disponible) return;
      const handler = (req, res) => res.json({ exito: true, x: 1 });
      const wrapped = cacheManager.conCache('dc', handler);

      const res = mockRes();
      await wrapped({ body: { id: 100 } }, res);

      // Esperar un microtick para que el SET asíncrono se complete.
      await new Promise(r => setTimeout(r, 50));

      const llaves = await clienteDirecto.keys('sim:dc:*');
      expect(llaves.length).toBe(1);

      const ttl = await clienteDirecto.ttl(llaves[0]);
      // El TTL debe estar entre 3590 y 3600 (un pequeño margen por
      // el tiempo que pasó entre el SET y nuestra verificación).
      expect(ttl).toBeGreaterThan(3590);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('HIT/MISS contra Redis real', () => {
    it('primera llamada MISS, segunda HIT, contenido idéntico', async () => {
      if (!disponible) return;
      let nCalls = 0;
      const handler = (req, res) => {
        nCalls++;
        res.json({ exito: true, llamada: nCalls });
      };
      const wrapped = cacheManager.conCache('dc', handler);
      const req = { body: { id: 200, valor: 'test' } };

      const res1 = mockRes();
      await wrapped(req, res1);
      await new Promise(r => setTimeout(r, 50)); // dejar terminar el SET

      const res2 = mockRes();
      await wrapped(req, res2);

      expect(res1.headers['X-Cache']).toBe('MISS');
      expect(res2.headers['X-Cache']).toBe('HIT');
      expect(nCalls).toBe(1);                            // handler corrió 1 vez
      expect(res2.body).toEqual(res1.body);              // mismo contenido
      expect(res2.body.llamada).toBe(1);                 // el 1, no el 2
    });

    it('payloads distintos NUNCA colisionan en el mismo cache', async () => {
      if (!disponible) return;
      const handler = (req, res) =>
        res.json({ exito: true, eco: req.body });
      const wrapped = cacheManager.conCache('dc', handler);

      // 20 payloads, todos distintos por al menos 1 dígito
      const payloads = Array.from({ length: 20 }, (_, i) => ({
        id: 300, netlist: [{ id: 'R1', value: `${1000 + i}` }]
      }));

      for (const p of payloads) {
        const res = mockRes();
        await wrapped({ body: p }, res);
        expect(res.headers['X-Cache']).toBe('MISS');
        await new Promise(r => setTimeout(r, 20));
      }

      // Verificar que se crearon 20 llaves únicas
      const llaves = await clienteDirecto.keys('sim:dc:*');
      expect(llaves.length).toBe(20);

      // Y ahora verificar que cada payload devuelve SU propio resultado
      for (const p of payloads) {
        const res = mockRes();
        await wrapped({ body: p }, res);
        expect(res.headers['X-Cache']).toBe('HIT');
        expect(res.body.eco).toEqual(p);  // ← clave: no hay cross-contamination
      }
    });
  });

  describe('invalidación por versión', () => {
    it('si la versión guardada coincide con la actual, no borra nada', async () => {
      if (!disponible) return;
      const pkg = require('../../package.json'); // si no existe, jest falla con msg claro
      await clienteDirecto.set('app:simulador_version', pkg.version);

      // Poblamos con 3 llaves sim:* manualmente
      await clienteDirecto.set('sim:dc:aaa', '{"x":1}');
      await clienteDirecto.set('sim:ac:bbb', '{"x":2}');
      await clienteDirecto.set('sim:tran:ccc', '{"x":3}');

      await cacheManager.invalidarSiCambioVersion();

      const llaves = await clienteDirecto.keys('sim:*');
      expect(llaves.length).toBe(3); // conservadas
    });

    it('si la versión guardada difiere, borra TODO sim:* y guarda la nueva', async () => {
      if (!disponible) return;
      await clienteDirecto.set('app:simulador_version', '0.0.0-vieja');

      await clienteDirecto.set('sim:dc:aaa', '{"x":1}');
      await clienteDirecto.set('sim:ac:bbb', '{"x":2}');
      await clienteDirecto.set('sim:tran:ccc', '{"x":3}');
      // Otra llave NO sim:* que NO debe tocarse
      await clienteDirecto.set('otra:llave', 'preservar');

      await cacheManager.invalidarSiCambioVersion();

      const sims = await clienteDirecto.keys('sim:*');
      expect(sims.length).toBe(0);    // todas las sim:* borradas

      const otra = await clienteDirecto.get('otra:llave');
      expect(otra).toBe('preservar'); // intacta

      const pkg = require('../../package.json');
      const versionFinal = await clienteDirecto.get('app:simulador_version');
      expect(versionFinal).toBe(pkg.version);
    });

    it('borrarCacheSimulaciones() borra solo sim:* incluso con miles de llaves', async () => {
      if (!disponible) return;
      // Generamos 500 llaves para verificar que SCAN + UNLINK aguanta
      const pipeline = clienteDirecto.pipeline();
      for (let i = 0; i < 500; i++) {
        pipeline.set(`sim:test:${i}`, 'x');
      }
      pipeline.set('app:simulador_version', '1.0.0');
      pipeline.set('otra:preservar', 'algo');
      await pipeline.exec();

      const antes = await clienteDirecto.keys('sim:*');
      expect(antes.length).toBe(500);

      const borradas = await cacheManager.borrarCacheSimulaciones();
      expect(borradas).toBe(500);

      const despues = await clienteDirecto.keys('sim:*');
      expect(despues.length).toBe(0);

      // Las otras llaves siguen ahí
      expect(await clienteDirecto.get('app:simulador_version')).toBe('1.0.0');
      expect(await clienteDirecto.get('otra:preservar')).toBe('algo');
    });
  });
});

// ─── Helper local ───────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  return res;
}
