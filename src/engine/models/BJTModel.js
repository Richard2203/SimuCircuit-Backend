const math = require('mathjs');
const LinearModel = require('./LinearModel'); // base class

class BJTModel extends LinearModel {
    constructor(gm, rpi, ro, nodes) {
        super(nodes);
        this.gm = gm;
        this.rpi = rpi;
        this.ro = ro;
    }

    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        const [nB, nC, nE] = this.nodes;
        const iB = this._getNodeIndex(nB, nodeIndex);
        const iC = this._getNodeIndex(nC, nodeIndex);
        const iE = this._getNodeIndex(nE, nodeIndex);

        const addToMatrix = (row, col, val) => {
            if (row === null || col === null) return;
            const current = Y.get([row, col]);
            const newVal = math.add(current, val);
            Y.set([row, col], newVal);
        };

        // Base-emitter conductance: 1/rpi
        const Ypi = math.complex(1 / this.rpi, 0);
        if (iB !== null && iE !== null) {
            addToMatrix(iB, iB, Ypi);
            addToMatrix(iE, iE, Ypi);
            addToMatrix(iB, iE, math.multiply(-1, Ypi));
            addToMatrix(iE, iB, math.multiply(-1, Ypi));
        } else if (iB !== null) {
            addToMatrix(iB, iB, Ypi);
        } else if (iE !== null) {
            addToMatrix(iE, iE, Ypi);
        }

        // Collector-emitter conductance: 1/ro
        const Yo = math.complex(1 / this.ro, 0);
        if (iC !== null && iE !== null) {
            addToMatrix(iC, iC, Yo);
            addToMatrix(iE, iE, Yo);
            addToMatrix(iC, iE, math.multiply(-1, Yo));
            addToMatrix(iE, iC, math.multiply(-1, Yo));
        } else if (iC !== null) {
            addToMatrix(iC, iC, Yo);
        } else if (iE !== null) {
            addToMatrix(iE, iE, Yo);
        }

        // Controlled source: gm * (V_B - V_E) from collector to emitter
        const gmComplex = math.complex(this.gm, 0);
        if (iC !== null && iB !== null) {
            addToMatrix(iC, iB, gmComplex);
        }
        if (iC !== null && iE !== null) {
            addToMatrix(iC, iE, math.multiply(-1, gmComplex));
        }
        if (iE !== null && iB !== null) {
            addToMatrix(iE, iB, math.multiply(-1, gmComplex));
        }
        if (iE !== null && iE !== null) {
            addToMatrix(iE, iE, gmComplex);
        }
    }

    calcularCorriente(voltajes, omega) {
        // Placeholder – implement if needed
        return math.complex(0, 0);
    }
}

module.exports = BJTModel;