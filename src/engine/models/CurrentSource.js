const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class CurrentSource extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
        this.isActive = this.params?.isActive ?? true;
        this.maxVoltage = this.params?.maxVoltage;
        this.dcOrAc = this.params?.dcOrAc || 'ac';
        this.phase = this.params?.phase || 0;
    }

    /**
     * Convención: nodes = [nodo_positivo, nodo_negativo]
     * La corriente entra al nodo positivo (n1) y sale del negativo (n2).
     * En análisis nodal: I[n1] += Ival, I[n2] -= Ival
     */
    aportarAC(Y, I, freq, nodosActivos, nodoTierra) {
        if (this.dcOrAc === 'dc') return;

        const Ival = math.complex({ r: this.numericValue, phi: this.phase });
        const [n1, n2] = this.nodes;
        const i1 = this._getIndiceNodo(n1, nodosActivos);
        const i2 = this._getIndiceNodo(n2, nodosActivos);

        if (i1 !== null) {
            const actual = I.get([i1, 0]);
            I.set([i1, 0], math.add(actual, Ival));
        }
        if (i2 !== null) {
            const actual = I.get([i2, 0]);
            I.set([i2, 0], math.subtract(actual, Ival));
        }
    }

    calcularCorriente(voltajes, freq) {
        if (this.dcOrAc === 'dc') return math.complex(0, 0);
        return math.complex({ r: this.numericValue, phi: this.phase });
    }
}

module.exports = CurrentSource;