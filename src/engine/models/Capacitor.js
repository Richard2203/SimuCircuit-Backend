const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class Capacitor extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
        this.voltageRating = this.params?.voltageRating;
        this.dielectricType = this.params?.dielectricType;
        this.isPolarized = this.params?.isPolarized ?? false;
    }

    getImpedance(freq) {
        const omega = 2 * Math.PI * freq;
        const react = 1 / (omega * this.numericValue);
        return math.complex(0, -react); // Z = -j / (ωC)
    }

    /**
     * Admitancia Y = jωC.
     * Mismo estampado que Resistor pero con valor complejo.
     */
    aportarAC(Y, I, freq, nodosActivos, nodoTierra) {
        const Yval = math.divide(1, this.getImpedance(freq)); // jωC
        const [n1, n2] = this.nodes;
        const i1 = this._getIndiceNodo(n1, nodosActivos);
        const i2 = this._getIndiceNodo(n2, nodosActivos);

        console.log(`Capacitor ${this.id}: i1=${i1}, i2=${i2}, Yval=${math.format(Yval)}`);

        const sumarEn = (fila, col, valor) => {
            if (fila === null || col === null) return;
            const actual = Y.get([fila, col]);
            Y.set([fila, col], math.add(actual, valor));
        };

        if (i1 !== null && i2 !== null) {
            sumarEn(i1, i1, Yval);
            sumarEn(i2, i2, Yval);
            sumarEn(i1, i2, math.multiply(-1, Yval));
            sumarEn(i2, i1, math.multiply(-1, Yval));
        } else if (i1 !== null) {
            sumarEn(i1, i1, Yval);
        } else if (i2 !== null) {
            sumarEn(i2, i2, Yval);
        }
    }

    calcularCorriente(voltajes, freq) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] ?? math.complex(0, 0);
        const V2 = voltajes[n2] ?? math.complex(0, 0);
        const Z = this.getImpedance(freq);
        return math.divide(math.subtract(V1, V2), Z);
    }
}

module.exports = Capacitor;