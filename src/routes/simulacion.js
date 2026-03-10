const express = require('express');
const router = express.Router();
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');
const TestCircuits = require('../engine/TestCircuits'); // Circuitos de prueba

/**
 * POST /api/simular
 * Ejecuta análisis AC sobre un circuito de prueba (o de BD) con valores actualizados
 */
router.post('/', async (req, res) => {
    try {
        const { valores, params, circuitoPrueba = 'rc' } = req.body;

        // Seleccionar circuito de prueba según el identificador recibido
        let circuitoMock;
        switch (circuitoPrueba) {
            case 'rc':
                circuitoMock = TestCircuits.circuitoRC();
                break;
            case 'diodo':
                circuitoMock = TestCircuits.circuitoConDiodo();
                break;
            case 'bjt':
                circuitoMock = TestCircuits.circuitoBJT();
                break;
            case 'thevenin':
                circuitoMock = TestCircuits.circuitoThevenin();
                break;
            default:
                circuitoMock = TestCircuits.circuitoRC();
        }

        // Actualizar valores si vienen en la petición (útil para pruebas de edición)
        if (valores && Array.isArray(valores)) {
            circuitoMock.componentes.forEach(comp => {
                const valorEnviado = valores.find(v => v.id === comp.id);
                if (valorEnviado) {
                    comp.value = valorEnviado.valor;
                }
            });
        }

        // Crear instancias de simulación usando el factory
        const componentesSim = circuitoMock.componentes.map(compData => 
            ComponentFactory.crearComponente(compData)
        );

        // Preparar objeto circuito para el motor de simulación
        const circuitoSim = {
            id: circuitoMock.id,
            componentes: componentesSim,
            nodos: circuitoMock.nodos,
            obtenerNodoTierra: circuitoMock.obtenerNodoTierra
        };

        // Parámetros por defecto para AC
        const paramsAC = params || {
            f_inicial: 10,
            f_final: 100000,
            puntos: 10,
            tipo_barrido: 'log'
        };

        // Ejecutar simulación
        const motor = new MotorCalculos(circuitoSim);
        const resultado = await motor.ejecutarAnalisisAC(paramsAC);

        res.json(resultado);
    } catch (error) {
        console.error('Error en simulación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;