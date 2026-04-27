const express = require('express');
const router = express.Router();
const { ejecutarTheveninNorton, ejecutarSuperposicion, transformarFuente } = require('../controllers/analisisTeoremasController');

/**
 * @swagger
 * /api/teoremas/thevenin-norton:
 *   post:
 *     summary: Ejecuta el análisis de Thévenin y Norton
 *     description: >
 *       Calcula el **equivalente de Thévenin y Norton** del circuito visto desde los terminales
 *       del componente de carga especificado.
 *
 *       Internamente realiza **dos simulaciones DC**:
 *       1. **Circuito Abierto (OC):** Se retira la carga y se mide el voltaje en sus terminales → **Vth**
 *       2. **Cortocircuito (SC):** Se reemplaza la carga por una fuente de 0V y se mide la corriente → **In**
 *
 *       A partir de estos valores calcula:
 *       - `Rth = Rn = |Vth / In|`
 *       - `Pmax = Vth² / (4·Rth)` (máxima transferencia de potencia)
 *
 *       ### Restricciones
 *       - El circuito debe tener el nodo `"0"` (GND).
 *       - Solo funciona con circuitos **lineales** en DC.
 *       - El `componenteCargaId` debe ser una **resistencia** con exactamente 2 terminales.
 *     tags: [Teoremas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [netlist, componenteCargaId]
 *             properties:
 *               netlist:
 *                 type: array
 *                 description: Lista completa de componentes del circuito (incluyendo la carga)
 *                 items:
 *                   $ref: '#/components/schemas/ComponenteNetlist'
 *               componenteCargaId:
 *                 type: string
 *                 description: >
 *                   ID del componente que se usará como carga para el análisis.
 *                   Este componente se retirará del circuito para calcular Vth.
 *                 example: "RL"
 *               nombre_circuito:
 *                 type: string
 *                 description: Nombre descriptivo (opcional, para logs)
 *                 example: "Thévenin desde RL"
 *           examples:
 *             thevenin_basico:
 *               summary: Divisor de voltaje con carga RL
 *               value:
 *                 nombre_circuito: "Thévenin desde RL"
 *                 componenteCargaId: "RL"
 *                 netlist:
 *                   - id: "V1"
 *                     type: "fuente_voltaje"
 *                     value: "10"
 *                     nodes: { pos: "1", neg: "0" }
 *                     params: { dcOrAc: "dc" }
 *                   - id: "R1"
 *                     type: "resistencia"
 *                     value: "1k"
 *                     nodes: { n1: "1", n2: "2" }
 *                     params: {}
 *                   - id: "R2"
 *                     type: "resistencia"
 *                     value: "1k"
 *                     nodes: { n1: "2", n2: "0" }
 *                     params: {}
 *                   - id: "RL"
 *                     type: "resistencia"
 *                     value: "2k"
 *                     nodes: { n1: "2", n2: "0" }
 *                     params: {}
 *     responses:
 *       200:
 *         description: Análisis de Thévenin/Norton completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResultadoTheveninNorton'
 *             example:
 *               exito: true
 *               teorema: "Thévenin / Norton"
 *               data:
 *                 thevenin:
 *                   Vth: 5.0
 *                   Rth: 500.0
 *                   unidadV: "V"
 *                   unidadR: "Ω"
 *                 norton:
 *                   In: 0.01
 *                   Rn: 500.0
 *                   unidadI: "A"
 *                   unidadR: "Ω"
 *                 maximaPotencia:
 *                   valor: 0.0125
 *                   unidad: "W"
 *                 procedimiento:
 *                   - paso: 1
 *                     eq: "V_{th} = 5.0000000000V"
 *                   - paso: 2
 *                     eq: "I_{n} = 0.0100000000A"
 *                   - paso: 3
 *                     eq: "R_{th} = \\frac{5.0}{0.01} = 500.0000000000\\Omega"
 *       400:
 *         description: Netlist inválida o falta el ID de la carga
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             examples:
 *               sin_netlist:
 *                 value:
 *                   exito: false
 *                   mensaje: "No se recibió una Netlist válida para realizar el análisis."
 *               sin_carga:
 *                 value:
 *                   exito: false
 *                   mensaje: "No se recibió el ID del componente de carga. Por favor, especifica el ID del componente que deseas analizar."
 *       500:
 *         description: Error durante el análisis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.post('/thevenin-norton', ejecutarTheveninNorton);

/**
 * @swagger
 * /api/teoremas/superposicion:
 *   post:
 *     summary: Ejecuta el análisis por el Teorema de Superposición
 *     description: >
 *       Aplica el **Teorema de Superposición** para calcular la contribución individual
 *       de cada fuente independiente sobre un componente objetivo.
 *
 *       Para cada fuente en el circuito, el algoritmo:
 *       1. Apaga todas las demás fuentes (fuentes de voltaje → cortocircuito `value: "0"`,
 *          fuentes de corriente → circuito abierto `value: "0"`)
 *       2. Ejecuta un análisis DC con la fuente activa
 *       3. Extrae la contribución (voltaje o corriente) sobre el `componenteObjetivoId`
 *       4. Suma algebraicamente todas las contribuciones → valor total
 *
 *       ### Restricciones
 *       - Requiere **al menos 2 fuentes independientes** (si solo hay una, no aplica superposición).
 *       - Solo aplica a circuitos **lineales** en DC.
 *       - El circuito debe tener el nodo `"0"` (GND).
 *     tags: [Teoremas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [netlist, componenteObjetivoId]
 *             properties:
 *               netlist:
 *                 type: array
 *                 description: Lista de componentes del circuito
 *                 items:
 *                   $ref: '#/components/schemas/ComponenteNetlist'
 *               componenteObjetivoId:
 *                 type: string
 *                 description: ID del componente sobre el que se quiere analizar la contribución de cada fuente
 *                 example: "R3"
 *               parametroAnalisis:
 *                 type: string
 *                 enum: [voltaje, corriente]
 *                 description: Qué magnitud analizar sobre el componente objetivo
 *                 example: "voltaje"
 *               nombre_circuito:
 *                 type: string
 *                 description: Nombre descriptivo (opcional)
 *                 example: "Superposición en R3"
 *           examples:
 *             superposicion_dos_fuentes:
 *               summary: Circuito con 2 fuentes de voltaje y resistor objetivo
 *               value:
 *                 nombre_circuito: "Superposición en R3"
 *                 componenteObjetivoId: "R3"
 *                 parametroAnalisis: "voltaje"
 *                 netlist:
 *                   - id: "V1"
 *                     type: "fuente_voltaje"
 *                     value: "12"
 *                     nodes: { pos: "1", neg: "0" }
 *                     params: { dcOrAc: "dc" }
 *                   - id: "V2"
 *                     type: "fuente_voltaje"
 *                     value: "6"
 *                     nodes: { pos: "3", neg: "0" }
 *                     params: { dcOrAc: "dc" }
 *                   - id: "R1"
 *                     type: "resistencia"
 *                     value: "2k"
 *                     nodes: { n1: "1", n2: "2" }
 *                     params: {}
 *                   - id: "R2"
 *                     type: "resistencia"
 *                     value: "4k"
 *                     nodes: { n1: "2", n2: "3" }
 *                     params: {}
 *                   - id: "R3"
 *                     type: "resistencia"
 *                     value: "3k"
 *                     nodes: { n1: "2", n2: "0" }
 *                     params: {}
 *     responses:
 *       200:
 *         description: Análisis de Superposición completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResultadoSuperposicion'
 *             example:
 *               exito: true
 *               teorema: "Superposición"
 *               data:
 *                 componenteObjetivo: "R3"
 *                 parametro: "voltaje"
 *                 valorTotal: 4.0
 *                 unidad: "V"
 *                 aportaciones:
 *                   - fuenteId: "V1"
 *                     tipoFuente: "fuente_voltaje"
 *                     valorAporte: 3.0
 *                   - fuenteId: "V2"
 *                     tipoFuente: "fuente_voltaje"
 *                     valorAporte: 1.0
 *       400:
 *         description: Netlist inválida o circuito con menos de 2 fuentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             example:
 *               exito: false
 *               mensaje: "El circuito necesita al menos 2 fuentes para aplicar superposición."
 *       500:
 *         description: Error durante el análisis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.post('/superposicion', ejecutarSuperposicion);


/**
 * POST /api/teoremas/transformar-fuente
 * Transforma una fuente de voltaje en una fuente de corriente o viceversa.
 */
router.post('/transformar-fuente', transformarFuente);

module.exports = router;