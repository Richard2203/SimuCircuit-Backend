const express = require('express');
const router = express.Router();
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');
const TestCircuits = require('../engine/TestCircuits');

/**
 * POST /api/simular
 * Ejecuta análisis AC sobre un circuito de prueba con valores actualizados.
 */
router.post('/', async (req, res) => {
    try {
        const { valores, params, circuitoPrueba = 'cuatromallas' } = req.body;

        // 1. Seleccionar circuito de prueba
        let circuitoMock;
        switch (circuitoPrueba) {
            case 'rc':       circuitoMock = TestCircuits.circuitoRC();              break;
            case 'diodo':    circuitoMock = TestCircuits.circuitoConDiodo();        break;
            case 'bjt':      circuitoMock = TestCircuits.circuitoBJT();             break;
            case 'thevenin': circuitoMock = TestCircuits.circuitoThevenin();        break;
            case 'cuatromallas': circuitoMock = TestCircuits.circuitoCuatroMallas();break;
            default:         circuitoMock = TestCircuits.circuitoRC();
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
        //    Component base setea this.isLinear = true en el constructor,
        //    pero TestCircuits puede marcar isLinear: false para no-lineales.
        //    Si no lo preservamos aquí, linearizeForAC nunca los procesará.
        const componentesSim = circuitoMock.componentes.map(compData => {
            const instancia = ComponentFactory.crearComponente(compData);

            // Preservar isLinear solo si el compData lo define explícitamente
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
            tipo_barrido: 'log'
        };

        // 6. Ejecutar simulación
        const motor = new MotorCalculos(circuitoSim);
        //const resultado = await motor.ejecutarAnalisisAC(paramsAC);
        //NOTA: Linea anterior comentada para probar ahora el motor DC
        const resultado = await motor.ejecutarAnalisisDC();

        res.json(resultado);
    } catch (error) {
        console.error('Error en simulación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;