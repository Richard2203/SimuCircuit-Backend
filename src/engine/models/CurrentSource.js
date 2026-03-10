const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class CurrentSource extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
        this.isActive  = this.params?.isActive ?? true;
        this.maxVoltage = this.params?.maxVoltage;
        this.dcOrAc    = this.params?.dcOrAc || 'ac';
        this.phase     = this.params?.phase  || 0;
    }

    /**
     * Convención de nodos: nodes = [nodo_positivo, nodo_negativo]
     * La corriente ENTRA por el nodo positivo (n1) y SALE por el negativo (n2).
     *
     * En análisis nodal MNA (convención de corrientes que salen del nodo):
     *   I[n1] += Ival   (corriente entra a n1 → contribución positiva al vector I)
     *   I[n2] -= Ival   (corriente sale de n2 → contribución negativa)
     *
     * Firma canónica: (Y, I, omega, activeNodes, groundNode, nodeIndex)
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        if (this.dcOrAc === 'dc') return;

        const Ival = math.complex({ r: this.numericValue, phi: this.phase });
        const [n1, n2] = this.nodes;
        const i1 = this._idx(n1, nodeIndex);
        const i2 = this._idx(n2, nodeIndex);

        // Corriente entra a n1 → suma en vector I de n1
        if (i1 !== null) {
            const actual = I.get([i1, 0]);
            I.set([i1, 0], math.add(actual, Ival));
        }
        // Corriente sale de n2 → resta en vector I de n2
        if (i2 !== null) {
            const actual = I.get([i2, 0]);
            I.set([i2, 0], math.subtract(actual, Ival));
        }
    }

    /**
     * La corriente de la fuente es su valor nominal (fasorial).
     * Signo positivo: corriente fluye de n1 hacia n2 dentro de la fuente.
     */
    calcularCorriente(voltajes, omega) {
        if (this.dcOrAc === 'dc') return math.complex(0, 0);
        return math.complex({ r: this.numericValue, phi: this.phase });
    }
}

module.exports = CurrentSource;
