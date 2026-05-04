const Component = require('./Component');

class TransistorFET extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_FET'; // Estandarizamos el modelo
        
        this.type = this.params?.tipo; // 'JFET' o 'MOSFET canal N o P'
        this.isNChannel = this.type.includes('_N');
        this.isJFET = this.type.includes('JFET');
        
        //Mapeo de las variables
        this.idss = this.params.idss ? parseFloat(this.params.idss) : 0.01;; // Corriente de drenaje máxima (IDSS)
        this.vp = this.params.vp ? parseFloat(this.params.vp) : (this.isNChannel ? 2.0 : -2.0); // Tensión de pinch-off (Vp)
        this.gm = this.params.gm ? parseFloat(this.params.gm) : 1.0; // Transconductancia máxima (gm0)
        this.rd = this.params.rd ? parseFloat(this.params.rd) : 1e6; // Resistencia de drenaje (Rd)
        this.configuration = this.params?.configuracion; // 'common-source', 'common-gate', 'common-drain'
        this.mode = this.params.modo_operacion; // 'cutoff', 'ohmic', 'saturation'
        this.isLinear = false;
        this.kp = this.gm / 2.0;
    }

    /**
     * Modelo Equivalente de Norton (Newton-Raphson) para el FET en DC.
     * Nodos esperados: [Gate, Drain, Source]
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        const [nG, nD, nS] = this.nodes;

        // Obtener voltajes adivinados de la iteración anterior
        const vG = lastVoltages[nG] !== undefined ? lastVoltages[nG] : 0;
        const vD = lastVoltages[nD] !== undefined ? lastVoltages[nD] : 0;
        const vS = lastVoltages[nS] !== undefined ? lastVoltages[nS] : 0;

        const p = this.isNChannel ? 1 : -1;

        let Vgs = (vG - vS) * p;
        let Vds = (vD - vS) * p;

        if (Vds < 0) Vds = 0; 
        if (Vgs > 30) Vgs = 30;
        if (Vgs < -30) Vgs = -30;

        // IMPORTANTE: Inicializamos gds como aislante puro
        let Ids = 0, gm = 0, gds = 1e-12; 

        // ==========================================
        // SELECTOR DE FÍSICA DE ESTADO SÓLIDO
        // ==========================================
        if (this.isJFET) {
            let Vp_norm = this.vp * p; 
            if (Vp_norm >= 0) Vp_norm = -2.0; 
            
            const Vgs_eff = Vgs - Vp_norm;

            if (Vgs <= Vp_norm) { // Corte
                Ids = 0; gm = 0; gds = 1e-12; 
            } else if (Vds < Vgs_eff) { // Óhmica
                const factor = (2 * this.idss) / Math.pow(Vp_norm, 2);
                Ids = factor * (Vgs_eff * Vds - 0.5 * Math.pow(Vds, 2));
                gm = factor * Vds;
                gds = factor * (Vgs_eff - Vds) + (1 / this.rd);
            } else { // Saturación
                const ratio = 1 - (Vgs / Vp_norm);
                Ids = this.idss * Math.pow(ratio, 2);
                gm = (-2 * this.idss / Vp_norm) * ratio;
                gds = 1e-12; // Ahora el FET actúa como verdadera fuente de corriente
            }
        } else {
            const Vth = Math.abs(this.vp); 
            const Vgs_eff = Vgs - Vth;

            if (Vgs_eff <= 0) { // Corte
                Ids = 0; gm = 0; gds = 1e-12;
            } else if (Vds < Vgs_eff) { // Óhmica
                Ids = this.kp * (2 * Vgs_eff * Vds - Math.pow(Vds, 2));
                gm = this.kp * 2 * Vds;
                gds = this.kp * 2 * (Vgs_eff - Vds) + (1 / this.rd);
            } else { // Saturación
                Ids = this.kp * Math.pow(Vgs_eff, 2);
                gm = 2 * this.kp * Vgs_eff;
                gds = 1e-12; // Ahora el FET actúa como verdadera fuente de corriente
            }
        }

        // ==========================================
        // ESTAMPADO EN MATRICES MNA
        // ==========================================

        if (gds < 1e-12) gds = 1e-12;
        const Ieq = Ids - (gm * Vgs) - (gds * Vds);

        const iG = this._idx ? this._idx(nG, nodeIndex) : (nodeIndex[nG] !== undefined ? nodeIndex[nG] : null);
        const iD = this._idx ? this._idx(nD, nodeIndex) : (nodeIndex[nD] !== undefined ? nodeIndex[nD] : null);
        const iS = this._idx ? this._idx(nS, nodeIndex) : (nodeIndex[nS] !== undefined ? nodeIndex[nS] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        // A. Resistencia Drain-Source interna (1/rd)
        if (iD !== null) sumarEnA(iD, iD, gds);
        if (iS !== null) sumarEnA(iS, iS, gds);
        if (iD !== null && iS !== null) { sumarEnA(iD, iS, -gds); sumarEnA(iS, iD, -gds); }

        // B. Fuente de corriente controlada (gm * Vgs)
        // Fluye de Drain a Source. Depende de Vg (+) y Vs (-)
        if (iD !== null && iG !== null) sumarEnA(iD, iG, gm);
        if (iD !== null && iS !== null) sumarEnA(iD, iS, -gm);
        if (iS !== null && iG !== null) sumarEnA(iS, iG, -gm);
        if (iS !== null && iS !== null) sumarEnA(iS, iS, gm);

        if (iD !== null) Z.set([iD, 0], Z.get([iD, 0]) - (Ieq * p));
        if (iS !== null) Z.set([iS, 0], Z.get([iS, 0]) + (Ieq * p));
    }

    calcularCorrienteDC(voltajes) {
        const [nG, nD, nS] = this.nodes;

        const vG = voltajes[nG] !== undefined ? (voltajes[nG].re ?? voltajes[nG]) : 0;
        const vD = voltajes[nD] !== undefined ? (voltajes[nD].re ?? voltajes[nD]) : 0;
        const vS = voltajes[nS] !== undefined ? (voltajes[nS].re ?? voltajes[nS]) : 0;

        const p = this.isNChannel ? 1 : -1;
        let Vgs = (vG - vS) * p;
        let Vds = (vD - vS) * p;

        if (Vds < 0) Vds = 0;

        let Ids = 0;

        if (this.isJFET) {
            let Vp_norm = this.vp * p; 
            if (Vp_norm >= 0) Vp_norm = -2.0; 
            
            if (Vgs > Vp_norm) {
                const Vgs_eff = Vgs - Vp_norm;
                if (Vds < Vgs_eff) {
                    const factor = (2 * this.idss) / Math.pow(Vp_norm, 2);
                    Ids = factor * (Vgs_eff * Vds - 0.5 * Math.pow(Vds, 2));
                } else {
                    Ids = this.idss * Math.pow(1 - (Vgs / Vp_norm), 2);
                }
            }
        } else {
            const Vth = Math.abs(this.vp);
            const Vgs_eff = Vgs - Vth;

            if (Vgs_eff > 0) {
                if (Vds < Vgs_eff) Ids = this.kp * (2 * Vgs_eff * Vds - Math.pow(Vds, 2));
                else Ids = this.kp * Math.pow(Vgs_eff, 2);
            }
        }

        return {
            Id: Ids * p,     
            Ig: 0,           
            Is: -Ids * p     
        };
    }
}

module.exports = TransistorFET;