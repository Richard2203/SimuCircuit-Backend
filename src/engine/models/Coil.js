const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class Coil extends Component {
    constructor(data) {
        super(data);
        this.numericValue = data.numericValue; // en henrios
        this.maxCurrent = this.params?.maxCurrent;
        this.dcResistance = this.params?.dcResistance || 0;
    }

    getImpedance(freq) {
        const omega = 2 * Math.PI * freq;
        const react = omega * this.numericValue;
        return math.complex(this.dcResistance, react);
    }

    aportarAC(Y, I, freq, nodosActivos, nodoTierra) {
        const Z = this.getImpedance(freq);
        const Yval = math.divide(1, Z);
        const [n1, n2] = this.nodes;
        const i1 = this._getIndiceNodo(n1, nodosActivos);
        const i2 = this._getIndiceNodo(n2, nodosActivos);
        if (i1 !== null && i2 !== null) {
            Y.set([i1, i1], math.add(Y.get([i1, i1]), Yval));
            Y.set([i2, i2], math.add(Y.get([i2, i2]), Yval));
            Y.set([i1, i2], math.subtract(Y.get([i1, i2]), Yval));
            Y.set([i2, i1], math.subtract(Y.get([i2, i1]), Yval));
        } else if (i1 !== null) {
            Y.set([i1, i1], math.add(Y.get([i1, i1]), Yval));
        } else if (i2 !== null) {
            Y.set([i2, i2], math.add(Y.get([i2, i2]), Yval));
        }
    }

    calcularCorriente(voltajes, freq) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] || math.complex(0, 0);
        const V2 = voltajes[n2] || math.complex(0, 0);
        const Z = this.getImpedance(freq);
        return math.divide(math.subtract(V1, V2), Z);
    }

    /**
     * En DC, una bobina actúa como un cable (cortocircuito) con una resistencia mínima.
     */
    aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N) {
        // Usamos la resistencia del cable, o un valor minúsculo si es "ideal" para no romper la matriz
        const rDC = this.dcResistance > 0 ? this.dcResistance : 1e-6;
        const g = 1 / rDC;
        const [n1, n2] = this.nodes;

        const i1 = this._idx ? this._idx(n1, nodeIndex) : (nodeIndex[n1] !== undefined ? nodeIndex[n1] : null);
        const i2 = this._idx ? this._idx(n2, nodeIndex) : (nodeIndex[n2] !== undefined ? nodeIndex[n2] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = A.get([fila, col]);
            A.set([fila, col], actual + valor); // Suma real directa
        };

        if (i1 !== null) sumarEnA(i1, i1, g);
        if (i2 !== null) sumarEnA(i2, i2, g);
        if (i1 !== null && i2 !== null) {
            sumarEnA(i1, i2, -g);
            sumarEnA(i2, i1, -g);
        }
    }

    calcularCorrienteDC(voltajes) {
        const rDC = this.dcResistance > 0 ? this.dcResistance : 1e-6;
        const [n1, n2] = this.nodes;
        
        const v1 = voltajes[n1] !== undefined ? (voltajes[n1].re ?? voltajes[n1]) : 0;
        const v2 = voltajes[n2] !== undefined ? (voltajes[n2].re ?? voltajes[n2]) : 0;

        return (v1 - v2) / rDC;
    }

    // Para análisis transitorio, aportamos la conductancia equivalente y la corriente histórica según el método de Euler hacia atrás.
    aportarTransitorio(Y, Z, deltaT, corrienteAnterior, nodeIndex) {
        const L = parsearValorElectrico(this.value);
        
        // 1. Su Conductancia Equivalente (Geq = deltaT / L)
        // ¡Nota!: Está invertida respecto al capacitor
        const Geq = deltaT / L; 
        
        // 2. Su Corriente Equivalente Histórica (Ieq = I_anterior)
        // La bobina intenta mantener la misma corriente que tenía hace un milisegundo
        const Ieq = corrienteAnterior || 0;

        // 3. Estampar Geq en la matriz Y (como si fuera una resistencia de valor 1/Geq)
        const [n1, n2] = this.nodes; // Asumiendo n1 = Positivo, n2 = Negativo
        const i1 = nodeIndex[n1] !== undefined ? nodeIndex[n1] : null;
        const i2 = nodeIndex[n2] !== undefined ? nodeIndex[n2] : null;

        const sumarEnY = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = Y.get([fila, col]);
            Y.set([fila, col], actual + valor); // Suma real directa
        };

        if (i1 !== null && i2 !== null) {
            sumarEnY(i1, i1,  Geq);
            sumarEnY(i2, i2,  Geq);
            sumarEnY(i1, i2, -Geq);
            sumarEnY(i2, i1, -Geq);
        } else if (i1 !== null) {
            sumarEnY(i1, i1, Geq);
        } else if (i2 !== null) {
            sumarEnY(i2, i2, Geq);
        }

        // 4. Estampar Ieq en el vector Z 
        // OJO CON LOS SIGNOS: Para la bobina, la corriente histórica Ieq se 
        // OPONE al cambio. Por convención MNA, resta en el nodo positivo y suma en el negativo.
        if (i1 !== null) {
            const actual = Z.get([i1, 0]);
            Z.set([i1, 0], actual - Ieq); 
        }

        if (i2 !== null) {
            const actual = Z.get([i2, 0]);
            Z.set([i2, 0], actual + Ieq); 
        }
    }

    actualizarCorrienteTransitorio(voltajesActuales, delta_t, corrienteAnterior) {
        const L = parsearValorElectrico(this.value);
        
        // Extracción de nodos
        const [n1, n2] = this.nodes;
        
        const vPos = voltajesActuales[n1] !== undefined ? voltajesActuales[n1] : 0;
        const vNeg = voltajesActuales[n2] !== undefined ? voltajesActuales[n2] : 0;
        
        // Caída de voltaje real en la bobina en este milisegundo
        const vL = vPos - vNeg;

        // Calculamos la nueva corriente usando Backward Euler
        const iNueva = corrienteAnterior + (vL / L) * delta_t;
        
        return iNueva;
    }
}

module.exports = Coil;