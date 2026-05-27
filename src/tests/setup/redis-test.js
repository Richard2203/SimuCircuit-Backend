/**
 * Helper compartido por tests de integración y e2e: abre una conexión a
 * Redis local (Docker), expone helpers para limpiar entre tests, y
 * verifica disponibilidad antes de correr.
 *
 * Si Redis NO está corriendo, los suites de integración/e2e se saltan
 * automáticamente (con un `describe.skip` y un warning), en vez de fallar
 * en cascada. Así CI no se rompe si alguien olvidó levantar el contenedor.
 */

'use strict';

const Redis = require('ioredis');

const HOST = process.env.REDIS_TEST_HOST || '127.0.0.1';
const PORT = parseInt(process.env.REDIS_TEST_PORT || '6379', 10);

/**
 * Verifica si Redis está accesible en el host/puerto configurado.
 * Devuelve true/false sin tirar. Se cierra la conexión antes de retornar.
 */
async function redisDisponible() {
  const probe = new Redis({
    host: HOST,
    port: PORT,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    retryStrategy: () => null, // no reintentar en el probe
  });

  try {
    await probe.connect();
    const pong = await probe.ping();
    await probe.quit();
    return pong === 'PONG';
  } catch (err) {
    try { probe.disconnect(); } catch (_) {}
    return false;
  }
}

/**
 * Construye un cliente ioredis "fresco" para los tests. Cada suite debería
 * crear el suyo y cerrarlo en afterAll.
 */
function nuevoCliente() {
  return new Redis({
    host: HOST,
    port: PORT,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
}

/**
 * Borra TODO el contenido de la base 0 (FLUSHDB). Solo úsalo en tests —
 * en producción esto borra absolutamente todo lo que vive en Redis.
 *
 * Recibe un cliente para no abrir/cerrar uno cada vez (eso lentifica
 * mucho los tests).
 */
async function limpiarTodo(cliente) {
  await cliente.flushdb();
}

module.exports = {
  redisDisponible,
  nuevoCliente,
  limpiarTodo,
  HOST,
  PORT,
};
