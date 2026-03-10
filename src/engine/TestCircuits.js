const math = require('mathjs');

class TestCircuits {
    /**
     * Circuito básico: divisor de tensión resistivo
     * Nodos: 0 (tierra), 1, 2
     * Componentes:
     *   - Fuente de voltaje DC (no se usa en AC, pero la incluimos para DC)
     *   - Dos resistencias en serie
     * Para AC usamos fuente de corriente.
     */
    static divisorResistivo() {
        return {
            id: 1,
            nombre: 'Divisor resistivo',
            componentes: [
                {
                    id: 101,
                    type: 'resistencia',
                    value: '1k',
                    nodes: [1, 2],
                    params: {}
                },
                {
                    id: 102,
                    type: 'resistencia',
                    value: '2k',
                    nodes: [2, 0],
                    params: {}
                },
                {
                    id: 103,
                    type: 'fuente_corriente',
                    value: '0.001', // 1 mA
                    nodes: [0, 1],
                    params: { dcOrAc: 'ac', phase: 0 }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' }
            ],
            obtenerNodoTierra() {
                const tierra = this.nodos.find(n => n.numero === 'GND' || n.id === 0);
                return tierra ? tierra.id : null;
            }
        };
    }

    /**
     * Circuito RC (el que ya usamos)
     */
    static circuitoRC() {
        return {
            id: 2,
            nombre: 'Circuito RC',
            componentes: [
                {
                    id: 101,
                    type: 'resistencia',
                    value: '1k',
                    nodes: [1, 2],
                    params: {}
                },
                {
                    id: 102,
                    type: 'capacitor',
                    value: '1u',
                    nodes: [2, 0],
                    params: {}
                },
                {
                    id: 103,
                    type: 'fuente_corriente',
                    value: '0.001',
                    nodes: [0, 1],
                    params: { dcOrAc: 'ac', phase: 0 }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' }
            ],
            obtenerNodoTierra() {
                return 0;
            }
        };
    }

    /**
     * Circuito con diodo (requiere análisis DC previo)
     * Nota: para que funcione en AC, el diodo se linealizará.
     */
    static circuitoConDiodo() {
        return {
            id: 3,
            nombre: 'Circuito con diodo',
            componentes: [
                {
                    id: 101,
                    type: 'resistencia',
                    value: '1k',
                    nodes: [1, 2],
                    params: {}
                },
                {
                    id: 102,
                    type: 'diodo',
                    value: '1N4148',
                    nodes: [2, 0],
                    params: {
                        // Parámetros típicos (se usan en linealización)
                        forwardDrop: 0.7,
                        maxCurrent: 0.1
                    }
                },
                {
                    id: 103,
                    type: 'fuente_corriente',
                    value: '0.001',
                    nodes: [0, 1],
                    params: { dcOrAc: 'ac', phase: 0 }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' }
            ],
            obtenerNodoTierra() {
                return 0;
            }
        };
    }

    /**
     * Circuito con transistor BJT (configuración emisor común simplificada)
     * Nodos: 0 tierra, 1 base, 2 colector, 3 emisor (a tierra)
     * Resistencias: Rb entre 1 y fuente, Rc entre 2 y Vcc (nodo 4)
     * Fuente de corriente AC en base.
     */
    static circuitoBJT() {
        return {
            id: 4,
            nombre: 'Amplificador BJT',
            componentes: [
                {
                    id: 101,
                    type: 'resistencia',
                    value: '10k',
                    nodes: [1, 4], // Rb entre base y Vcc
                    params: {}
                },
                {
                    id: 102,
                    type: 'resistencia',
                    value: '4.7k',
                    nodes: [2, 4], // Rc entre colector y Vcc
                    params: {}
                },
                {
                    id: 103,
                    type: 'transistor_bjt',
                    value: '2N2222',
                    nodes: [1, 2, 3], // base, colector, emisor
                    params: {
                        beta: 100,
                        vbeSat: 0.7,
                        vceSat: 0.2,
                        maxCurrentColector: 0.8,
                        maxPower: 0.5,
                        transitionFrequency: 250 // MHz
                    }
                },
                {
                    id: 104,
                    type: 'fuente_corriente',
                    value: '0.0001', // 0.1 mA AC
                    nodes: [0, 1],
                    params: { dcOrAc: 'ac', phase: 0 }
                },
                {
                    id: 105,
                    type: 'fuente_voltaje', // Fuente DC de polarización
                    value: '12',
                    nodes: [4, 0],
                    params: { dcOrAc: 'dc' }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'BASE' },
                { id: 2, numero: 'COLECTOR' },
                { id: 3, numero: 'EMISOR' },
                { id: 4, numero: 'VCC' }
            ],
            obtenerNodoTierra() {
                return 0;
            }
        };
    }

    /**
     * Circuito para probar el solver en DC (Thevenin)
     * Dos resistencias y una fuente de voltaje.
     */
    static circuitoThevenin() {
        return {
            id: 5,
            nombre: 'Circuito para Thevenin',
            componentes: [
                {
                    id: 201,
                    type: 'resistencia',
                    value: '1k',
                    nodes: [1, 2],
                    params: {}
                },
                {
                    id: 202,
                    type: 'resistencia',
                    value: '2k',
                    nodes: [2, 0],
                    params: {}
                },
                {
                    id: 203,
                    type: 'fuente_voltaje',
                    value: '10',
                    nodes: [1, 0],
                    params: { dcOrAc: 'dc' }
                }
            ],
            nodos: [
                { id: 0, numero: 'GND' },
                { id: 1, numero: 'N1' },
                { id: 2, numero: 'N2' }
            ],
            obtenerNodoTierra() {
                return 0;
            }
        };
    }
}

module.exports = TestCircuits;