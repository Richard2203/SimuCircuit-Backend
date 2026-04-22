const express = require('express');
const router = express.Router();
const { ejecutarTheveninNorton, ejecutarSuperposicion, transformarFuente } = require('../controllers/analisisTeoremasController');

/**
 * POST /api/teoremas/thevenin-norton
 * Ejecuta el análisis de Thevenin/Norton.
 */
router.post('/thevenin-norton', ejecutarTheveninNorton);

/**
 * POST /api/teoremas/superposicion
 * Ejecuta el análisis de Superposición.
 */
router.post('/superposicion', ejecutarSuperposicion);

/**
 * POST /api/teoremas/transformar-fuente
 * Transforma una fuente de voltaje en una fuente de corriente o viceversa.
 */
router.post('/transformar-fuente', transformarFuente);

module.exports = router;