const express = require('express');
const router = express.Router();
const { obtenerCircuitoCompleto, obtenerResumenCircuitos, obtenerFiltrosDisponibles } = require('../controllers/circuitosController');

/**
 * GET /api/circuitos/filtros
 * Obtiene las opciones disponibles para los filtros (materias, temas, componentes) que el frontend puede usar para solicitar los circuitos (obtenerCircuitosCompleto)
 */
router.get('/filtros', obtenerFiltrosDisponibles);

/**
 * GET /api/circuitos
 * Obtiene la información resumida de todos los circuitos con filtros opcionales.
 */
router.get('/', obtenerResumenCircuitos);

/**
 * GET /api/circuitos/:id
 * Obtiene la información completa de un circuito específico.
 */
router.get('/:id', obtenerCircuitoCompleto);

module.exports = router;