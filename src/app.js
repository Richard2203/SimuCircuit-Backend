require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes'); // Esto ahora sí existe

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
    res.json({
        mensaje: '¡Servidor de SimuCircuit encendido!',
        estado: 'OK'
    });
});

module.exports = app;