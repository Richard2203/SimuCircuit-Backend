const express = require('express');
const router = express.Router();
const { obtenerCircuitoCompleto, obtenerResumenCircuitos, obtenerFiltrosDisponibles } = require('../controllers/circuitosController');

/**
 * @swagger
 * /api/circuitos/filtros:
 *   get:
 *     summary: Obtiene los filtros disponibles para el catálogo de circuitos
 *     description: >
 *       Devuelve las opciones de filtrado que el frontend puede usar para consultar
 *       el catálogo de circuitos: temas (categorías), componentes, dificultades y materias.
 *       Los temas y componentes se consultan dinámicamente desde la BD.
 *     tags: [Circuitos]
 *     responses:
 *       200:
 *         description: Filtros obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exito:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     temas:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Leyes de Kirchhoff", "Análisis Nodal", "Transistores"]
 *                     componentes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Resistencia", "Capacitor", "Transistor BJT"]
 *                     dificultades:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Básico", "Intermedio", "Avanzado"]
 *                     materias:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Circuitos Eléctricos", "Electrónica Analógica"]
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.get('/filtros', obtenerFiltrosDisponibles);

/**
 * @swagger
 * /api/circuitos:
 *   get:
 *     summary: Obtiene el catálogo de circuitos con filtros opcionales
 *     description: >
 *       Devuelve un listado con la información resumida de todos los circuitos activos.
 *       Soporta múltiples filtros opcionales por query string. Si no se envía ningún filtro,
 *       devuelve todos los circuitos disponibles ordenados por ID ascendente.
 *     tags: [Circuitos]
 *     parameters:
 *       - in: query
 *         name: nombreBusqueda
 *         schema:
 *           type: string
 *         description: Filtra por nombre del circuito (búsqueda parcial)
 *         example: "divisor"
 *       - in: query
 *         name: dificultad
 *         schema:
 *           type: string
 *           enum: [Básico, Intermedio, Avanzado, Todos]
 *         description: Filtra por nivel de dificultad. Enviar "Todos" o no enviar para omitir el filtro.
 *         example: "Básico"
 *       - in: query
 *         name: materia
 *         schema:
 *           type: string
 *           enum: ["Circuitos Eléctricos", "Electrónica Analógica", "Todos"]
 *         description: Filtra por materia. Enviar "Todos" para omitir.
 *         example: "Circuitos Eléctricos"
 *       - in: query
 *         name: tema
 *         schema:
 *           type: string
 *         description: Filtra por tema/categoría asignada al circuito.
 *         example: "Leyes de Kirchhoff"
 *       - in: query
 *         name: componentes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *         description: >
 *           Filtra por tipo(s) de componente. El circuito debe contener AL MENOS UNO.
 *           Ejemplo: ?componentes=Resistencia&componentes=Capacitor
 *         example: ["Resistencia"]
 *     responses:
 *       200:
 *         description: Catálogo de circuitos obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exito:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ResumenCircuito'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.get('/', obtenerResumenCircuitos);

/**
 * @swagger
 * /api/circuitos/{id}:
 *   get:
 *     summary: Obtiene la información completa y netlist de un circuito
 *     description: >
 *       Devuelve todos los datos del circuito: metadata y su **netlist completa** lista
 *       para ser enviada al simulador. La netlist incluye componentes con nodos, parámetros
 *       físicos (consultados de la tabla hija correspondiente) y posición en el canvas.
 *     tags: [Circuitos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del circuito en la base de datos
 *         example: 1
 *     responses:
 *       200:
 *         description: Circuito encontrado y netlist generada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CircuitoCompleto'
 *             example:
 *               exito: true
 *               data:
 *                 circuito:
 *                   id: 1
 *                   nombre_circuito: "Divisor de Voltaje"
 *                   descripcion: "Circuito básico divisor resistivo"
 *                   dificultad: "Básico"
 *                   unidad_tematica: "Leyes de Kirchhoff"
 *                   materia: "Circuitos Eléctricos"
 *                 netlist:
 *                   - id: "V1"
 *                     type: "fuente_voltaje"
 *                     value: "10"
 *                     nodes: { pos: "1", neg: "0" }
 *                     params: { dcOrAc: "dc", phase: 0 }
 *                     position: { x: 100, y: 200 }
 *                     rotation: 0
 *                   - id: "R1"
 *                     type: "resistencia"
 *                     value: "1k"
 *                     nodes: { n1: "1", n2: "2" }
 *                     params: {}
 *                     position: { x: 200, y: 100 }
 *                     rotation: 0
 *       404:
 *         description: Circuito no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             example:
 *               exito: false
 *               mensaje: "Circuito no encontrado en la base de datos."
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.get('/:id', obtenerCircuitoCompleto);

module.exports = router;
