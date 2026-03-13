const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class Capacitor extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
        this.voltageRating  = this.params?.voltageRating;
        this.dielectricType = this.params?.dielectricType;
        this.isPolarized    = this.params?.isPolarized ?? false;
    }

    /**
     * Impedancia del capacitor: Z = 1 / (jωC) = -j / (ωC)
     * @param {number} omega - Frecuencia angular (rad/s)  ← ya NO es freq
     */
    getImpedance(omega) {
        if (omega === 0) return math.complex(Infinity, 0); // DC: circuito abierto
        const react = 1 / (omega * this.numericValue);
        return math.complex(0, -react); // Z = -j/(ωC)
    }

    /**
     * Estampa admitancia Y = jωC en la matriz Y.
     * Firma canónica: (Y, I, omega, activeNodes, groundNode, nodeIndex)
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        // Y_cap = 1/Z = jωC
        const Yval = math.divide(math.complex(1, 0), this.getImpedance(omega));
        const [n1, n2] = this.nodes;
        const i1 = nodeIndex[n1] !== undefined ? nodeIndex[n1] : null;
        const i2 = nodeIndex[n2] !== undefined ? nodeIndex[n2] : null;

        console.log(`Capacitor ${this.id}: i1=${i1}, i2=${i2}, Yval=${math.format(Yval)}`);

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
     * @param {number} omega    - Frecuencia angular (rad/s) — se pasa directo a getImpedance
     */
    calcularCorriente(voltajes, omega) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] ?? math.complex(0, 0);
        const V2 = voltajes[n2] ?? math.complex(0, 0);
        const Z  = this.getImpedance(omega);
        return math.divide(math.subtract(V1, V2), Z);
    }

/**
     * En DC, un capacitor ideal es un circuito abierto, lo que causa matrices Singulares.
     * Aplicamos el truco SPICE (Gmin) agregando una resistencia de fuga de 1 TeraOhmio.
     */
    aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N) {
        const gFuga = 1e-12; // 1 picoSiemens (Fuga del dieléctrico)
        const [n1, n2] = this.nodes;

        const i1 = this._idx ? this._idx(n1, nodeIndex) : (nodeIndex[n1] !== undefined ? nodeIndex[n1] : null);
        const i2 = this._idx ? this._idx(n2, nodeIndex) : (nodeIndex[n2] !== undefined ? nodeIndex[n2] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = A.get([fila, col]);
            A.set([fila, col], actual + valor);
        };

        if (i1 !== null) sumarEnA(i1, i1, gFuga);
        if (i2 !== null) sumarEnA(i2, i2, gFuga);
        if (i1 !== null && i2 !== null) {
            sumarEnA(i1, i2, -gFuga);
            sumarEnA(i2, i1, -gFuga);
        }
    }

    calcularCorrienteDC(voltajes) {
        return 0; // Al estar completamente cargado y en circuito abierto, la corriente es nula.
    }
}

module.exports = Capacitor;