/**
 * Pruebas END-TO-END del flujo de caché — HTTP real con supertest.
 *
 * Por qué importa:
 *   Los unit tests verifican lógica, los de integración verifican Redis,
 *   pero solo el E2E demuestra que TODO el camino completo funciona:
 *   POST llega → Express enruta → controller envuelto → cacheManager →
 *   Redis → respuesta con header X-Cache correcto.
 *
 * Diferencia vs integration:
 *   Aquí montamos un mini-Express con la MISMA estructura de rutas que
 *   usa el backend real (controllers envueltos vía cacheManager), pero
 *   reemplazamos el handler interno por uno fake que devuelve algo
 *   determinístico. Esto evita depender de MySQL o del motor de cálculo
 *   completo (que tiene sus propios tests), y nos enfoca SOLO en el
 *   comportamiento del caché desde la perspectiva HTTP.
 *
 * Requisitos:
 *   - Redis corriendo en localhost:6379 (Docker).
 *   - supertest instalado: npm install --save-dev supertest
 *
 * Cubre:
 *   - POST 1 a /api/simular/dc → X-Cache: MISS
 *   - POST 2 idéntico al anterior → X-Cache: HIT, mismo body
 *   - POST 3 con un valor diferente → X-Cache: MISS otra vez
 *   - Llave del caché es realmente accesible desde Redis
 *   - Headers HTTP están bien formados (X-Cache-Key presente)
 *   - Stress: 50 simulaciones con payloads distintos → todas MISS,
 *     50 repeticiones idénticas → todas HIT
 */

'use strict';

const express = require('express');
const request = require('supertest');
const { redisDisponible, nuevoCliente, limpiarTodo, HOST, PORT } = require('./setup/redis-test');

// Configurar Redis antes de cargar el cacheManager.
process.env.REDIS_HOST = HOST;
process.env.REDIS_PORT = String(PORT);
delete process.env.REDIS_PASSWORD;

let app, clienteDirecto, disponible = false;

beforeAll(async () => {
  disponible = await redisDisponible();
  if (!disponible) {
    console.warn(
      `\n⚠ Redis no disponible en ${HOST}:${PORT}. Tests E2E SALTADOS.\n` +
      `  Levanta: docker run -d --name redis-simu -p 6379:6379 redis:7-alpine\n`
    );
    return;
  }
  clienteDirecto = nuevoCliente();

  // Cargar cacheManager con Redis configurado
  const { conCache } = require('../utils/cacheManager');

  // ─── Mini-app de Express con la misma forma que el backend real ──────
  // No usamos app.js porque importa config/db que se conecta a MySQL.
  app = express();
  app.use(express.json());

  // Handler fake: hace algo determinístico y rápido, sin tocar nada del
  // motor de simulación. Devuelve el ID del circuito + un timestamp para
  // poder distinguir HIT (mismo timestamp) de MISS (timestamp nuevo).
  let llamadas = 0;
  const fakeController = (req, res) => {
    llamadas++;
    res.json({
      exito: true,
      idCircuito: req.body.id,
      llamadaNumero: llamadas,
      timestamp: Date.now(),
      netlist_resumen: req.body.netlist?.length || 0,
    });
  };

  // Las rutas usan los wrappers reales — esto es lo que se está probando
  app.post('/api/simular/dc', conCache('dc', fakeController));
  app.post('/api/simular/ac', conCache('ac', fakeController));
  app.post('/api/teoremas/thevenin-norton', conCache('thevenin', fakeController));

  app.locals.contadorLlamadas = () => llamadas;

  await new Promise(r => setTimeout(r, 300)); // dejar conectar Redis
  await limpiarTodo(clienteDirecto);
});

afterAll(async () => {
  if (!disponible) return;
  await limpiarTodo(clienteDirecto);
  await clienteDirecto.quit();
  const redisModule = require('../config/redis');
  if (redisModule.cliente) await redisModule.cliente.quit();
});

beforeEach(async () => {
  if (!disponible) return;
  await limpiarTodo(clienteDirecto);
});

const describeIf = (cond) => (cond ? describe : describe.skip);

