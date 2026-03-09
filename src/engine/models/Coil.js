const Component = require('./Component');
const math = require('mathjs');

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
}

module.exports = Coil;