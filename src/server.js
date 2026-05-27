const app = require('./app');

// Archivo de configuracion para la BD.
require('./config/db');

// 1. Inicializa Redis, si REDIS_HOST no está definido, el módulo loguea un warning y sigue.
require('./config/redis');

// 2 Disparamos el chequeo de version del simulador contra Redis.
//     Si la version del package.json cambio respecto a la que esta en Redis,
//     se borran todas las llaves sim:* automaticamente.
//     fire-and-forget: no bloquea el arranque del servidor, pues la funcion
//     atrapa sus propios errores asi que jamas tira el proceso.
const { invalidarSiCambioVersion } = require('./utils/cacheManager');
invalidarSiCambioVersion();

const PORT = process.env.SERVER_PORT || 3001;

// 3. Servidor escucha peticiones.
app.listen(PORT, () => {
    console.log(`🔌 Servidor corriendo en http://localhost:${PORT}`);
});
