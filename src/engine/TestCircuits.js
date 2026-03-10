const math = require('mathjs');

class TestCircuits {
    static divisorResistivo() {
        return {
            id: 1,
            nombre: 'Divisor resistivo',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'resistencia', value: '2k', nodes: [2, 0], params: {} },
                { id: 103, type: 'fuente_corriente', value: '0.001',
                  nodes: [0, 1], params: { dcOrAc: 'ac', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    static circuitoRC() {
        return {
            id: 2,
            nombre: 'Circuito RC',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'capacitor',   value: '1u', nodes: [2, 0], params: {} },
                { id: 103, type: 'fuente_corriente', value: '0.001',
                  nodes: [0, 1], params: { dcOrAc: 'ac', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    static circuitoConDiodo() {
        return {
            id: 3,
            nombre: 'Circuito con diodo',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'diodo', value: '1N4148', nodes: [2, 0],
                  params: { forwardDrop: 0.7, maxCurrent: 0.1 } },
                { id: 103, type: 'fuente_corriente', value: '0.001',
                  nodes: [0, 1], params: { dcOrAc: 'ac', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    /**
     * Amplificador BJT emisor común.
     *
     * Topología corregida:
     *   - Rb (10kΩ) entre BASE y VCC
     *   - Rc (4.7kΩ) entre COLECTOR y VCC
     *   - BJT: nodes = [BASE=1, COLECTOR=2, EMISOR=0]  ← emisor conectado a GND
     *   - Fuente AC (0.1mA) inyecta en BASE
     *   - Fuente DC (12V) fija VCC
     *
     * Con emisor en tierra la ganancia teórica es Av = -gm*(Rc||ro) ≈ -165
     */
    static circuitoBJT() {
        return {
            id: 4,
            nombre: 'Amplificador BJT emisor común',
            componentes: [
                {
                    id: 101, type: 'resistencia', value: '10k',
                    nodes: [1, 4], params: {}           // Rb: BASE → VCC
                },
                {
                    id: 102, type: 'resistencia', value: '4.7k',
                    nodes: [2, 4], params: {}           // Rc: COLECTOR → VCC
                },
                {
                    id: 103,
                    type: 'transistor_bjt',
                    value: '2N2222',
                    nodes: [1, 2, 0],                  // ← CORRECCIÓN: emisor a GND (nodo 0)
                    params: {
                        beta: 100,
                        vbeSat: 0.7,
                        vceSat: 0.2,
                        maxCurrentColector: 0.8,
                        maxPower: 0.5,
                        transitionFrequency: 250
                    }
                },
                {
                    id: 104, type: 'fuente_corriente', value: '0.0001',
                    nodes: [0, 1], params: { dcOrAc: 'ac', phase: 0 }
                },
                {
                    id: 105, type: 'fuente_voltaje', value: '12',
                    nodes: [4, 0], params: { dcOrAc: 'dc' }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND'      },
                { id: 1, numero: 'BASE'     },
                { id: 2, numero: 'COLECTOR' },
                { id: 4, numero: 'VCC'      }
                // nodo 3 (EMISOR) eliminado — el emisor va directo a GND (nodo 0)
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    /**
     * Circuito Thévenin — solo fuente DC → respuesta AC = 0 (correcto).
     */
    static circuitoThevenin() {
        return {
            id: 5,
            nombre: 'Circuito para Thevenin',
            componentes: [
                { id: 201, type: 'resistencia',  value: '1k', nodes: [1, 2], params: {} },
                { id: 202, type: 'resistencia',  value: '2k', nodes: [2, 0], params: {} },
                { id: 203, type: 'fuente_voltaje', value: '10',
                  nodes: [1, 0], params: { dcOrAc: 'dc' } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }
}

module.exports = TestCircuits;