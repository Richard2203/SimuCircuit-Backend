const mysql = require('mysql2/promise');
require('dotenv').config({ path: './src/.env' });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Probamos la conexión al arrancar
pool.getConnection()
    .then(connection => {
        console.log(`Base de datos del Simulador conectada en el puerto:${process.env.DB_PORT}`);
        connection.release();
    })
    .catch(err => {
        console.error('Error al conectar con la base de datos:', err.message);
    });

module.exports = pool;