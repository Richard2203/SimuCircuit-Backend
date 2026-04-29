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
        this.modelValue = data.value;
        this.technology = this.params?.tipo;
        this.forwardDrop = this.params?.caida_tension; // Vf
        this.maxCurrent = this.params?.corriente_max;
        this.breakdownVoltage = this.params?.voltaje_inv_max;
        this.rz = this.params?.rz || 0; // Resistencia dinamica para los Zener
        this.is = this.params?.is_saturacion || 1e-14; // Ahora se considera la corriente Inversa de saturación
        // this.VT = 0.026; // tensión térmica a 300K
        // this.n = 1.0; // factor de idealidad
    }

        /**
     * Inyecta el modelo equivalente de Norton (Newton-Raphson) en cada iteración.
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        const [n1, n2] = this.nodes;
       
        const vA = lastVoltages[n1] !== undefined ? lastVoltages[n1] : 0;
        const vK = lastVoltages[n2] !== undefined ? lastVoltages[n2] : 0;

        let Vd = vA - vK;

        // 2. Extraer parámetros dinámicos del JSON
        // Si no viene caída de tensión, asumimos 0.7V (Silicio estándar)
        const vfEsperado = this.forwardDrop ? parseFloat(this.forwardDrop) : 0.7;
        const Is = this.forwardDrop ? parseFloat(this.is) : 1e-14; 
        const Vt = 0.02585; // Voltaje térmico a 300K

        // Ajustamos la curva (n) proporcionalmente a su Vf
        const n = (vfEsperado / 0.7);

        // 3. Reajuste, ya no se limita a 0.8V para todos los diodos.
        const limiteVd = vfEsperado + 0.3;
        if (Vd > limiteVd) Vd = limiteVd;
        if (Vd < -100) Vd = -100;

        // Extraemos el voltaje Zener si es que existe en los parámetros
        const Bv = this.breakdownVoltage ? parseFloat(this.breakdownVoltage) : null;
        let Id, Gd;

        // 3. Ecuación por Zonas (Ruptura Zener vs Comportamiento Normal)
        if (Bv !== null && Vd < -Bv) {
            // --- Zener (Ruptura Inversa) ---
            // Modelamos el Zener como una fuente de voltaje (Bv) en serie con una pequeña resistencia (Rz)
            const Rz = parseFloat(this.rz); // Resistencia dinámica del Zener obtenido de los parámetros
            Gd = 1 / Rz;
            Id = (Vd + Bv) / Rz; // Esto generará una corriente negativa fuerte
        } else {
            // --- Diodo Normal (Conducción Directa o Fuga Inversa) ---
            // Ecuación de Shockley
            // Id = Is * (e^(Vd / (n * Vt)) - 1)
            const expTerm = Math.exp(Vd / (n * Vt));
            Id = Is * (expTerm - 1);

            // Derivada de Shockley -> Conductancia Equivalente (Gd)
            // Gd = d(Id)/d(Vd)
            Gd = (Is / (n * Vt)) * expTerm;
            
            // Evitamos conductancia cero para que la matriz MNA no lance "Matriz Singular"
            if (Gd < 1e-12) Gd = 1e-12; 
        }

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
        const [n1, n2] = this.nodes;

        const vA = voltajes[n1] !== undefined ? (voltajes[n1].re ?? voltajes[n1]) : 0;
        const vK = voltajes[n2] !== undefined ? (voltajes[n2].re ?? voltajes[n2]) : 0;
        
        let Vd = vA - vK;

        const vfEsperado = this.forwardDrop ? parseFloat(this.forwardDrop) : 0.7;
        const Is = this.is ? parseFloat(this.is) : 1e-14;
        const n = (vfEsperado / 0.7);
        const Vt = 0.02585;

        const limiteVd = vfEsperado + 0.3;
        if (Vd > limiteVd) Vd = limiteVd;

        const Bv = this.breakdownVoltage ? parseFloat(this.breakdownVoltage) : null;

        // Misma lógica por zonas para el resultado final
        if (Bv !== null && Vd < -Bv) {
            const Rz = parseFloat(this.rz);
            return (Vd + Bv) / Rz;
        } else {
            return Is * (Math.exp(Vd / (n * Vt)) - 1);
        }
    }
}

module.exports = {
    Diode,
    LinearizedResistor,
    LinearizedOpenCircuit
};