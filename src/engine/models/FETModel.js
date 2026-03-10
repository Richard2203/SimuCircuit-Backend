const math = require('mathjs');
const LinearModel = require('./LinearModel');

class FETModel extends LinearModel {
    constructor(gm, rd, nodes) {
        super(nodes); // nodes: [gate, drain, source]
        this.gm = gm;
        this.rd = rd;
    }

    contributeAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        const [nG, nD, nS] = this.nodes;
        const iG = this._getNodeIndex(nG, nodeIndex);
        const iD = this._getNodeIndex(nD, nodeIndex);
        const iS = this._getNodeIndex(nS, nodeIndex);

        const addTo = (row, col, val) => {
            if (row === null || col === null) return;
            const current = Y.get([row, col]);
            const newVal = math.add(current, val);
            Y.set([row, col], newVal);
        };

        // Drain-source admittance: 1/rd
        if (this.rd && this.rd !== 0) {
            const Yds = math.complex(1 / this.rd, 0);
            if (iD !== null && iS !== null) {
                addTo(iD, iD, Yds);
                addTo(iS, iS, Yds);
                addTo(iD, iS, math.multiply(-1, Yds));
                addTo(iS, iD, math.multiply(-1, Yds));
            } else if (iD !== null) {
                addTo(iD, iD, Yds);
            } else if (iS !== null) {
                addTo(iS, iS, Yds);
            }
        }

        // Controlled source: gm * (V_G - V_S) from drain to source
        const gmComplex = math.complex(this.gm, 0);
        if (iD !== null && iG !== null) {
            addTo(iD, iG, gmComplex);
        }
        if (iD !== null && iS !== null) {
            addTo(iD, iS, math.multiply(-1, gmComplex));
        }
        if (iS !== null && iG !== null) {
            addTo(iS, iG, math.multiply(-1, gmComplex));
        }
        if (iS !== null && iS !== null) {
            addTo(iS, iS, gmComplex);
        }
    }

    computeCurrent(voltages, omega) {
        // TODO: implement if needed
        return math.complex(0, 0);
    }
}

module.exports = FETModel;