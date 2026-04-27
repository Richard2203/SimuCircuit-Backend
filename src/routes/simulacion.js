const express = require('express');
const router = express.Router();
const simulacionController = require('../controllers/simulacionController');
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');
const TestCircuits = require('../engine/TestCircuits');

/**
 * @swagger
 * /api/simular/dc:
 *   post:
 *     summary: Ejecuta un análisis de Corriente Directa (DC) sobre una netlist
 *     description: >
 *       Recibe una netlist y aplica el Análisis Nodal Modificado (MNA) para obtener
 *       los voltajes en cada nodo y las corrientes en cada rama del circuito.
 *
 *       ### Tipos de componentes soportados en DC
 *       | type | Nodos requeridos | Params clave |
 *       |------|-----------------|--------------|
 *       | `resistencia` | n1, n2 | — |
 *       | `fuente_voltaje` | pos, neg | dcOrAc: "dc" |
 *       | `fuente_corriente` | pos, neg | dcOrAc: "dc" |
 *       | `diodo` | n1, n2 | — (modelo Shockley) |
 *       | `transistor_bjt` | base, colector, emisor | beta, Vt, Is |
 *       | `transistor_fet` | gate, drain, source | — |
 *       | `regulador_voltaje` | in, out, gnd | — |
 *
 *       > Los capacitores se comportan como circuito abierto en DC.
 *       > Las bobinas se comportan como cortocircuito en DC.
 *
 *       ### Regla obligatoria
 *       La netlist **debe** contener al menos un componente conectado al nodo `"0"` (GND).
 *     tags: [Simulación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [netlist]
 *             properties:
 *               netlist:
 *                 type: array
 *                 description: Lista de componentes del circuito
 *                 items:
 *                   $ref: '#/components/schemas/ComponenteNetlist'
 *               nombre_circuito:
 *                 type: string
 *                 description: Nombre descriptivo del circuito (opcional, se usa para logs internos)
 *                 example: "Divisor de Voltaje"
 *           examples:
 *             divisor_voltaje:
 *               summary: Divisor de voltaje simple (2 resistencias)
 *               value:
 *                 nombre_circuito: "Divisor de Voltaje"
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
 *             circuito_diodo:
 *               summary: Circuito con diodo rectificador
 *               value:
 *                 nombre_circuito: "Rectificador de Media Onda"
 *                 netlist:
 *                   - id: "V1"
 *                     type: "fuente_voltaje"
 *                     value: "5"
 *                     nodes: { pos: "1", neg: "0" }
 *                     params: { dcOrAc: "dc" }
 *                   - id: "D1"
 *                     type: "diodo"
 *                     value: "1N4148"
 *                     nodes: { n1: "1", n2: "2" }
 *                     params: {}
 *                   - id: "R1"
 *                     type: "resistencia"
 *                     value: "1k"
 *                     nodes: { n1: "2", n2: "0" }
 *                     params: {}
 *     responses:
 *       200:
 *         description: Análisis DC completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResultadoDC'
 *             example:
 *               exito: true
 *               tipo_analisis: "DC"
 *               data:
 *                 voltages:
 *                   "1": 10.0
 *                   "2": 5.0
 *                 currents:
 *                   R1: 0.005
 *                   R2: 0.005
 *                 voltageSourceCurrents:
 *                   V1: 0.01
 *       400:
 *         description: Netlist inválida o falta nodo de tierra
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             examples:
 *               netlist_vacia:
 *                 summary: Netlist vacía o no enviada
 *                 value:
 *                   exito: false
 *                   mensaje: "No se recibió una Netlist válida para simular."
 *               sin_tierra:
 *                 summary: Sin nodo de tierra
 *                 value:
 *                   exito: false
 *                   mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0").'
 *       500:
 *         description: Error durante la simulación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.post('/dc', simulacionController.analisisDC);

/**
 * @swagger
 * /api/simular/ac:
 *   post:
 *     summary: Ejecuta un análisis de Corriente Alterna (AC) con barrido de frecuencia
 *     description: >
 *       Recibe una netlist con al menos una fuente AC y una configuración de barrido de frecuencia.
 *       Devuelve los fasores de voltaje (magnitud y fase) en cada nodo para cada punto del barrido.
 *
 *       El análisis AC utiliza linealización de los componentes no lineales alrededor del punto
 *       de operación DC antes de aplicar el análisis fasorial.
 *
 *       ### Componentes que responden en AC
 *       | type | Comportamiento |
 *       |------|---------------|
 *       | `capacitor` | Impedancia: Z = 1/(j·ω·C) |
 *       | `bobina` | Impedancia: Z = j·ω·L |
 *       | `fuente_voltaje` | Activa si dcOrAc: "ac", con amplitude y phase |
 *       | `fuente_corriente` | Activa si dcOrAc: "ac", con amplitude y phase |
 *       | `resistencia` | Impedancia: Z = R |
 *
 *       ### Regla obligatoria
 *       - La netlist **debe** contener al menos un componente conectado al nodo `"0"` (GND).
 *       - La `configuracion_ac` con `f_inicial` y `f_final` es **obligatoria**.
 *     tags: [Simulación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [netlist, configuracion_ac]
 *             properties:
 *               netlist:
 *                 type: array
 *                 description: Lista de componentes del circuito
 *                 items:
 *                   $ref: '#/components/schemas/ComponenteNetlist'
 *               nombre_circuito:
 *                 type: string
 *                 description: Nombre descriptivo (opcional)
 *                 example: "Filtro RC Pasa-Bajas"
 *               configuracion_ac:
 *                 $ref: '#/components/schemas/ConfiguracionAC'
 *           examples:
 *             filtro_rc:
 *               summary: Filtro RC pasa-bajas
 *               value:
 *                 nombre_circuito: "Filtro RC Pasa-Bajas"
 *                 configuracion_ac:
 *                   f_inicial: 10
 *                   f_final: 100000
 *                   puntos: 50
 *                   barrido: "log"
 *                 netlist:
 *                   - id: "V1"
 *                     type: "fuente_voltaje"
 *                     value: "1"
 *                     nodes: { pos: "1", neg: "0" }
 *                     params: { dcOrAc: "ac", amplitude: 1, phase: 0 }
 *                   - id: "R1"
 *                     type: "resistencia"
 *                     value: "1k"
 *                     nodes: { n1: "1", n2: "2" }
 *                     params: {}
 *                   - id: "C1"
 *                     type: "capacitor"
 *                     value: "100n"
 *                     nodes: { n1: "2", n2: "0" }
 *                     params: {}
 *     responses:
 *       200:
 *         description: Análisis AC completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResultadoAC'
 *             example:
 *               exito: true
 *               tipo_analisis: "AC"
 *               data:
 *                 - frecuencia: 10
 *                   voltages:
 *                     "1": { magnitud: 1.0, fase: 0, real: 1.0, imag: 0 }
 *                     "2": { magnitud: 0.999, fase: -0.36, real: 0.999, imag: -0.006 }
 *                 - frecuencia: 1591
 *                   voltages:
 *                     "1": { magnitud: 1.0, fase: 0, real: 1.0, imag: 0 }
 *                     "2": { magnitud: 0.707, fase: -45, real: 0.5, imag: -0.5 }
 *       400:
 *         description: Netlist o configuración AC inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 *             examples:
 *               sin_config_ac:
 *                 summary: Falta configuracion_ac
 *                 value:
 *                   exito: false
 *                   mensaje: 'No se recibió una configuración AC válida para simular. Para el análisis AC se requiere el objeto "configuracion_ac" (f_inicial, f_final, puntos, barrido).'
 *               sin_tierra:
 *                 summary: Sin nodo de tierra
 *                 value:
 *                   exito: false
 *                   mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0").'
 *       500:
 *         description: Error durante la simulación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaError'
 */
