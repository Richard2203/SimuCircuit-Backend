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

        /**
     * Inyecta el modelo equivalente de Norton (Newton-Raphson) en cada iteración.
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        // 1. Extracción Blindada de Nodos (Soporta JSON {n1, n2} y Arrays [n1, n2])
        const n1 = this.nodes.n1 !== undefined ? this.nodes.n1 : this.nodes[0];
        const n2 = this.nodes.n2 !== undefined ? this.nodes.n2 : this.nodes[1];

        // console.log(`Diodo ${this.id}: Voltajes anteriores -> n1(${n1})=${lastVoltages[n1] ?? 0}V, n2(${n2})=${lastVoltages[n2] ?? 0}V`);
       
        const vA = lastVoltages[n1] !== undefined ? lastVoltages[n1] : 0;
        const vK = lastVoltages[n2] !== undefined ? lastVoltages[n2] : 0;

        let Vd = vA - vK;

        // TRUCO SPICE: Evitar desbordamiento matemático
        // Si la iteración da un voltaje altísimo, e^(Vd) se vuelve Infinito y rompe Node.js.
        // Limitamos Vd a 0.8V solo para el cálculo temporal.
        if (Vd > 0.8) Vd = 0.8; 
        if (Vd < -100) Vd = -100;

        // 2. Constantes físicas del diodo
        const Is = this.params?.Is || 1e-14; // Corriente de saturación inversa (10 fA)
        const n = this.n || 1.0;             // Factor de idealidad
        const Vt = 0.02585;                  // Voltaje térmico a 300K (25.85 mV)

        // 3. Ecuación de Shockley
        // Id = Is * (e^(Vd / (n * Vt)) - 1)
        const expTerm = Math.exp(Vd / (n * Vt));
        const Id = Is * (expTerm - 1);

        // 4. Derivada de Shockley -> Conductancia Equivalente (Gd)
        // Gd = d(Id)/d(Vd)
        let Gd = (Is / (n * Vt)) * expTerm;

        // Evitamos conductancia cero para que la matriz MNA no lance "Matriz Singular" en inversa
        if (Gd < 1e-12) Gd = 1e-12; 

        // 5. Fuente de Corriente Equivalente (Ieq)
        // Ieq = Id - (Gd * Vd)
        const Ieq = Id - (Gd * Vd);

        // 6. --- ESTAMPAR EN MNA ---
        const iA = this._idx ? this._idx(n1, nodeIndex) : (nodeIndex[n1] !== undefined ? nodeIndex[n1] : null);
        const iK = this._idx ? this._idx(n2, nodeIndex) : (nodeIndex[n2] !== undefined ? nodeIndex[n2] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        // A. Estampar Gd como si fuera una resistencia normal
        if (iA !== null) sumarEnA(iA, iA, Gd);
        if (iK !== null) sumarEnA(iK, iK, Gd);
        if (iA !== null && iK !== null) {
            sumarEnA(iA, iK, -Gd);
            sumarEnA(iK, iA, -Gd);
        }

        // B. Estampar Ieq en el vector Z (La corriente va de Ánodo a Cátodo internamente)
        // Sale del Ánodo (-), Entra al Cátodo (+)
        if (iA !== null) {
            Z.set([iA, 0], Z.get([iA, 0]) - Ieq);
        }
        if (iK !== null) {
            Z.set([iK, 0], Z.get([iK, 0]) + Ieq);
        }
    }

    /**
     * Calcula la corriente final una vez que el circuito convergió.
     */
    calcularCorrienteDC(voltajes) {
        // Extracción blindada
        const n1 = this.nodes.n1 !== undefined ? this.nodes.n1 : this.nodes[0];
        const n2 = this.nodes.n2 !== undefined ? this.nodes.n2 : this.nodes[1];

        const vA = voltajes[n1] !== undefined ? (voltajes[n1].re ?? voltajes[n1]) : 0;
        const vK = voltajes[n2] !== undefined ? (voltajes[n2].re ?? voltajes[n2]) : 0;
        
        let Vd = vA - vK;
        
        // Respetamos el límite superior para la visualización de resultados
        if (Vd > 0.8) Vd = 0.8; 

        const Is = this.params?.Is || 1e-14;
        const n = this.n || 1.0;
        const Vt = 0.02585;

        return Is * (Math.exp(Vd / (n * Vt)) - 1);
    }
}

module.exports = {
    Diode,
    LinearizedResistor,
    LinearizedOpenCircuit
};