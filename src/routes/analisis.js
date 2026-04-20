const express = require('express');
const router = express.Router();
const { calcularDivisorVoltaje } = require('../controllers/analisisTeoremasController');

/**
 * POST /api/analisis/divisor-voltaje
 * Ejecuta el análisis del divisor de voltaje.
 */
router.post('/divisor-voltaje', calcularDivisorVoltaje);

module.exports = router;