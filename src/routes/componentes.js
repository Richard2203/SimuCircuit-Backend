const express = require('express');
const router = express.Router();
const componentesController = require('../controllers/componentesController');

/**
 * GET /api/componentes
 * Obtiene el catálogo de componentes disponibles en la BD.
 */
router.get('/', componentesController.obtenerCatalogo);

module.exports = router;