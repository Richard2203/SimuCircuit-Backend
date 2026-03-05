// Carga las variables de entorno desde el archivo .env ANTES de cualquier otra cosa
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Inicializamos la aplicación
const app = express();

// --- Configuración de Middlewares ---
// Habilita CORS para que el Front-End (React) no sea bloqueado por el navegador
app.use(cors()); 
// Habilita el parseo de JSON en el cuerpo de las peticiones
app.use(express.json()); 

// Definimos el puerto
const PORT = process.env.SERVER_PORT;

// --- Rutas Base ---
// Ruta de prueba importante para comprobar que el servidor está vivo
app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Servidor de SimuCircuit encendido!',
        estado: 'OK',
        puerto_utilizado: PORT
    });
});

// --- Encendido del Servidor ---
app.listen(PORT, () => {
    console.log(`🔌 Servidor de SimuCircuit corriendo exitosamente en http://localhost:${PORT}`);
});