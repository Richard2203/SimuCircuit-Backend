const express = require('express');
const router = express.Router();
const circuitosController = require('../controllers/circuitosController');

/**
 * GET /api/circuitos/:id
 * Obtiene la información completa de un circuito específico.
 */
router.get('/:id', circuitosController.obtenerCircuitoCompleto);

module.exports = router;