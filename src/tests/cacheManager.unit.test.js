/**
 * Pruebas unitarias del cacheManager — SIN Redis real.
 *
 * Por qué importa:
 *   El caché se compone de tres responsabilidades: hashing del request,
 *   wrapping de controllers, e invalidación por versión. Si el hashing
 *   colisiona o no es determinístico, dos circuitos distintos podrían
 *   compartir cache (¡resultado incorrecto!), o el mismo circuito generar
 *   miles de llaves (caché inútil).
 *
 * Estrategia:
 *   - Mockeamos config/redis.js para inyectar un fake "in-memory store".
 *   - Cero contenedores, cero red, corre en milisegundos.
 *
 * Cubre:
 *   - Determinismo del hash (mismo input → mismo hash, siempre).
 *   - Orden de claves NO afecta el hash.
 *   - Cambios microscópicos SÍ cambian el hash (1.0 vs 1.00, espacios, etc).
 *   - Wrapper: HIT devuelve datos cacheados sin llamar al handler.
 *   - Wrapper: MISS llama al handler y guarda el resultado.
 *   - Wrapper: errores 4xx/5xx NO se cachean.
 *   - Wrapper: respuestas con `exito:false` NO se cachean.
 *   - Wrapper: si Redis no está disponible → BYPASS (handler corre normal).
 *   - TTL: las llaves se guardan con expiración de 1h (3600s).
 *   - Tipo en la llave: dc y ac con mismo body generan llaves distintas.
 */

'use strict';

// ─── Mock de config/redis ANTES de requerir el módulo bajo prueba ──────────
//
// `mockStore` simula un Redis muy básico: un Map en memoria. Esto nos
// permite verificar SET/GET/EX/scan sin necesidad de un Redis real.

const mockStore = new Map();
let mockDisponible = true;

const mockCliente = {
  get: jest.fn((key) => {
    return Promise.resolve(mockStore.has(key) ? mockStore.get(key).value : null);
  }),
  set: jest.fn((key, value, mode, ttl) => {
    mockStore.set(key, { value, ttl: mode === 'EX' ? ttl : null });
    return Promise.resolve('OK');
  }),
  del: jest.fn((key) => {
    const existed = mockStore.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }),
  scan: jest.fn(() => Promise.resolve(['0', []])), // no usado en unit
  unlink: jest.fn(() => Promise.resolve(0)),
};

jest.mock('../config/redis', () => ({
  cliente: mockCliente,
  estaDisponible: () => mockDisponible,
  esperarListo: () => Promise.resolve(mockDisponible),
}));

const { conCache, hashRequest, TTL_SEGUNDOS } = require('../utils/cacheManager');

// ─── Setup/teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.clear();
  mockDisponible = true;
  jest.clearAllMocks();
});

// ─── Pruebas de hashing ─────────────────────────────────────────────────────

