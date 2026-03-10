const Component = require('./Component');
const math = require('mathjs');

/**
 * Modelo lineal de una resistencia (para diodo en directa)
 * Compatible con la firma esperada por ACAnalysis.
 */
class LinearizedResistor {
    /**
     * @param {number} resistance - Valor de la resistencia en ohmios
     * @param {number[]} nodes - [ánodo, cátodo]
     */
    constructor(resistance, nodes) {
        this.resistance = resistance;
        this.nodes = nodes;
        this.id = 'linearized_' + nodes.join('_');
    }

    /**
     * Aporta la admitancia de la resistencia a la matriz Y.
     * @param {math.Matrix} Y - Matriz de admitancias
     * @param {math.Matrix} I - Vector de corrientes (no se usa)
     * @param {number} omega - Frecuencia angular (rad/s)
     * @param {Object[]} activeNodes - Lista de nodos activos (con id)
     * @param {number|string} groundNode - ID del nodo tierra
     * @param {Object} nodeIndex - Mapa id_nodo -> índice en la matriz
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        const g = 1 / this.resistance;
        const Yval = math.complex(g, 0);
        const [n1, n2] = this.nodes;
        const i1 = nodeIndex[n1] !== undefined ? nodeIndex[n1] : null;
        const i2 = nodeIndex[n2] !== undefined ? nodeIndex[n2] : null;

        const addToMatrix = (row, col, val) => {
            if (row === null || col === null) return;
            const current = Y.get([row, col]);
            Y.set([row, col], math.add(current, val));
        };

        if (i1 !== null && i2 !== null) {
            addToMatrix(i1, i1, Yval);
            addToMatrix(i2, i2, Yval);
            addToMatrix(i1, i2, math.multiply(-1, Yval));
            addToMatrix(i2, i1, math.multiply(-1, Yval));
        } else if (i1 !== null) {
            addToMatrix(i1, i1, Yval);
        } else if (i2 !== null) {
            addToMatrix(i2, i2, Yval);
        }
    }

    /**
     * Calcula la corriente fasorial a través de la resistencia.
     * @param {Object} voltages - Mapa id_nodo -> complejo
     * @param {number} omega - Frecuencia angular (no usada)
     * @returns {math.Complex} Corriente fasorial
     */
    calcularCorriente(voltages, omega) {
        const [n1, n2] = this.nodes;
        const V1 = voltages[n1] || math.complex(0, 0);
        const V2 = voltages[n2] || math.complex(0, 0);
        const Z = math.complex(this.resistance, 0);
        return math.divide(math.subtract(V1, V2), Z);
    }
}

/**
 * Modelo lineal de circuito abierto (para diodo en inversa)
 */
class LinearizedOpenCircuit {
    constructor(nodes) {
        this.nodes = nodes;
    }
    aportarAC() {}
    calcularCorriente() { return math.complex(0, 0); }
}

/**
 * Clase principal del diodo (no lineal)
 */
class Diode extends Component {
    constructor(data) {
        super(data);
        this.isLinear = false;
        this.modelValue = data.modelValue;
        this.technology = this.params?.technology;
        this.forwardDrop = this.params?.forwardDrop; // Vf
        this.maxCurrent = this.params?.maxCurrent;
        this.breakdownVoltage = this.params?.breakdownVoltage;
        this.VT = 0.026; // tensión térmica a 300K
        this.n = 1.0; // factor de idealidad
    }
}

module.exports = {
    Diode,
    LinearizedResistor,
    LinearizedOpenCircuit
};