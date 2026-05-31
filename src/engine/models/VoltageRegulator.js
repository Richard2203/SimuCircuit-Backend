const { parse } = require('dotenv');
const Component = require('./Component');

class VoltageRegulator extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_VOLTAGE_REGULATOR'; // Estandarizamos el modelo (ej. "lm 7805 " -> "LM7805")
        this.type = this.params?.tipo; // Tipo específico de regulador de voltaje (por ejemplo, lineal, ajustable o negativo)
        this.outputVoltage = this.params?.voltaje_salida; // Voltaje de salida del regulador
        this.maxCurrent = this.params?.corriente_maxima; // Corriente máxima que el regulador puede suministrar
        this.minInputVoltage = this.params?.voltaje_entrada_min; // Voltaje mínimo de entrada requerido para el regulador
        this.maxInputVoltage = this.params?.voltaje_entrada_max; // Voltaje máximo de entrada permitido para el regulador
        this.dropoutVoltage = this.params?.dropout_voltage; // Voltaje de caída mínimo para reguladores lineales
        this.maxDissipation = this.params?.disipacion_maxima; // Potencia máxima que el regulador puede disipar sin dañarse
        this.tolerance = this.params?.tolerancia; // Tolerancia del voltaje de salida (por ejemplo, ±5%)
        this.isLinear = false;
    }
    /**
     * Modelo macro de SPICE para un Regulador Lineal en DC.
     * Nodos esperados: [IN, OUT, GND]
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        // En caso de que el JSON no traiga nodos completos, protegemos el código
        if (!this.nodes || this.nodes.length < 3) return; 

        const [nIn, nOut, nGnd] = this.nodes; // nGnd actúa como ADJ en variables

        // Obtener voltajes de la iteración anterior
        const vIn = lastVoltages[nIn] !== undefined ? lastVoltages[nIn] : 0;
        const vOut = lastVoltages[nOut] !== undefined ? lastVoltages[nOut] : 0;
        const vGnd = lastVoltages[nGnd] !== undefined ? lastVoltages[nGnd] : 0;

        // Parámetros del regulador
        const tipo = this.type ? this.type.toLowerCase().replace(/\s+/g, '_') : 'lineal_fijo';
        const vNom = parseFloat(this.outputVoltage) || 5; // Por defecto un LM7805 (5V)
        const vDrop = parseFloat(this.dropoutVoltage) || 2; // Caída de tensión típica (2V)

        const isNegative = tipo.includes('negativo');

        // Asignación del Voltaje de Referencia Interno
        let V_ref = vNom; // Casos de cada Regulador: 5V, -5V, 12V, -12 V, 1.25V ó -1.25V

        // --- ESTAMPADO EN LA MATRIZ ---
        const iIn = this._idx ? this._idx(nIn, nodeIndex) : (nodeIndex[nIn] !== undefined ? nodeIndex[nIn] : null);
        const iOut = this._idx ? this._idx(nOut, nodeIndex) : (nodeIndex[nOut] !== undefined ? nodeIndex[nOut] : null);
        const iGnd = this._idx ? this._idx(nGnd, nodeIndex) : (nodeIndex[nGnd] !== undefined ? nodeIndex[nGnd] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        const sumarEnZ = (fila, valor) => {
            if (fila === null) return;
            Z.set([fila, 0], Z.get([fila, 0]) + valor);
        };

        // ==========================================
        // EL NÚCLEO: AMPLIFICADOR DE TRANSCONDUCTANCIA (ESTABILIZADO)
        // ==========================================
        const Gm = 100; // Conductancia masiva (0.01 ohmios)
        let TargetIdeal = vGnd + V_ref;
        let estado = 'OFF';

        // 1. Determinar el estado físico del regulador
        if (isNegative) {
            if (TargetIdeal >= vGnd) estado = 'OFF';
            else if (vIn + vDrop > TargetIdeal) estado = 'DROPOUT';
            else estado = 'REGULATING';
        } else {
            if (TargetIdeal <= vGnd) estado = 'OFF';
            else if (vIn - vDrop < TargetIdeal) estado = 'DROPOUT';
            else estado = 'REGULATING';
        }

        // 2. Estampar la matriz dinámicamente según el estado
        if (estado === 'REGULATING') {
            // Regulando idealmente: El objetivo depende exclusivamente de GND y V_ref
            if (iIn !== null) sumarEnA(iIn, iGnd, Gm);
            if (iIn !== null) sumarEnA(iIn, iOut, -Gm);
            sumarEnZ(iIn, -Gm * V_ref); 

            if (iOut !== null) sumarEnA(iOut, iGnd, -Gm);
            if (iOut !== null) sumarEnA(iOut, iOut, Gm);
            sumarEnZ(iOut, Gm * V_ref);

        } else if (estado === 'DROPOUT') {
            // Saturación: Actúa como una fuente de voltaje en serie con la entrada
            let dropVal = isNegative ? -vDrop : vDrop;
            
            if (iIn !== null) sumarEnA(iIn, iIn, Gm);
            if (iIn !== null) sumarEnA(iIn, iOut, -Gm);
            sumarEnZ(iIn, Gm * dropVal); 

            if (iOut !== null) sumarEnA(iOut, iIn, -Gm);
            if (iOut !== null) sumarEnA(iOut, iOut, Gm);
            sumarEnZ(iOut, -Gm * dropVal);

        } else {
            // OFF: Alta impedancia pura
            const G_off = 1e-6;
            if (iIn !== null) sumarEnA(iIn, iIn, G_off);
            if (iOut !== null) sumarEnA(iOut, iOut, G_off);
            if (iIn !== null && iOut !== null) {
                sumarEnA(iIn, iOut, -G_off);
                sumarEnA(iOut, iIn, -G_off);
            }
        }

        // KCL de la Corriente de Reposo (Iq)
        if (estado === 'REGULATING' || estado === 'DROPOUT') {
            const magnitudIq = tipo.includes('ajustable') ? 0.00005 : 0.005;
            const Iq = isNegative ? -magnitudIq : magnitudIq;
            sumarEnZ(iIn, -Iq);
            sumarEnZ(iGnd, Iq);
        }
    }

    calcularCorrienteDC(voltajes) {
        if (!this.nodes || this.nodes.length < 3) return null;
        const [nIn, nOut, nGnd] = this.nodes;
        
        const vIn = voltajes[nIn] !== undefined ? (voltajes[nIn].re ?? voltajes[nIn]) : 0;
        const vOut = voltajes[nOut] !== undefined ? (voltajes[nOut].re ?? voltajes[nOut]) : 0;
        const vGnd = voltajes[nGnd] !== undefined ? (voltajes[nGnd].re ?? voltajes[nGnd]) : 0;
        
        const tipo = this.type ? this.type.toLowerCase().replace(/\s+/g, '_') : 'lineal_fijo';
        const vNom = parseFloat(this.outputVoltage) || 5;
        const vDrop =  parseFloat(this.dropoutVoltage) || 2;

        const isNegative = tipo.includes('negativo');
        let V_ref = vNom; // Casos de cada Regulador: 5V, -5V, 12V, -12 V, 1.25V ó -1.25V

        let estado = 'OFF';
        let TargetIdeal = vGnd + V_ref;

        if (isNegative) {
            if (TargetIdeal >= vGnd) estado = 'OFF';
            else if (vIn + vDrop > TargetIdeal) estado = 'DROPOUT';
            else estado = 'REGULATING';
        } else {
            if (TargetIdeal <= vGnd) estado = 'OFF';
            else if (vIn - vDrop < TargetIdeal) estado = 'DROPOUT';
            else estado = 'REGULATING';
        }

        let I_out_real = 0;
        let Iq = 0;

        if (estado === 'REGULATING') {
            const Gm = 100;
            I_out_real = Gm * (vGnd + V_ref - vOut);
            const magnitudIq = tipo.includes('ajustable') ? 0.00005 : 0.005;
            Iq = isNegative ? -magnitudIq : magnitudIq;
        } else if (estado === 'DROPOUT') {
            const Gm = 100;
            let dropVal = isNegative ? -vDrop : vDrop;
            I_out_real = Gm * (vIn - dropVal - vOut);
            const magnitudIq = tipo.includes('ajustable') ? 0.00005 : 0.005;
            Iq = isNegative ? -magnitudIq : magnitudIq;
        } else {
            const G_off = 1e-6;
            I_out_real = (vIn - vOut) * G_off;
        }

        return {
            I_in: I_out_real + Iq,
            I_out: I_out_real,
            I_gnd: Iq
        };
    }
}

module.exports = VoltageRegulator;