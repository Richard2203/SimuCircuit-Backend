const express = require('express');
const router = express.Router();
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');

router.post('/', async (req, res) => {
    try {
        const { valores, params } = req.body;

        const circuitoMock = {
            id: 1,
            componentes: [
                {
                    id: 101,
                    type: 'resistencia',
                    value: '1k',
                    nodes: [1, 2], // R entre N1 y N2
                    params: {}
                },
                {
                    id: 102,
                    type: 'capacitor',
                    value: '1u',
                    nodes: [2, 0], // C entre N2 y GND
                    params: {}
                },
                {
                    id: 103,
                    type: 'fuente_corriente',
                    value: '0.001',
                    // Corriente de 1mA entra por N1 y sale por GND
                    nodes: [1, 0],
                    params: { dcOrAc: 'ac', phase: 0 }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' }
            ],
            obtenerNodoTierra: function () {
                const tierra = this.nodos.find(n => n.numero === 'GND' || n.id === 0);
                return tierra ? tierra.id : null;
            }
        };

        if (valores && Array.isArray(valores)) {
            circuitoMock.componentes.forEach(comp => {
                const valorEnviado = valores.find(v => v.id === comp.id);
                if (valorEnviado) comp.value = valorEnviado.valor;
            });
        }

        const componentesSim = circuitoMock.componentes.map(compData =>
            ComponentFactory.crearComponente(compData)
        );

        const circuitoSim = {
            id: circuitoMock.id,
            componentes: componentesSim,
            nodos: circuitoMock.nodos,
            obtenerNodoTierra: circuitoMock.obtenerNodoTierra
        };

        const paramsAC = params || {
            f_inicial: 10,
            f_final: 1e6,
            puntos: 100,
            tipo_barrido: 'log'
        };

        const motor = new MotorCalculos(circuitoSim);
        const resultado = await motor.ejecutarAnalisisAC(paramsAC);

        res.json(resultado);
    } catch (error) {
        console.error('Error en simulación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;