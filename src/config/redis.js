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
        yaLogueoReconexion = false; // reset por si se vuelve a caer después
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

    cliente.on('reconnecting', (ms) => {
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