require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
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

// ─── Swagger UI ──────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'SimuCircuit API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
    }
}));

// Endpoint para obtener el JSON del spec (útil para generadores de clientes)
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// ─── Rutas de la API ─────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Servidor de SimuCircuit encendido!',
        estado: 'OK',
        docs: '/api-docs'
    });
});

module.exports = app;