router.post('/ac', simulacionController.analisisAC);

/**
 * @swagger
 * /api/simular:
 *   post:
 *     summary: "[PRUEBA] Ejecuta una simulación usando circuitos de prueba internos"
 *     description: >
 *       **Ruta de desarrollo/prueba.** Ejecuta el análisis AC usando circuitos de prueba
 *       predefinidos en el sistema (TestCircuits.js). No requiere enviar una netlist completa,
 *       solo el nombre del circuito de prueba.
 *
 *       > ⚠️ Esta ruta no será eliminada por ahora, pero está pensada solo para pruebas internas.
 *       > Para producción, usar `/api/simular/ac` o `/api/simular/dc`.
 *     tags: [Simulación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               circuitoPrueba:
 *                 type: string
 *                 description: Nombre del circuito de prueba a usar
 *                 enum:
 *                   - rc_ac
 *                   - rc_dc
 *                   - diodo
 *                   - bjt
 *                   - thevenin
 *                   - cuatromallas
 *                   - divisor
 *                   - fet
 *                   - regulador
 *                 example: "rc_ac"
 *               valores:
 *                 type: array
 *                 description: Permite sobreescribir valores de componentes del circuito de prueba
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "R1"
 *                     valor:
 *                       type: string
 *                       example: "2k"
 *               params:
 *                 $ref: '#/components/schemas/ConfiguracionAC'
 *     responses:
 *       200:
 *         description: Simulación ejecutada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       500:
 *         description: Error durante la simulación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/', async (req, res) => {
    try {
        const { valores, params, circuitoPrueba } = req.body;

        // 1. Seleccionar circuito de prueba
        let circuitoMock;
        switch (circuitoPrueba) {
            case 'rc_ac':       circuitoMock = TestCircuits.circuitoRCAC();              break;
            case 'rc_dc':       circuitoMock = TestCircuits.circuitoRCDC();              break;
            case 'diodo':    circuitoMock = TestCircuits.circuitoConDiodoDC();        break;
            case 'diodoac':    circuitoMock = TestCircuits.circuitoConDiodoAC();        break;
            case 'bjt':      circuitoMock = TestCircuits.circuitoBJT();             break;
            case 'thevenin': circuitoMock = TestCircuits.circuitoThevenin();        break;
            case 'cuatromallas': circuitoMock = TestCircuits.circuitoCuatroMallas();break;
            case 'divisor':   circuitoMock = TestCircuits.divisorResistivo();         break;
            case 'fet':       circuitoMock = TestCircuits.circuitoFET();             break;
            case 'regulador': circuitoMock = TestCircuits.circuitoRegulador(); break;
            default:         circuitoMock = TestCircuits.circuitoRCAC();
        }

        // 2. Actualizar valores si vienen en la petición
        if (valores && Array.isArray(valores)) {
            circuitoMock.componentes.forEach(comp => {
                const valorEnviado = valores.find(v => v.id === comp.id);
                if (valorEnviado) {
                    comp.value = valorEnviado.valor;
                }
            });
        }

        // 3. Crear instancias y preservar isLinear del compData original
        const componentesSim = circuitoMock.componentes.map(compData => {
            const instancia = ComponentFactory.crearComponente(compData);
            if (compData.isLinear !== undefined) {
                instancia.isLinear = compData.isLinear;
            }
            return instancia;
        });

        // 4. Preparar objeto circuito para el motor
        const circuitoSim = {
            id: circuitoMock.id,
            componentes: componentesSim,
            nodos: circuitoMock.nodos,
            obtenerNodoTierra: circuitoMock.obtenerNodoTierra
        };

        // 5. Parámetros AC por defecto
        const paramsAC = params || {
            f_inicial: 10,
            f_final:   100000,
            puntos:    10,
            barrido: 'log'
        };

        // 6. Ejecutar simulación
        const motor = new MotorCalculos(circuitoSim);
        const resultado = await motor.ejecutarAnalisisAC(paramsAC);

        res.json(resultado);
    } catch (error) {
        console.error('Error en simulación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
