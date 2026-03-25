const Component = require('./Component');

class VoltageRegulator extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_VOLTAGE_REGULATOR'; // Estandarizamos el modelo (ej. "lm 7805 " -> "LM7805")
        this.type = this.params.type; // Tipo específico de regulador de voltaje (por ejemplo, lineal o conmutado)
        this.outputVoltage = this.params.outputVoltage; // Voltaje de salida del regulador
        this.maxCurrent = this.params.maxCurrent; // Corriente máxima que el regulador puede suministrar
        this.minInputVoltage = this.params.minInputVoltage; // Voltaje mínimo de entrada requerido para el regulador
        this.maxInputVoltage = this.params.maxInputVoltage; // Voltaje máximo de entrada permitido para el regulador
        this.dropoutVoltage = this.params.dropoutVoltage; // Voltaje de caída mínimo para reguladores lineales
        this.maxDissipation = this.params.maxDissipation; // Potencia máxima que el regulador puede disipar sin dañarse
        this.tolerance = this.params.tolerance; // Tolerancia del voltaje de salida (por ejemplo, ±5%)
        this.isLinear = false;
    }
    /**
     * Modelo macro de SPICE para un Regulador Lineal en DC.
     * Nodos esperados: [IN, OUT, GND]
     */
    aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages) {
        // En caso de que el JSON no traiga nodos completos, protegemos el código
        if (!this.nodes || this.nodes.length < 3) return; 

        const [nIn, nOut, nGnd] = this.nodes;

        // 1. Obtener voltajes de la iteración anterior
        const vIn = lastVoltages[nIn] !== undefined ? lastVoltages[nIn] : 0;
        const vOut = lastVoltages[nOut] !== undefined ? lastVoltages[nOut] : 0;
        const vGnd = lastVoltages[nGnd] !== undefined ? lastVoltages[nGnd] : 0;

        // 2. Parámetros del regulador
        const targetV = this.outputVoltage || 5; // Por defecto un LM7805 (5V)
        const dropout = this.dropoutVoltage || 2; // Caída de tensión típica (2V)
        
        // Resistencia interna de salida cortocircuitada (Simula una fuente de voltaje ideal)
        const Rout = 0.01; 
        const Gout = 1 / Rout;

        // 3. Lógica de Regulación
        let vTargetReal = 0;
        const vDiff = vIn - vGnd;
        
        // ¿Hay suficiente voltaje a la entrada para mantener la regulación?
        if (vDiff >= targetV + dropout) {
            vTargetReal = targetV; // Regulando a la perfección
        } else if (vDiff > dropout) {
            vTargetReal = vDiff - dropout; // "Dropout" - El voltaje cae arrastrado por la entrada
        } else {
            vTargetReal = 0; // Apagado por falta de energía
        }

        // --- ESTAMPADO EN LA MATRIZ ---
        const iIn = this._idx ? this._idx(nIn, nodeIndex) : (nodeIndex[nIn] !== undefined ? nodeIndex[nIn] : null);
        const iOut = this._idx ? this._idx(nOut, nodeIndex) : (nodeIndex[nOut] !== undefined ? nodeIndex[nOut] : null);
        const iGnd = this._idx ? this._idx(nGnd, nodeIndex) : (nodeIndex[nGnd] !== undefined ? nodeIndex[nGnd] : null);

        const sumarEnA = (fila, col, valor) => {
            if (fila === null || col === null) return;
            A.set([fila, col], A.get([fila, col]) + valor);
        };

        // A. Forzar el voltaje de salida (Equivalente de Norton OUT -> GND)
        if (iOut !== null) sumarEnA(iOut, iOut, Gout);
        if (iGnd !== null) sumarEnA(iGnd, iGnd, Gout);
        if (iOut !== null && iGnd !== null) {
            sumarEnA(iOut, iGnd, -Gout);
            sumarEnA(iGnd, iOut, -Gout);
        }

        const Ieq = vTargetReal * Gout;
        if (iOut !== null) Z.set([iOut, 0], Z.get([iOut, 0]) + Ieq);
        if (iGnd !== null) Z.set([iGnd, 0], Z.get([iGnd, 0]) - Ieq);

        // B. Conservación de Energía (Lo que sale por OUT, debe entrar por IN)
        // Calculamos cuánta corriente está demandando la resistencia de carga
        const I_load = (vTargetReal - (vOut - vGnd)) * Gout; 
        
        // Extraemos esa misma corriente del nodo de entrada
        if (iIn !== null) Z.set([iIn, 0], Z.get([iIn, 0]) - I_load);
        if (iGnd !== null) Z.set([iGnd, 0], Z.get([iGnd, 0]) + I_load);
    }

    calcularCorrienteDC(voltajes) {
        if (!this.nodes || this.nodes.length < 3) return null;
        const [nIn, nOut, nGnd] = this.nodes;
        
        const vIn = voltajes[nIn] !== undefined ? (voltajes[nIn].re ?? voltajes[nIn]) : 0;
        const vOut = voltajes[nOut] !== undefined ? (voltajes[nOut].re ?? voltajes[nOut]) : 0;
        const vGnd = voltajes[nGnd] !== undefined ? (voltajes[nGnd].re ?? voltajes[nGnd]) : 0;

        const targetV = this.outputVoltage || 5;
        const dropout = this.dropoutVoltage || 2;
        const Rout = 0.01;

        let vTargetReal = 0;
        const vDiff = vIn - vGnd;
        if (vDiff >= targetV + dropout) vTargetReal = targetV;
        else if (vDiff > dropout) vTargetReal = vDiff - dropout;

        const I_load = (vTargetReal - (vOut - vGnd)) / Rout;

        return {
            I_in: I_load,          // Corriente que entra al regulador
            I_out: -I_load,        // Corriente que entrega al circuito
            I_gnd: 0               // Simplificación
        };
    }
}

module.exports = VoltageRegulator;