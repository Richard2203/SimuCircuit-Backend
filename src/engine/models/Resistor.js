const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class Resistor extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
    }

    getImpedance(omega) {
        // La resistencia es independiente de la frecuencia
        return math.complex(this.numericValue, 0);
    }

    /**
     * Estampa conductancia G = 1/R en la matriz Y.
     * Firma canónica: (Y, I, omega, activeNodes, groundNode, nodeIndex)
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        const g    = 1 / this.numericValue;
        const Yval = math.complex(g, 0);
        const [n1, n2] = this.nodes;
        const i1 = nodeIndex[n1] !== undefined ? nodeIndex[n1] : null;
        const i2 = nodeIndex[n2] !== undefined ? nodeIndex[n2] : null;

        console.log(`Resistor ${this.id}: i1=${i1}, i2=${i2}, Yval=${math.format(Yval)}`);

        const sumarEn = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = Y.get([fila, col]);
            Y.set([fila, col], math.add(actual, valor));
        };

        if (i1 !== null && i2 !== null) {
            sumarEn(i1, i1,  Yval);
            sumarEn(i2, i2,  Yval);
            sumarEn(i1, i2,  math.unaryMinus(Yval));
            sumarEn(i2, i1,  math.unaryMinus(Yval));
        } else if (i1 !== null) {
            sumarEn(i1, i1, Yval);
        } else if (i2 !== null) {
            sumarEn(i2, i2, Yval);
        }
    }
        /**
     * @param {Object} voltajes - Mapa id_nodo -> complejo
     * @param {number} omega    - Frecuencia angular (rad/s) — no usada en R, pero firma uniforme
     */
    calcularCorriente(voltajes, omega) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] ?? math.complex(0, 0);
        const V2 = voltajes[n2] ?? math.complex(0, 0);
        return math.divide(math.subtract(V1, V2), math.complex(this.numericValue, 0));
    }

    /**
     * Estampa conductancia G = 1/R en la submatriz principal de DC.
     * Firma: (A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N)
     */
    aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N) {
        const g = 1 / this.numericValue;
        const [n1, n2] = this.nodes;
        
        // Usamos el helper _idx para encontrar las filas/columnas
        const i1 = this._idx ? this._idx(n1, nodeIndex) : (nodeIndex[n1] !== undefined ? nodeIndex[n1] : null);
        const i2 = this._idx ? this._idx(n2, nodeIndex) : (nodeIndex[n2] !== undefined ? nodeIndex[n2] : null);

        // Helper local para sumar en la matriz de números reales
        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = A.get([fila, col]);
            A.set([fila, col], actual + valor);
        };

        if (i1 !== null) sumarEnA(i1, i1, g);
        if (i2 !== null) sumarEnA(i2, i2, g);
        if (i1 !== null && i2 !== null) {
            sumarEnA(i1, i2, -g);
            sumarEnA(i2, i1, -g);
        }
    }

    calcularCorrienteDC(voltajes) {
        const [n1, n2] = this.nodes;
        // En DC manejamos números reales, pero si mathjs devuelve un objeto complejo con parte imaginaria 0, sacamos .re
        const v1 = voltajes[n1] !== undefined ? (voltajes[n1].re ?? voltajes[n1]) : 0;
        const v2 = voltajes[n2] !== undefined ? (voltajes[n2].re ?? voltajes[n2]) : 0;
        
        return (v1 - v2) / this.numericValue;
    }
}

module.exports = Resistor;