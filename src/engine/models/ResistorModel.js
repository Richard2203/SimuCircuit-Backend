const math = require('mathjs');
const LinearModel = require('./LinearModel');

class ResistorModel extends LinearModel {
    constructor(resistance, nodes) {
        super(nodes);
        this.R = resistance; // ohms
    }

    contributeAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        const g = 1 / this.R;
        const Yval = math.complex(g, 0);
        const [n1, n2] = this.nodes;
        const i1 = this._getNodeIndex(n1, nodeIndex);
        const i2 = this._getNodeIndex(n2, nodeIndex);

        const addTo = (row, col, val) => {
            if (row === null || col === null) return;
            const current = Y.get([row, col]);
            const newVal = math.add(current, val);
            Y.set([row, col], newVal);
        };

        if (i1 !== null && i2 !== null) {
            addTo(i1, i1, Yval);
            addTo(i2, i2, Yval);
            addTo(i1, i2, math.multiply(-1, Yval));
            addTo(i2, i1, math.multiply(-1, Yval));
        } else if (i1 !== null) {
            addTo(i1, i1, Yval);
        } else if (i2 !== null) {
            addTo(i2, i2, Yval);
        }
    }

    computeCurrent(voltages, omega) {
        const [n1, n2] = this.nodes;
        const V1 = voltages[n1] || math.complex(0, 0);
        const V2 = voltages[n2] || math.complex(0, 0);
        const Z = math.complex(this.R, 0);
        return math.divide(math.subtract(V1, V2), Z);
    }
}

module.exports = ResistorModel;