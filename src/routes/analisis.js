const express = require('express');
const router = express.Router();
const { calcularDivisorVoltaje, calcularDivisorCorriente, obtenerResistenciaEquivalente, analisisTransitorio } = require('../controllers/analisisTeoremasController');
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

/**
 * POST /api/analisis/transitorio
 * Ejecuta el análisis transitorio del circuito completo usando el método de Euler hacia atrás.
 * El cuerpo de la solicitud debe incluir la netlist del circuito además de:
    * "configuracion_transitorio": {
        "t_stop": 0.05,        
        "delta_t": 0.0005      
    }
 */
router.post('/transitorio', analisisTransitorio);

module.exports = router;