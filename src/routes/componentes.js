const express = require('express');
const router = express.Router();
const componentesController = require('../controllers/componentesController');

router.get('/', componentesController.obtenerCatalogo);

module.exports = router;
