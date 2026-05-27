// Wrapper de cache para controllers Express + invalidacion por version.
//
//  USO BASICO (en un controller):
//      const { conCache } = require('../utils/cacheManager');
//      module.exports = {
//          analisisDC: conCache('dc', analisisDC),
//          analisisAC: conCache('ac', analisisAC),
//      };
//
//  CoMO FUNCIONA:
//   1. Se calcula un SHA-256 estable del body del request (con claves
//      ordenadas alfabeticamente para que el orden no afecte el hash) ->
//      llave del cache:  sim:{tipo}:{hash}
//   2. Si la llave existe en Redis -> se responde con el JSON cacheado y se
//      agrega el header X-Cache: HIT.
//   3. Si no existe -> se ejecuta el controller normalmente. Se intercepta
//      res.json para guardar la respuesta en Redis (solo si fue 2xx y el
//      payload no marca exito: false). Header X-Cache: MISS.
//   4. Si Redis esta caido o falla cualquier operacion -> el endpoint sigue
//      respondiendo como antes (header X-Cache: BYPASS).
//
//  INVALIDACION POR VERSION DEL PACKAGE.JSON:
//   - Al arrancar la app se llama a invalidarSiCambioVersion().
//   - Se lee package.json.version y se compara con la guardada en Redis
//     bajo la llave app:simulador_version.
//   - Si difieren (o no habia nada guardado) -> se borran TODAS las llaves
//     que empiezan con sim: (usando SCAN + UNLINK para no bloquear Redis)
//     y se guarda la nueva version.
//   - Esto garantiza que cada vez que se publique una version nueva del
//     simulador, el cache viejo se descarte automaticamente.

const crypto = require('crypto');
const path = require('path');
const { cliente, estaDisponible, esperarListo } = require('../config/redis');

// TTL del cache en segundos. 1 hora de existencia por hash
const TTL_SEGUNDOS = 60 * 60;

// Prefijo comun para todas las llaves de simulacion
const PREFIJO_SIM = 'sim:';
const LLAVE_VERSION = 'app:simulador_version';

//  Hashing del request

/**
 * Hash SHA-256 deterministico del payload. Trunca a 32 hex chars (128 bits)
 * para llaves mas cortas en Redis.
 */
function hashRequest(payload) {
    const json = JSON.stringify(payload, ordenarClavesReplacer);
    return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
}

/**
 * Replacer de JSON.stringify que ordena las claves de los objetos
 * alfabeticamente. 
 */
function ordenarClavesReplacer(_key, value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((acc, k) => {
            acc[k] = value[k];
            return acc;
        }, {});
    }
    return value;
}

//  Wrapper de controllers
/**
 * Envuelve un controller Express con cache en Redis.
 *
 * @param {string}   tipo    - Identificador corto (dc, ac, transitorio, etc.).
 *                              Aparece en la llave: sirve para diferenciar y
 *                              para debug.
 * @param {Function} handler - Controller async original (req, res, next).
 * @returns {Function}         Nuevo controller con la misma firma.
 */
