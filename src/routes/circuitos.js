const express = require('express');
const router = express.Router();
const { obtenerCircuitoCompleto, obtenerResumenCircuitos, obtenerFiltrosDisponibles } = require('../controllers/circuitosController');

router.get('/filtros', obtenerFiltrosDisponibles);

router.get('/', obtenerResumenCircuitos);

router.get('/:id', obtenerCircuitoCompleto);

module.exports = router;
