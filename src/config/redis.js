const Redis = require('ioredis');

const HOST = process.env.REDIS_HOST;
const PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const PASSWORD = process.env.REDIS_PASSWORD || undefined;

let cliente = null;
let disponible = false;
let yaLogueoReconexion = false;

if (HOST) {
    cliente = new Redis({
        host: HOST,
        port: PORT,
        password: PASSWORD,
        retryStrategy: (intentos) => Math.min(intentos * 200, 2000),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        keepAlive: 30000,
        enableReadyCheck: true,
    });

    cliente.on('ready', () => {
        disponible = true;
        yaLogueoReconexion = false; // reset por si se vuelve a caer despues
        console.log(`[Redis] Conectado y listo en ${HOST}:${PORT}`);
    });

    cliente.on('error', (err) => {
        if (disponible) {
            console.warn(`[Redis] Error de conexión: ${err.message}`);
        }
        disponible = false;
    });

    cliente.on('end', () => {
        disponible = false;
    });

    cliente.on('reconnecting', () => {
        if (!yaLogueoReconexion) {
            console.log(`[Redis] Sin conexión, reintentando en background (la app sigue funcionando normal)...`);
            yaLogueoReconexion = true;
        }
    });
} else {
    console.warn(
        '[Redis] REDIS_HOST no está definido. El caché de simulaciones queda DESHABILITADO ' +
        '(la app sigue funcionando normal, solo se recalcula cada simulación).'
    );
}

/**
 * Devuelve true solo si el cliente existe y esta conectado y listo para
 * recibir comandos. Es la guarda que usa cacheManager para decidir si
 * intenta tocar Redis o hace BYPASS directo.
 */
function estaDisponible() {
    return Boolean(cliente) && disponible;
}

/**
 * Espera hasta ms milisegundos a que el cliente quede listo.
 *   - True si esta listo o conectado dentro del plazo
 *   - Falso si no hay cliente o se agota el plazo
 *
 * @param {number} ms
 * @returns {Promise<boolean>}
 */
function esperarListo(ms = 5000) {
    if (!cliente) return Promise.resolve(false);
    if (disponible) return Promise.resolve(true);

    return new Promise((resolve) => {
        let resuelto = false;

        const finalizar = (valor) => {
            if (resuelto) return;
            resuelto = true;
            clearTimeout(temporizador);
            cliente.removeListener('ready', onReady);
            resolve(valor);
        };

        const onReady = () => finalizar(true);
        const temporizador = setTimeout(() => finalizar(false), ms);
        // No mantener vivo el event loop solo por esta espera.
        if (typeof temporizador.unref === 'function') temporizador.unref();

        cliente.once('ready', onReady);
    });
}

module.exports = {
    cliente,
    estaDisponible,
    esperarListo,
};