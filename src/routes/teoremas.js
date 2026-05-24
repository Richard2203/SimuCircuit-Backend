const express = require('express');
const router = express.Router();
const { ejecutarTheveninNorton, ejecutarSuperposicion, transformarFuente } = require('../controllers/analisisTeoremasController');

router.post('/thevenin-norton', ejecutarTheveninNorton);

router.post('/superposicion', ejecutarSuperposicion);

router.post('/transformar-fuente', transformarFuente);

module.exports = router;