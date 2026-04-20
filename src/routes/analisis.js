const express = require('express');
const router = express.Router();
const { calcularDivisorVoltaje, calcularDivisorCorriente, obtenerResistenciaEquivalente } = require('../controllers/analisisTeoremasController');

/**
 * POST /api/analisis/divisor-voltaje
 * Ejecuta el análisis del divisor de voltaje.
 */
router.post('/divisor-voltaje', calcularDivisorVoltaje);

/**
 * POST /api/analisis/divisor-corriente
 * Ejecuta el análisis del divisor de corriente.
 */
router.post('/divisor-corriente', calcularDivisorCorriente);

/**
 * POST /api/analisis/resistencia-equivalente
 * Ejecuta el análisis de la resistencia equivalente en 2 nodos seleccionados.
 */
router.post('/resistencia-equivalente', obtenerResistenciaEquivalente);

module.exports = router;