describeIf(true)('E2E /api/simular — caché end-to-end', () => {
  // Payload representativo de un circuito real (no se valida la electrónica,
  // solo se cachea el resultado).
  const payloadBase = {
    id: 999,
    nombre_circuito: 'test_e2e',
    netlist: [
      { id: 'V1', type: 'fuente_voltaje', value: '10', nodes: { pos: '1', neg: '0' } },
      { id: 'R1', type: 'resistencia',    value: '1k', nodes: { n1: '1', n2: '0' } },
    ],
  };

  it('flujo clásico: MISS → HIT → diff → MISS', async () => {
    if (!disponible) return;

    // 1ra: MISS, calcula
    const r1 = await request(app).post('/api/simular/dc').send(payloadBase);
    expect(r1.status).toBe(200);
    expect(r1.headers['x-cache']).toBe('MISS');
    expect(r1.headers['x-cache-key']).toMatch(/^sim:dc:[a-f0-9]{32}$/);
    const ts1 = r1.body.timestamp;
    const llamada1 = r1.body.llamadaNumero;

    await new Promise(r => setTimeout(r, 50)); // SET asíncrono

    // 2da: HIT, idéntica
    const r2 = await request(app).post('/api/simular/dc').send(payloadBase);
    expect(r2.status).toBe(200);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body.timestamp).toBe(ts1);           // mismo timestamp = mismo resultado servido
    expect(r2.body.llamadaNumero).toBe(llamada1);  // handler NO corrió de nuevo

    // 3ra: payload distinto (cambia un valor) → MISS otra vez
    const payloadModif = {
      ...payloadBase,
      netlist: [
        ...payloadBase.netlist.slice(0, 1),
        { ...payloadBase.netlist[1], value: '1.1k' }, // ← ligero cambio
      ],
    };
    const r3 = await request(app).post('/api/simular/dc').send(payloadModif);
    expect(r3.status).toBe(200);
    expect(r3.headers['x-cache']).toBe('MISS');
    expect(r3.headers['x-cache-key']).not.toBe(r1.headers['x-cache-key']); // ← clave: llave distinta
    expect(r3.body.timestamp).not.toBe(ts1); // resultado nuevo

    await new Promise(r => setTimeout(r, 50));

    // 4ta: igual a la 3ra → HIT
    const r4 = await request(app).post('/api/simular/dc').send(payloadModif);
    expect(r4.headers['x-cache']).toBe('HIT');
    expect(r4.body.timestamp).toBe(r3.body.timestamp);
  });

  it('tipos distintos NO comparten caché: /dc vs /ac con mismo body', async () => {
    if (!disponible) return;

    const r1 = await request(app).post('/api/simular/dc').send(payloadBase);
    expect(r1.headers['x-cache']).toBe('MISS');

    await new Promise(r => setTimeout(r, 50));

    const r2 = await request(app).post('/api/simular/ac').send(payloadBase);
    expect(r2.headers['x-cache']).toBe('MISS'); // ← debería ser MISS, no HIT
    expect(r2.headers['x-cache-key']).toMatch(/^sim:ac:/);
    expect(r2.headers['x-cache-key']).not.toBe(r1.headers['x-cache-key']);
  });

  it('teoremas: thevenin también está cacheado y funciona igual', async () => {
    if (!disponible) return;

    const payload = { circuitoId: 5, nodoA: '1', nodoB: '0' };
    const r1 = await request(app).post('/api/teoremas/thevenin-norton').send(payload);
    expect(r1.headers['x-cache']).toBe('MISS');

    await new Promise(r => setTimeout(r, 50));

    const r2 = await request(app).post('/api/teoremas/thevenin-norton').send(payload);
    expect(r2.headers['x-cache']).toBe('HIT');
    expect(r2.body.timestamp).toBe(r1.body.timestamp);
  });

  it('stress: 50 payloads distintos generan 50 llaves únicas, sin colisiones', async () => {
    if (!disponible) return;

    const llamadasAntes = app.locals.contadorLlamadas();

    // Fase 1: 50 payloads únicos
    const llaves = new Set();
    const timestamps = new Map();
    for (let i = 0; i < 50; i++) {
      const payload = { id: 10000 + i, valor: i * 100 };
      const r = await request(app).post('/api/simular/dc').send(payload);
      expect(r.status).toBe(200);
      expect(r.headers['x-cache']).toBe('MISS');
      llaves.add(r.headers['x-cache-key']);
      timestamps.set(i, r.body.timestamp);
    }
    expect(llaves.size).toBe(50); // ← TODAS las llaves son únicas, cero colisiones

    await new Promise(r => setTimeout(r, 100));

    const llamadasIntermedio = app.locals.contadorLlamadas();
    expect(llamadasIntermedio - llamadasAntes).toBe(50); // handler corrió 50 veces

    // Fase 2: las mismas 50 → todas HIT, mismo timestamp original
    for (let i = 0; i < 50; i++) {
      const payload = { id: 10000 + i, valor: i * 100 };
      const r = await request(app).post('/api/simular/dc').send(payload);
      expect(r.headers['x-cache']).toBe('HIT');
      expect(r.body.timestamp).toBe(timestamps.get(i)); // ← cada llave devuelve SU resultado, no el de otra
    }

    const llamadasFinal = app.locals.contadorLlamadas();
    expect(llamadasFinal).toBe(llamadasIntermedio); // ← handler NO corrió ni una vez más
  });

  it('integridad: la llave en X-Cache-Key existe en Redis y contiene el body', async () => {
    if (!disponible) return;

    const r = await request(app).post('/api/simular/dc').send(payloadBase);
    await new Promise(rs => setTimeout(rs, 50));

    const llave = r.headers['x-cache-key'];
    const raw = await clienteDirecto.get(llave);
    expect(raw).not.toBeNull();
    const parseado = JSON.parse(raw);
    expect(parseado).toEqual(r.body);

    // Y verificar TTL aproximado
    const ttl = await clienteDirecto.ttl(llave);
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);
  });
});
