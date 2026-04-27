const express = require('express');
const router = express.Router();
const componentesController = require('../controllers/componentesController');

/**
 * @swagger
 * /api/componentes:
 *   get:
 *     summary: Obtiene el catálogo de componentes electrónicos
 *     description: >
 *       Devuelve todos los componentes registrados en la base de datos junto con
 *       su nombre, valor y unidad de medida. Útil para poblar selectores o mostrar
 *       el inventario de componentes disponibles.
 *     tags: [Componentes]
 *     responses:
 *       200:
 *         description: Catálogo obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exito:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   description: Cantidad total de componentes encontrados
 *                   example: 25
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ComponenteCatalogo'
 *             example:
 *               exito: true
 *               total: 3
 *               data:
 *                 - id: 1
 *                   nombre: "Resistencia 1kΩ"
 *                   valor: "1k"
 *                   unidad: "Ω"
 *                 - id: 2
 *                   nombre: "Capacitor 100nF"
 *                   valor: "100n"
 *                   unidad: "F"
 *                 - id: 3
 *                   nombre: "Fuente 5V"
 *                   valor: "5"
 *                   unidad: "V"
 *       500:
 *         description: Error al obtener el catálogo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             example:
 *               exito: false
 *               mensaje: "Error al obtener el catálogo."
 */
router.get('/', componentesController.obtenerCatalogo);

module.exports = router;
