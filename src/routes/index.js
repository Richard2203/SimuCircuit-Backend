const express = require('express');
const router = express.Router();

// Importar rutas específicas
const simulacionRoutes = require('./simulacion');

// Usar las rutas
router.use('/simular', simulacionRoutes);

// Ruta de prueba para verificar que el enrutador funciona
router.get('/test', (req, res) => {
    res.json({ mensaje: 'Rutas funcionando correctamente' });
});

module.exports = router;