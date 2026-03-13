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
                  nodes: [1, 0], params: { dcOrAc: 'dc', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    //Circuito RC pero en DC para probar el comportamiento de los capacitores en DC (circuito abierto)
    static circuitoRCDC() {
        return {
            id: 2,
            nombre: 'Circuito RC (DC)',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'capacitor',   value: '1u', nodes: [2, 0], params: {} },
                { id: 103, type: 'fuente_voltaje', value: '5',
                  nodes: [1, 0], params: { dcOrAc: 'dc', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    static circuitoConDiodoDC() {
        return {
            id: 3,
            nombre: 'Circuito con diodo (DC)',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'diodo', value: '1N4148', nodes: [2, 0],
                  params: { forwardDrop: 0.7, maxCurrent: 0.1 } },
                { id: 103, type: 'fuente_voltaje', value: '5',
                  nodes: [1, 0], params: { dcOrAc: 'dc'} }
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
                    id: 'R1', type: 'resistencia', value: '1M',
                    nodes: [4, 1], params: {}           // Rb: BASE → VCC
                },
                {
                    id: 'R2', type: 'resistencia', value: '4.7k',
                    nodes: [4, 2], params: {}           // Rc: COLECTOR → VCC
                },
                {
                    id: '2N2222',
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
                    id: 'V1', type: 'fuente_voltaje', value: '12',
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
    static circuitoCuatroMallas() {
        return {
            id: 6,
            nombre: 'Circuito de 4 Mallas',
            componentes: [
                // Fuentes de Voltaje
                { id: 'V1', type: 'fuente_voltaje', value: '22', nodes: [3, 0], params: { dcOrAc: 'dc' } }, // V1
                { id: 'V2', type: 'fuente_voltaje', value: '18', nodes: [4, 1], params: { dcOrAc: 'dc' } }, // V2
                
                // Resistencias
                { id: 'R1', type: 'resistencia', value: '1k',   nodes: [6, 4], params: {} },
                { id: 'R2', type: 'resistencia', value: '1k',   nodes: [7, 5], params: {} },
                { id: 'R3', type: 'resistencia', value: '2.2k', nodes: [5, 2], params: {} },
                { id: 'R4', type: 'resistencia', value: '240',  nodes: [0, 1], params: {} },
                { id: 'R5', type: 'resistencia', value: '24',   nodes: [1, 2], params: {} },
                { id: 'R6', type: 'resistencia', value: '10k',  nodes: [3, 4], params: {} },
                { id: 'R7', type: 'resistencia', value: '4k',   nodes: [3, 6], params: {} },
                { id: 'R8', type: 'resistencia', value: '3.3k', nodes: [6, 7], params: {} },
                { id: 'R9', type: 'resistencia', value: '200',  nodes: [4, 5], params: {} }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' },
                { id: 3, numero: 'N3' },
                { id: 4, numero: 'N4' },
                { id: 5, numero: 'N5' },
                { id: 6, numero: 'N6' },
                { id: 7, numero: 'N7' }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    static circuitoConDiodoAC() {
        return {
            id: 7,
            nombre: 'Circuito con diodo (AC)',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'diodo', value: '1N4148', nodes: [2, 0],
                  params: { forwardDrop: 0.7, maxCurrent: 0.1 } },
                { id: 103, type: 'fuente_corriente', value: '0.001',
                  nodes: [1, 0], params: { dcOrAc: 'ac', phase: 0 } }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1'  },
                { id: 2, numero: 'N2'  }
            ],
            obtenerNodoTierra() { return 0; }
        };
    }

    static circuitoRCAC() {
        return {
            id: 8,
            nombre: 'Circuito RC (AC)',
            componentes: [
                { id: 101, type: 'resistencia', value: '1k', nodes: [1, 2], params: {} },
                { id: 102, type: 'capacitor',   value: '1u', nodes: [2, 0], params: {} },
                { id: 103, type: 'fuente_corriente', value: '0.001',
                  nodes: [1, 0], params: { dcOrAc: 'ac', phase: 0 } }
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