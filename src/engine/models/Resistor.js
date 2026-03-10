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
}

module.exports = Resistor;