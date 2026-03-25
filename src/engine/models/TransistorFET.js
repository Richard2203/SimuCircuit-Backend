const Component = require('./Component');

class TransistorFET extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_FET'; // Estandarizamos el modelo
        this.type = this.params.type; // 'JFET' o 'MOSFET canal N o P'
        this.idss = this.params.idss; // Corriente de drenaje máxima (IDSS)
        this.vp = this.params.vp; // Tensión de pinch-off (Vp)
        this.gm = this.params.gm; // Transconductancia máxima (gm0)
        this.rd = this.params.rd; // Resistencia de drenaje (Rd)
        this.configuration = this.params.configuration; // 'common-source', 'common-gate', 'common-drain'
        this.mode = this.params.mode; // 'cutoff', 'ohmic', 'saturation'
        this.isLinear = false;
    }

    /**
     * Modelo Equivalente de Norton (Newton-Raphson) para el FET en DC.
     * Nodos esperados: [Gate, Drain, Source]
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        const [nG, nD, nS] = this.nodes;

        // 1. Obtener voltajes adivinados de la iteración anterior
        const vG = lastVoltages[nG] !== undefined ? lastVoltages[nG] : 0;
        const vD = lastVoltages[nD] !== undefined ? lastVoltages[nD] : 0;
        const vS = lastVoltages[nS] !== undefined ? lastVoltages[nS] : 0;

        let Vgs = vG - vS;
        
        // 2. Parámetros del FET (Por defecto asumimos un JFET Canal N)
        const idss = this.idss || 0.01; // Corriente máxima (10mA)
        const vp = this.vp || -2.0;     // Tensión de Pinch-off (-2V)
        const rd = this.rd || 1e6;      // Resistencia interna (1 Megaohmio)

        // Limitar Vgs para evitar que la matriz explote
        if (Vgs > 0.5) Vgs = 0.5; // Un JFET real no debe pasar de 0.6V en directa
        if (Vgs < vp - 1) Vgs = vp - 1; // Limitar por debajo de la zona de corte

        let Id = 0;
        let gm = 0;

        // 3. Evaluar la Región de Operación
        if (Vgs <= vp) {
            // Región de Corte (Apagado)
            Id = 0;
            gm = 1e-12; // Conductancia mínima para evitar matriz singular
        } else {
            // Región Activa / Saturación
            // Ecuación: Id = Idss * (1 - Vgs/Vp)^2
            const factor = 1 - (Vgs / vp);
            Id = idss * Math.pow(factor, 2);
            // Derivada (Transconductancia gm)
            gm = (-2 * idss / vp) * factor;
        }

        if (gm < 1e-12) gm = 1e-12; // Prevenir singularidad

        // 4. Corriente Equivalente (Ieq)
        const Ieq = Id - (gm * Vgs);

        // --- ESTAMPADO EN LA MATRIZ ---
        const iG = this._idx ? this._idx(nG, nodeIndex) : (nodeIndex[nG] !== undefined ? nodeIndex[nG] : null);
        const iD = this._idx ? this._idx(nD, nodeIndex) : (nodeIndex[nD] !== undefined ? nodeIndex[nD] : null);
        const iS = this._idx ? this._idx(nS, nodeIndex) : (nodeIndex[nS] !== undefined ? nodeIndex[nS] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        // A. Resistencia Drain-Source interna (1/rd)
        const gds = 1 / rd;
        if (iD !== null) sumarEnA(iD, iD, gds);
        if (iS !== null) sumarEnA(iS, iS, gds);
        if (iD !== null && iS !== null) { sumarEnA(iD, iS, -gds); sumarEnA(iS, iD, -gds); }

        // B. Fuente de corriente controlada (gm * Vgs)
        // Fluye de Drain a Source. Depende de Vg (+) y Vs (-)
        if (iD !== null && iG !== null) sumarEnA(iD, iG, gm);
        if (iD !== null && iS !== null) sumarEnA(iD, iS, -gm);
        if (iS !== null && iG !== null) sumarEnA(iS, iG, -gm);
        if (iS !== null && iS !== null) sumarEnA(iS, iS, gm);

        // C. Vector Z (Inyectar Ieq que sale de Drain y entra a Source)
        if (iD !== null) Z.set([iD, 0], Z.get([iD, 0]) - Ieq);
        if (iS !== null) Z.set([iS, 0], Z.get([iS, 0]) + Ieq);
    }

    calcularCorrienteDC(voltajes) {
        const [nG, nD, nS] = this.nodes;
        const vG = voltajes[nG] !== undefined ? (voltajes[nG].re ?? voltajes[nG]) : 0;
        const vD = voltajes[nD] !== undefined ? (voltajes[nD].re ?? voltajes[nD]) : 0;
        const vS = voltajes[nS] !== undefined ? (voltajes[nS].re ?? voltajes[nS]) : 0;

        let Vgs = vG - vS;
        const Vds = vD - vS;

        const idss = this.idss || 0.01;
        const vp = this.vp || -2.0;
        const rd = this.rd || 1e6;

        let Id_gm = 0;
        if (Vgs > vp) {
            Id_gm = idss * Math.pow(1 - (Vgs / vp), 2);
        }
        
        const Id_rd = Vds / rd;

        return {
            Ig: 0, // La compuerta no consume corriente
            Id: Id_gm + Id_rd,
            Is: -(Id_gm + Id_rd)
        };
    }
}

module.exports = TransistorFET;