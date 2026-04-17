const express = require('express');
const router = express.Router();
const { ejecutarTheveninNorton } = require('../controllers/analisisTeoremasController');

/**
 * POST /api/teoremas/thevenin-norton
 * Ejecuta el análisis de Thevenin/Norton.
 */
router.post('/thevenin-norton', ejecutarTheveninNorton);

module.exports = router;