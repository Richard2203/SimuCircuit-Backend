const math = require('mathjs');
const LinearModel = require('./LinearModel');

class FETModel extends LinearModel {
    /**
     * Modelo pequeña señal del FET:
     *   - gm: transconductancia
     *   - rd: resistencia drain-source
     * nodes: [gate, drain, source]
     */
    constructor(gm, rd, nodes) {
        super(nodes);
        this.gm = gm;
        this.rd = rd;
    }

    aportarAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        const [nG, nD, nS] = this.nodes;
        const iG = this._getNodeIndex(nG, nodeIndex);
        const iD = this._getNodeIndex(nD, nodeIndex);
        const iS = this._getNodeIndex(nS, nodeIndex);

        const addTo = (row, col, val) => {
            if (row === null || col === null) return;
            const cur = Y.get([row, col]);
            Y.set([row, col], math.add(cur, val));
        };

        // ── 1. Conductancia drain-source: Yds = 1/rd ─────────────────────────
        if (this.rd && this.rd !== 0) {
            const Yds = math.complex(1 / this.rd, 0);
            if (iD !== null) addTo(iD, iD,  Yds);
            if (iS !== null) addTo(iS, iS,  Yds);
            if (iD !== null && iS !== null) {
                addTo(iD, iS, math.unaryMinus(Yds));
                addTo(iS, iD, math.unaryMinus(Yds));
            }
        }

        // ── 2. Fuente controlada: Id = gm*(VG - VS) ──────────────────────────
        //   Corriente sale de D, entra en S
        //   Fila D: +gm*VG  −gm*VS
        //   Fila S: −gm*VG  +gm*VS
        const Gm = math.complex(this.gm, 0);

        if (iD !== null && iG !== null) addTo(iD, iG,  Gm);
        if (iD !== null && iS !== null) addTo(iD, iS,  math.unaryMinus(Gm));
        if (iS !== null && iG !== null) addTo(iS, iG,  math.unaryMinus(Gm));
        if (iS !== null && iS !== null) addTo(iS, iS,  Gm);
    }

    calcularCorriente(voltajes, omega) {
        // Corriente de drenaje: Id = gm*(VG - VS) + (VD - VS)/rd
        const [nG, nD, nS] = this.nodes;
        const VG = voltajes[nG] || math.complex(0, 0);
        const VD = voltajes[nD] || math.complex(0, 0);
        const VS = voltajes[nS] || math.complex(0, 0);

        const Vgs  = math.subtract(VG, VS);
        const Vds  = math.subtract(VD, VS);
        const IdGm = math.multiply(math.complex(this.gm, 0), Vgs);
        const IdRd = this.rd ? math.divide(Vds, math.complex(this.rd, 0)) : math.complex(0, 0);
        return math.add(IdGm, IdRd);
    }
}

module.exports = FETModel;
