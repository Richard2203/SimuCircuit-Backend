const math = require('mathjs');
const LinearModel = require('./LinearModel');

class BJTModel extends LinearModel {
    /**
     * Modelo pequeña señal del BJT (pi-model):
     *   - rpi: resistencia base-emisor (beta/gm)
     *   - ro:  resistencia colector-emisor (VA/IC)
     *   - gm:  transconductancia (IC/VT)
     * nodes: [base, colector, emisor]
     */
    constructor(gm, rpi, ro, nodes) {
        super(nodes);
        this.gm  = gm;
        this.rpi = rpi;
        this.ro  = ro;
    }

    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        const [nB, nC, nE] = this.nodes;
        const iB = this._getNodeIndex(nB, nodeIndex);
        const iC = this._getNodeIndex(nC, nodeIndex);
        const iE = this._getNodeIndex(nE, nodeIndex);

        const addTo = (row, col, val) => {
            if (row === null || col === null) return;
            const cur = Y.get([row, col]);
            Y.set([row, col], math.add(cur, val));
        };

        // ── 1. Conductancia base-emisor: Ypi = 1/rpi ─────────────────────────
        const Ypi = math.complex(1 / this.rpi, 0);
        //   Corriente entra por B, sale por E  →  +Ypi en (B,B) y (E,E), -Ypi cruzados
        if (iB !== null) addTo(iB, iB,  Ypi);
        if (iE !== null) addTo(iE, iE,  Ypi);
        if (iB !== null && iE !== null) {
            addTo(iB, iE, math.unaryMinus(Ypi));
            addTo(iE, iB, math.unaryMinus(Ypi));
        }

        // ── 2. Conductancia colector-emisor: Yo = 1/ro ───────────────────────
        const Yo = math.complex(1 / this.ro, 0);
        if (iC !== null) addTo(iC, iC,  Yo);
        if (iE !== null) addTo(iE, iE,  Yo);
        if (iC !== null && iE !== null) {
            addTo(iC, iE, math.unaryMinus(Yo));
            addTo(iE, iC, math.unaryMinus(Yo));
        }

        // ── 3. Fuente de corriente controlada: Ic = gm*(VB - VE) ─────────────
        //   Corriente sale del nodo C y entra al nodo E
        //   Fila C: +gm*VB  −gm*VE
        //   Fila E: −gm*VB  +gm*VE
        const Gm = math.complex(this.gm, 0);

        if (iC !== null && iB !== null) addTo(iC, iB,  Gm);                     // +gm en (C,B)
        if (iC !== null && iE !== null) addTo(iC, iE,  math.unaryMinus(Gm));    // −gm en (C,E)
        if (iE !== null && iB !== null) addTo(iE, iB,  math.unaryMinus(Gm));    // −gm en (E,B)  ← bug corregido
        if (iE !== null && iE !== null) addTo(iE, iE,  Gm);                     // +gm en (E,E)
    }

    calcularCorriente(voltajes, omega) {
        // Retorna la corriente de colector: Ic = gm*(VB - VE) + (VC - VE)/ro
        const [nB, nC, nE] = this.nodes;
        const VB = voltajes[nB] || math.complex(0, 0);
        const VC = voltajes[nC] || math.complex(0, 0);
        const VE = voltajes[nE] || math.complex(0, 0);

        const Vbe  = math.subtract(VB, VE);
        const Vce  = math.subtract(VC, VE);
        const IcGm = math.multiply(math.complex(this.gm, 0), Vbe);
        const IcRo = math.divide(Vce, math.complex(this.ro, 0));
        return math.add(IcGm, IcRo);
    }
}

module.exports = BJTModel;
