const express = require('express');
const router = express.Router();
const { ejecutarTheveninNorton, ejecutarSuperposicion } = require('../controllers/analisisTeoremasController');

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

module.exports = router;