const app = require('./app');

// 1. Invocamos el archivo de configuración de la BD para que se ejecute la conexión a la misma
require('./config/db');

const PORT = process.env.SERVER_PORT || 3001;

// 2. Invocamos al servidor para que escuche peticiones
app.listen(PORT, () => {
    console.log(`🔌 Servidor corriendo en http://localhost:${PORT}`);
});