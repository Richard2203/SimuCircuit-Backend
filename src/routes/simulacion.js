const express = require('express');
const router = express.Router();
const simulacionController = require('../controllers/simulacionController');
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');
const TestCircuits = require('../engine/TestCircuits');

router.post('/dc', simulacionController.analisisDC);

router.post('/ac', simulacionController.analisisAC);

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
