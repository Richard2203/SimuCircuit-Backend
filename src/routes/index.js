const express = require('express');
const router = express.Router();

// Importar rutas específicas
const simulacionRoutes = require('./simulacion');
const componentesRoutes = require('./componentes');
const circuitosRoutes = require('./circuitos');
const teoremasRoutes = require('./teoremas');
const analisisRoutes = require('./analisis');

// Usar ruta de componentes
router.use('/componentes', componentesRoutes);

// Usar ruta de circuitos
router.use('/circuitos', circuitosRoutes);

// Usar las rutas
router.use('/simular', simulacionRoutes);

//Usar las rutas de teoremas
router.use('/teoremas', teoremasRoutes);

//Usar las rutas de análisis
router.use('/analisis', analisisRoutes);

// Ruta de prueba para verificar que el enrutador funciona
router.get('/test', (req, res) => {
    res.json({ mensaje: 'Rutas funcionando correctamente' });
});

module.exports = router;