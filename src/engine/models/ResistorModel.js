const math = require('mathjs');
const LinearModel = require('./LinearModel');

class ResistorModel extends LinearModel {
    constructor(resistance, nodes) {
        super(nodes);
        this.R = resistance; // ohms
    }

    aportarAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        const g    = 1 / this.R;
        const Yval = math.complex(g, 0);
        const [n1, n2] = this.nodes;
        const i1 = this._getNodeIndex(n1, nodeIndex);
        const i2 = this._getNodeIndex(n2, nodeIndex);

        const addTo = (row, col, val) => {
            if (row === null || col === null) return;
            const cur = Y.get([row, col]);
            Y.set([row, col], math.add(cur, val));
        };

        if (i1 !== null && i2 !== null) {
            addTo(i1, i1,  Yval);
            addTo(i2, i2,  Yval);
            addTo(i1, i2,  math.unaryMinus(Yval));
            addTo(i2, i1,  math.unaryMinus(Yval));
        } else if (i1 !== null) {
            addTo(i1, i1, Yval);
        } else if (i2 !== null) {
            addTo(i2, i2, Yval);
        }
    }

    calcularCorriente(voltajes, omega) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] || math.complex(0, 0);
        const V2 = voltajes[n2] || math.complex(0, 0);
        return math.divide(math.subtract(V1, V2), math.complex(this.R, 0));
    }
}

module.exports = ResistorModel;
