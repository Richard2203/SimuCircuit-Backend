require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

const pool = require('./config/db');

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({
            status: 'healthy',
            database: 'connected',
            uptime: Math.floor(process.uptime()) + 's'
        });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// ─── Rutas de la API ─────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Servidor de SimuCircuit encendido!',
        estado: 'OK',
    });
});

module.exports = app;