function conCache(tipo, handler) {
    return async function controllerConCache(req, res, next) {
        // 1) Redis no disponible -> comportamiento original.
        if (!cliente || typeof estaDisponible !== 'function' || !estaDisponible()) {
            res.setHeader('X-Cache', 'BYPASS');
            return handler(req, res, next);
        }

        // 2) Construir la llave: hash de todo el body. 
        let llave;
        try {
            const hash = hashRequest(req.body || {});
            llave = `${PREFIJO_SIM}${tipo}:${hash}`;
        } catch (err) {
            console.warn(`[Cache:${tipo}] No se pudo hashear el request: ${err.message}`);
            res.setHeader('X-Cache', 'BYPASS');
            return handler(req, res, next);
        }

        // 3) Intentar HIT.
        try {
            const cacheado = await cliente.get(llave);
            if (cacheado) {
                try {
                    const parsed = JSON.parse(cacheado);
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Cache-Key', llave);
                    return res.status(200).json(parsed);
                } catch (errParse) {
                    // Si el valor esta corrupto, lo borramos y seguimos como MISS.
                    console.warn(`[Cache:${tipo}] Valor corrupto en ${llave}, recalculando.`);
                    cliente.del(llave).catch(() => {});
                }
            }
        } catch (errGet) {
            console.warn(`[Cache:${tipo}] GET falló (${errGet.message}), recalculando sin caché.`);
            res.setHeader('X-Cache', 'BYPASS');
            return handler(req, res, next);
        }

        // 4) MISS: dejamos correr el controller pero interceptamos res.json
        //    para guardar la respuesta antes de mandarla.
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', llave);

        const jsonOriginal = res.json.bind(res);
        res.json = function jsonInterceptado(payload) {
            const statusOk = res.statusCode >= 200 && res.statusCode < 300;
            // Si el controller usa la convencion { exito: false, mensaje: ... }
            // para errores 400, NO queremos cachear eso. Si no usa la
            // convención (no hay campo exito), se cachea normalmente.
            const payloadOk = payload && (payload.exito === undefined || payload.exito === true);

            if (statusOk && payloadOk) {
                try {
                    const serializado = JSON.stringify(payload);
                    // Fire-and-forget: si el SET falla, ya respondimos al
                    // usuario, no hay nada que hacer.
                    cliente
                        .set(llave, serializado, 'EX', TTL_SEGUNDOS)
                        .catch((errSet) => {
                            console.warn(`[Cache:${tipo}] SET falló en ${llave}: ${errSet.message}`);
                        });
                } catch (errSer) {
                    console.warn(`[Cache:${tipo}] No se pudo serializar la respuesta: ${errSer.message}`);
                }
            }

            return jsonOriginal(payload);
        };

        return handler(req, res, next);
    };
}

//  Invalidación por versión

/**
 * Borra todas las llaves que empiezan con sim: usando SCAN + UNLINK.
 * - SCAN evita bloquear Redis si hay miles de llaves
 * - UNLINK es la versióo asincrona de DE redis, libera la memoria
 *   en otro hilo, perfecto cuando se borran muchas llaves de golpe.
 *
 * @returns {Promise<number>} Cantidad de llaves eliminadas.
 */
async function borrarCacheSimulaciones() {
    if (!cliente || typeof estaDisponible !== 'function' || !estaDisponible()) return 0;

    let borradas = 0;
    let cursor = '0';

    do {
        const [siguiente, llaves] = await cliente.scan(
            cursor, 'MATCH', `${PREFIJO_SIM}*`, 'COUNT', 200
        );
        cursor = siguiente;

        if (llaves.length > 0) {
            await cliente.unlink(...llaves);
            borradas += llaves.length;
        }
    } while (cursor !== '0');

    return borradas;
}

/**
 * Compara la version actual del package.json con la guardada en Redis.
 * Si difieren (o si Redis nunca tuvo una version), purga todo sim:* y
 * guarda la nueva version.
 */
async function invalidarSiCambioVersion() {
    try {
        // Esperamos hasta 5 s a que el cliente se conecte. Si no conecta,
        // simplemente no hacemos el chequeo
        const listo = await esperarListo(5000);
        if (!listo) {
            console.log('[Cache] Redis no disponible al arranque; chequeo de versión omitido.');
            return;
        }

        // package.json esta en la raíz del backend; este archivo está en
        // src/utils/, así que subimos dos niveles.
        const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
        let versionActual;
        try {
            versionActual = require(pkgPath).version;
        } catch (errPkg) {
            console.warn(`[Cache] No se pudo leer package.json en ${pkgPath}: ${errPkg.message}`);
            return;
        }

        const versionGuardada = await cliente.get(LLAVE_VERSION);

        if (versionGuardada === versionActual) {
            console.log(`[Cache] Versión sin cambios (${versionActual}). Caché preservado.`);
            return;
        }

        console.log(
            `[Cache] Versión cambió: ${versionGuardada || '(ninguna)'} → ${versionActual}. ` +
            `Limpiando caché de simulaciones...`
        );
        const borradas = await borrarCacheSimulaciones();
        await cliente.set(LLAVE_VERSION, versionActual);
        console.log(`[Cache] Limpieza completa. Llaves eliminadas: ${borradas}.`);
    } catch (err) {
        console.warn(`[Cache] Error en chequeo de versión (no fatal): ${err.message}`);
    }
}

module.exports = {
    conCache,
    invalidarSiCambioVersion,
    borrarCacheSimulaciones,
    hashRequest,
    TTL_SEGUNDOS,
    PREFIJO_SIM,
    LLAVE_VERSION,
};
