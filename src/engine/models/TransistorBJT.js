const Component = require('./Component');

class TransistorBJT extends Component {
    constructor(data) {
        super(data);
        this.isLinear = false;
        this.modelValue = data.value;
        this.polarity = data.params?.polarity;
        this.configuration = data.params?.configuration;
        this.beta = data.params?.beta || 100;
        this.vbeSat = data.params?.vbeSat;
        this.vceSat = data.params?.vceSat;
        this.maxCurrentColector = data.params?.maxCurrentCollector;
        this.maxPower = data.params?.maxPower;
        this.transitionFrequency = data.params?.transitionFrequency;
        this.mode = data.params?.mode;
    }
    /**
     * Modelo Ebers-Moll Linealizado para Newton-Raphson en DC.
     * Nodos esperados: [Base, Colector, Emisor]
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        const [nB, nC, nE] = this.nodes;

        // 1. Obtener voltajes de la iteración anterior
        const vB = lastVoltages[nB] !== undefined ? lastVoltages[nB] : 0;
        const vC = lastVoltages[nC] !== undefined ? lastVoltages[nC] : 0;
        const vE = lastVoltages[nE] !== undefined ? lastVoltages[nE] : 0;

        let Vbe = vB - vE;
        let Vbc = vB - vC;

        // TRUCO SPICE: Clamp de voltajes para evitar que e^x reviente la matriz en las primeras iteraciones
        if (Vbe > 0.8) Vbe = 0.8;
        if (Vbe < -100) Vbe = -100;
        if (Vbc > 0.8) Vbc = 0.8;
        if (Vbc < -100) Vbc = -100;

        // 2. Constantes físicas del Transistor (Ebers-Moll)
        const Is = 1e-14; // Corriente de saturación inversa
        const Vt = 0.02585; // Voltaje térmico (25.85 mV)
        const betaF = this.beta || 100; // Ganancia en directa
        const betaR = 1; // Ganancia en inversa (típicamente 1)

        // 3. Cálculo de Corrientes Exponenciales
        const expVbe = Math.exp(Vbe / Vt);
        const expVbc = Math.exp(Vbc / Vt);

        // Corrientes de los "diodos" internos
        const Ibe = (Is / betaF) * (expVbe - 1);
        const Ibc = (Is / betaR) * (expVbc - 1);
        // Corriente de transporte (La magia del transistor)
        const Icc = Is * (expVbe - expVbc);

        // 4. Derivadas (Conductancias dinámicas para la Matriz A)
        let gbe = (Is / (betaF * Vt)) * expVbe;
        let gbc = (Is / (betaR * Vt)) * expVbc;
        let gmf = (Is / Vt) * expVbe; // Transconductancia directa
        let gmr = (Is / Vt) * expVbc; // Transconductancia inversa

        // Evitar ceros absolutos para matrices singulares
        if (gbe < 1e-12) gbe = 1e-12;
        if (gbc < 1e-12) gbc = 1e-12;

        // 5. Corrientes Equivalentes (Para el Vector Z)
        const Ibe_eq = Ibe - (gbe * Vbe);
        const Ibc_eq = Ibc - (gbc * Vbc);
        const Icc_eq = Icc - (gmf * Vbe) + (gmr * Vbc);

        // --- ESTAMPADO EN LA MATRIZ ---
        const iB = this._idx ? this._idx(nB, nodeIndex) : (nodeIndex[nB] !== undefined ? nodeIndex[nB] : null);
        const iC = this._idx ? this._idx(nC, nodeIndex) : (nodeIndex[nC] !== undefined ? nodeIndex[nC] : null);
        const iE = this._idx ? this._idx(nE, nodeIndex) : (nodeIndex[nE] !== undefined ? nodeIndex[nE] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        // A. Diodo Base-Emisor (gbe)
        if (iB !== null) sumarEnA(iB, iB, gbe);
        if (iE !== null) sumarEnA(iE, iE, gbe);
        if (iB !== null && iE !== null) { sumarEnA(iB, iE, -gbe); sumarEnA(iE, iB, -gbe); }

        // B. Diodo Base-Colector (gbc)
        if (iB !== null) sumarEnA(iB, iB, gbc);
        if (iC !== null) sumarEnA(iC, iC, gbc);
        if (iB !== null && iC !== null) { sumarEnA(iB, iC, -gbc); sumarEnA(iC, iB, -gbc); }

        // C. Fuentes controladas (El Transporte Icc fluye de Colector a Emisor)
        // Estampar gmf * Vbe (Corriente controlada por Vbe, sale de C, entra a E)
        if (iC !== null && iB !== null) sumarEnA(iC, iB, gmf);
        if (iC !== null && iE !== null) sumarEnA(iC, iE, -gmf);
        if (iE !== null && iB !== null) sumarEnA(iE, iB, -gmf);
        if (iE !== null && iE !== null) sumarEnA(iE, iE, gmf);

        // Estampar gmr * Vbc (Corriente controlada por Vbc, sale de E, entra a C)
        if (iE !== null && iB !== null) sumarEnA(iE, iB, gmr);
        if (iE !== null && iC !== null) sumarEnA(iE, iC, -gmr);
        if (iC !== null && iB !== null) sumarEnA(iC, iB, -gmr);
        if (iC !== null && iC !== null) sumarEnA(iC, iC, gmr);

        // D. Vector de Corrientes Z
        // Agrupamos las corrientes correctamente según la convención de nodos
        const I_B_eq = Ibe_eq + Ibc_eq;
        const I_C_eq = Icc_eq - Ibc_eq;
        const I_E_eq = -Icc_eq - Ibe_eq;

        // Estampamos restándolas del vector Z
        if (iB !== null) Z.set([iB, 0], Z.get([iB, 0]) - I_B_eq);
        if (iC !== null) Z.set([iC, 0], Z.get([iC, 0]) - I_C_eq);
        if (iE !== null) Z.set([iE, 0], Z.get([iE, 0]) - I_E_eq);
    }

    /**
     * Calcula las corrientes terminales reales una vez que convergió.
     */
    calcularCorrienteDC(voltajes) {
        const [nB, nC, nE] = this.nodes;
        const vB = voltajes[nB] !== undefined ? (voltajes[nB].re ?? voltajes[nB]) : 0;
        const vC = voltajes[nC] !== undefined ? (voltajes[nC].re ?? voltajes[nC]) : 0;
        const vE = voltajes[nE] !== undefined ? (voltajes[nE].re ?? voltajes[nE]) : 0;

        let Vbe = vB - vE;
        let Vbc = vB - vC;
        
        if (Vbe > 0.8) Vbe = 0.8;
        if (Vbc > 0.8) Vbc = 0.8;

        const Is = 1e-14;
        const Vt = 0.02585;
        const betaF = this.beta || 100;
        const betaR = 1;

        const expVbe = Math.exp(Vbe / Vt);
        const expVbc = Math.exp(Vbc / Vt);

        const Ibe = (Is / betaF) * (expVbe - 1);
        const Ibc = (Is / betaR) * (expVbc - 1);
        const Icc = Is * (expVbe - expVbc);

        return {
            Ib: Ibe + Ibc,
            Ic: Icc - Ibc,
            Ie: -Icc - Ibe
        };
    }
}

module.exports = TransistorBJT;