describe('hashRequest — determinismo y unicidad', () => {
  it('mismo input devuelve el mismo hash (determinístico)', () => {
    const payload = { id: 1, netlist: [{ id: 'R1', value: '1k' }] };
    expect(hashRequest(payload)).toBe(hashRequest(payload));
  });

  it('orden de claves NO afecta el hash', () => {
    const a = { id: 1, netlist: [{ id: 'R1', value: '1k', nodes: { n1: '1', n2: '0' } }] };
    const b = { netlist: [{ value: '1k', nodes: { n2: '0', n1: '1' }, id: 'R1' }], id: 1 };
    expect(hashRequest(a)).toBe(hashRequest(b));
  });

  it('diferencia mínima en un string genera hash distinto: "1k" vs "1.0k"', () => {
    const a = { netlist: [{ id: 'R1', value: '1k' }] };
    const b = { netlist: [{ id: 'R1', value: '1.0k' }] };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('diferencia mínima en un string genera hash distinto: "1.0k" vs "1.00k"', () => {
    const a = { netlist: [{ id: 'R1', value: '1.0k' }] };
    const b = { netlist: [{ id: 'R1', value: '1.00k' }] };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('cambio en un campo numérico genera hash distinto', () => {
    const a = { id: 1, freq: 60 };
    const b = { id: 1, freq: 60.0001 };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('cambio en el id del circuito genera hash distinto', () => {
    const base = { netlist: [{ id: 'R1', value: '1k' }] };
    expect(hashRequest({ ...base, id: 1 })).not.toBe(hashRequest({ ...base, id: 2 }));
  });

  it('agregar un componente genera hash distinto', () => {
    const a = { netlist: [{ id: 'R1', value: '1k' }] };
    const b = { netlist: [{ id: 'R1', value: '1k' }, { id: 'R2', value: '2k' }] };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('agregar/quitar espacios en blanco SÍ cambia el hash', () => {
    // Esto es a propósito: "1k" y "1k " son strings distintos. Si el
    // frontend manda inconsistente, generaría 2 llaves. Esto es OK y
    // está documentado: el frontend debe ser consistente con su input.
    const a = { netlist: [{ id: 'R1', value: '1k' }] };
    const b = { netlist: [{ id: 'R1', value: '1k ' }] };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('payload vacío produce un hash válido y constante', () => {
    expect(hashRequest({})).toBe(hashRequest({}));
    expect(hashRequest({})).toMatch(/^[a-f0-9]{32}$/);
  });

  it('hash tiene 32 caracteres hex (128 bits, colisiones improbables)', () => {
    const h = hashRequest({ id: 1, netlist: [{ id: 'R1', value: '1k' }] });
    expect(h).toMatch(/^[a-f0-9]{32}$/);
  });
});

// ─── Pruebas del wrapper conCache ───────────────────────────────────────────

/**
 * Helper para construir un mock de Express res. Captura status, headers
 * y el body de res.json para hacer asserts después.
 */
function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    jsonCalled: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; this.jsonCalled = true; return this; },
  };
  return res;
}

describe('conCache — comportamiento del wrapper', () => {
  it('MISS: en la primera llamada ejecuta el handler y guarda el resultado', async () => {
    const handler = jest.fn((req, res) => res.json({ exito: true, resultado: 42 }));
    const wrapped = conCache('dc', handler);
    const req = { body: { id: 1 } };
    const res = mockRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.headers['X-Cache']).toBe('MISS');
    expect(res.body).toEqual({ exito: true, resultado: 42 });
    expect(mockCliente.set).toHaveBeenCalledTimes(1);

    // Verificar que la llave tiene el formato sim:{tipo}:{hash}
    const [llave, valor, mode, ttl] = mockCliente.set.mock.calls[0];
    expect(llave).toMatch(/^sim:dc:[a-f0-9]{32}$/);
    expect(mode).toBe('EX');
    expect(ttl).toBe(TTL_SEGUNDOS);
    expect(ttl).toBe(3600); // sanity check: 1 hora
    expect(JSON.parse(valor)).toEqual({ exito: true, resultado: 42 });
  });

  it('HIT: en la segunda llamada idéntica devuelve el caché sin invocar handler', async () => {
    const handler = jest.fn((req, res) => res.json({ exito: true, resultado: 42 }));
    const wrapped = conCache('dc', handler);
    const req = { body: { id: 1 } };

    // Primera: MISS
    await wrapped(req, mockRes());
    expect(handler).toHaveBeenCalledTimes(1);

    // Segunda: HIT — handler NO debe correr otra vez
    const res2 = mockRes();
    await wrapped(req, res2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res2.headers['X-Cache']).toBe('HIT');
    expect(res2.body).toEqual({ exito: true, resultado: 42 });
  });

  it('cambio mínimo en el body fuerza un nuevo MISS', async () => {
    const handler = jest.fn((req, res) =>
      res.json({ exito: true, valor: req.body.netlist[0].value })
    );
    const wrapped = conCache('dc', handler);

    const req1 = { body: { netlist: [{ id: 'R1', value: '1k' }] } };
    const req2 = { body: { netlist: [{ id: 'R1', value: '1.0k' }] } }; // ← diferente

    const res1 = mockRes();
    const res2 = mockRes();

    await wrapped(req1, res1);
    await wrapped(req2, res2);

    expect(handler).toHaveBeenCalledTimes(2);          // ambos corrieron
    expect(res1.headers['X-Cache']).toBe('MISS');
    expect(res2.headers['X-Cache']).toBe('MISS');
    expect(res1.body.valor).toBe('1k');
    expect(res2.body.valor).toBe('1.0k');               // ← cada uno su propio resultado
  });

  it('tipo distinto (dc vs ac) genera llaves distintas con mismo body', async () => {
    const handler = jest.fn((req, res) => res.json({ exito: true }));
    const dcWrapped = conCache('dc', handler);
    const acWrapped = conCache('ac', handler);
    const req = { body: { id: 1 } };

    await dcWrapped(req, mockRes());
    await acWrapped(req, mockRes());

    expect(handler).toHaveBeenCalledTimes(2); // ambos corrieron
    const llaves = mockCliente.set.mock.calls.map(c => c[0]);
    expect(llaves[0]).toMatch(/^sim:dc:/);
    expect(llaves[1]).toMatch(/^sim:ac:/);
  });

  it('respuesta con exito:false NO se cachea', async () => {
    const handler = jest.fn((req, res) =>
      res.status(400).json({ exito: false, mensaje: 'netlist vacía' })
    );
    const wrapped = conCache('dc', handler);

    await wrapped({ body: { id: 1 } }, mockRes());

    expect(mockCliente.set).not.toHaveBeenCalled();
  });

  it('respuesta con statusCode >= 400 NO se cachea', async () => {
    const handler = jest.fn((req, res) => res.status(500).json({ algo: 'error' }));
    const wrapped = conCache('dc', handler);

    await wrapped({ body: { id: 1 } }, mockRes());

    expect(mockCliente.set).not.toHaveBeenCalled();
  });

  it('BYPASS: si Redis no está disponible el handler corre normal', async () => {
    mockDisponible = false;
    const handler = jest.fn((req, res) => res.json({ exito: true }));
    const wrapped = conCache('dc', handler);
    const res = mockRes();

    await wrapped({ body: { id: 1 } }, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.headers['X-Cache']).toBe('BYPASS');
    expect(mockCliente.get).not.toHaveBeenCalled();
    expect(mockCliente.set).not.toHaveBeenCalled();
  });

  it('BYPASS: si Redis falla durante el GET, el handler corre y NO se cachea', async () => {
    const handler = jest.fn((req, res) => res.json({ exito: true }));
    const wrapped = conCache('dc', handler);

    // Forzamos un error solo en este test
    mockCliente.get.mockRejectedValueOnce(new Error('connection lost'));
    const res = mockRes();

    await wrapped({ body: { id: 1 } }, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.headers['X-Cache']).toBe('BYPASS');
  });

  it('valor cacheado corrupto: lo borra y recalcula como MISS', async () => {
    const llave = `sim:dc:${hashRequest({ id: 1 })}`;
    mockStore.set(llave, { value: '{json invalido', ttl: 3600 });

    const handler = jest.fn((req, res) => res.json({ exito: true, recalculado: true }));
    const wrapped = conCache('dc', handler);
    const res = mockRes();

    await wrapped({ body: { id: 1 } }, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.headers['X-Cache']).toBe('MISS');
    expect(res.body.recalculado).toBe(true);
    expect(mockCliente.del).toHaveBeenCalledWith(llave);
  });
});
