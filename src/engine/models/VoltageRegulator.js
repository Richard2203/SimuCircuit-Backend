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
        
        // let vTargetIdeal = 0;
        // let vTarget = 0;
        // let R_out = 0.01; // Súper conductancia (Transistor saturado o regulando)

        const isNegative = tipo.includes('negativo');

        // Asignación del Voltaje de Referencia Interno
        let V_ref = vNom; // Casos de cada Regulador: 5V, -5V, 12V, -12 V, 1.25V ó -1.25V

        // // 2. Lógica Universal de regulación y dropout
        // if (isNegative) {
        //     // --- REGULADORES NEGATIVOS (LM7905, LM337) ---
        //     if (tipo === 'lineal_ajustable_negativo') {
        //         vTargetIdeal = vGnd - 1.25; // Referencia interna negativa
        //     } else {
        //         vTargetIdeal = vGnd + vNom; // vNom ya es negativo (ej. -5V) -> vGnd - 5
        //     }
            
        //     // LÍMITE FÍSICO: El regulador intenta llegar a vTargetIdeal, PERO 
        //     // no puede entregar un voltaje más negativo que su (Entrada + Caída)
        //     vTarget = Math.max(vTargetIdeal, vIn + vDrop);
            
        //     // Si la entrada es tan pequeña que ni siquiera supera el GND, se apaga por completo
        //     if (vTarget >= vGnd) { 
        //         vTarget = vGnd;
        //         R_out = 1e6; // Alta impedancia
        //     }
        // } else {
        //     // --- REGULADORES POSITIVOS (LM7805, LM317) ---
        //     if (tipo === 'lineal_ajustable') {
        //         vTargetIdeal = vGnd + 1.25; // Referencia interna positiva
        //     } else {
        //         vTargetIdeal = vGnd + vNom; // Ej. vGnd + 5
        //     }
            
        //     // LÍMITE FÍSICO: El regulador intenta llegar a vTargetIdeal, PERO 
        //     // no puede entregar un voltaje más alto que su (Entrada - Caída)
        //     vTarget = Math.min(vTargetIdeal, vIn - vDrop);
            
        //     // Si la entrada es tan pequeña que ni siquiera supera el GND, se apaga por completo
        //     if (vTarget <= vGnd) { 
        //         vTarget = vGnd;
        //         R_out = 1e6; // Alta impedancia
        //     }
        // }

        // // 3. Modelo Equivalente de Norton
        // const G_out = 1 / R_out;
        // const I_eq = (vTarget - vGnd) * G_out

        // // 4. Balance de Corrientes (KCL en el pin IN)
        // // Calculamos la corriente que fluyó hacia la carga en la iteración pasada
        // const I_load_guess = I_eq - ((vOut - vGnd) * G_out);

        // // Calculamos la corriente de reposo (Iq) según la familia del regulador
        // let Iq = 0;
        // if (R_out < 1) { // Solo consume Iq si está encendido
        //     const magnitud = tipo.includes('ajustable') ? 0.00005 : 0.005; // 50uA para LM317, 5mA para fijos
        //     Iq = isNegative ? -magnitud : magnitud; // Para reguladores negativos
        // }

        // // La corriente total que la fuente debe entregar es la de la carga + el desperdicio del regulador
        // const I_in_total = I_load_guess + Iq;

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

        // // A. Forzar el voltaje de salida (Equivalente de Norton OUT -> GND)
        // if (iOut !== null) sumarEnA(iOut, iOut, G_out);
        // if (iGnd !== null) sumarEnA(iGnd, iGnd, G_out);
        // if (iOut !== null && iGnd !== null) {
        //     sumarEnA(iOut, iGnd, -G_out);
        //     sumarEnA(iGnd, iOut, -G_out);
        // }

        // // B. Inyectar I_eq desde GND hacia OUT
        // sumarEnZ(iOut, I_eq);
        // sumarEnZ(iGnd, -I_eq);

        // // C. Extraer la misma corriente desde IN hacia GND (BALANCE DE ENERGÍA)
        // // Si R_out es menor a 1 ohmio, el regulador está conduciendo corriente
        // if (R_out < 1) { 
        //     sumarEnZ(iIn, -I_in_total);
        //     sumarEnZ(iGnd, I_in_total);
        // }

        // ==========================================
        // EL NÚCLEO: AMPLIFICADOR DE TRANSCONDUCTANCIA
        // ==========================================
        let isRegulating = false;

         // Amplificador de transconductancia (VCVS Implícito)
        const Gm = 100; // Equivalente a 0.01 ohmios de resistencia de salida (Conductancia masiva de 100 Siemens)
        
        // Aplicamos el Límite Físico (Dropout) SOLO si el motor intenta pedir más de lo que la fuente tiene
        let TargetIdeal = vGnd + V_ref;
        let TargetReal = TargetIdeal;

        if (isNegative) {
            TargetReal = Math.max(TargetIdeal, vIn + vDrop);
            if (TargetReal < vGnd) isRegulating = true;
        } else {
            TargetReal = Math.min(TargetIdeal, vIn - vDrop);
            if (TargetReal > vGnd) isRegulating = true;
        }

        if (isRegulating) {
            // El regulador drena corriente de nIn y la manda a nOut
            if (iIn !== null) sumarEnA(iIn, iGnd, Gm);
            if (iIn !== null) sumarEnA(iIn, iOut, -Gm);
            sumarEnZ(iIn, -Gm * (TargetReal - vGnd)); // Usamos el Target limitado por Dropout

            if (iOut !== null) sumarEnA(iOut, iGnd, -Gm);
            if (iOut !== null) sumarEnA(iOut, iOut, Gm);
            sumarEnZ(iOut, Gm * (TargetReal - vGnd));
        } else {
            // Alta impedancia pura si el voltaje colapsa
            const G_off = 1e-6;
            if (iIn !== null) sumarEnA(iIn, iIn, G_off);
            if (iOut !== null) sumarEnA(iOut, iOut, G_off);
            if (iIn !== null && iOut !== null) {
                sumarEnA(iIn, iOut, -G_off);
                sumarEnA(iOut, iIn, -G_off);
            }
        }

        // KCL de la Corriente de Reposo (Iq)
        if (isRegulating) {
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

        // let vTargetIdeal = 0;
        // let vTarget = 0;
        // let R_out = 0.01; // Súper conductancia (Transistor saturado o regulando)
        const isNegative = tipo.includes('negativo');
        let V_ref = vNom; // Casos de cada Regulador: 5V, -5V, 12V, -12 V, 1.25V ó -1.25V

        let isRegulating = false;
        let TargetIdeal = vGnd + V_ref;
        let TargetReal = TargetIdeal;

        if (isNegative) {
            TargetReal = Math.max(TargetIdeal, vIn + vDrop);
            if (TargetReal < vGnd) isRegulating = true;
        } else {
            TargetReal = Math.min(TargetIdeal, vIn - vDrop);
            if (TargetReal > vGnd) isRegulating = true;
        }

        let I_out_real = 0;
        let Iq = 0;

        if (isRegulating) {
            const Gm = 100;
            I_out_real = Gm * (TargetReal - vOut);
            
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

        // // 2. Lógica Universal de regulación y dropout
        // if (isNegative) {
        //     // --- REGULADORES NEGATIVOS (LM7905, LM337) ---
        //     if (tipo === 'lineal_ajustable_negativo') {
        //         vTargetIdeal = vGnd - 1.25; // Referencia interna negativa
        //     } else {
        //         vTargetIdeal = vGnd + vNom; // vNom ya es negativo (ej. -5V) -> vGnd - 5
        //     }
            
        //     // LÍMITE FÍSICO: El regulador intenta llegar a vTargetIdeal, PERO 
        //     // no puede entregar un voltaje más negativo que su (Entrada + Caída)
        //     vTarget = Math.max(vTargetIdeal, vIn + vDrop);
            
        //     // Si la entrada es tan pequeña que ni siquiera supera el GND, se apaga por completo
        //     if (vTarget >= vGnd) { 
        //         vTarget = vGnd;
        //         R_out = 1e6; // Alta impedancia
        //     }
        // } else {
        //     // --- REGULADORES POSITIVOS (LM7805, LM317) ---
        //     if (tipo === 'lineal_ajustable') {
        //         vTargetIdeal = vGnd + 1.25; // Referencia interna positiva
        //     } else {
        //         vTargetIdeal = vGnd + vNom; // Ej. vGnd + 5
        //     }
            
        //     // LÍMITE FÍSICO: El regulador intenta llegar a vTargetIdeal, PERO 
        //     // no puede entregar un voltaje más alto que su (Entrada - Caída)
        //     vTarget = Math.min(vTargetIdeal, vIn - vDrop);
            
        //     // Si la entrada es tan pequeña que ni siquiera supera el GND, se apaga por completo
        //     if (vTarget <= vGnd) { 
        //         vTarget = vGnd;
        //         R_out = 1e6; // Alta impedancia
        //     }
        // }


        // // --- CÁLCULO DE LAS 3 CORRIENTES ---
        // // 1. Corriente que entregamos a la carga
        // const I_out_real = (vTarget - vOut) / R_out; 
        
        // // 2. Corriente de reposo
        // let Iq = 0;
        // if (R_out < 1) {
        //     const magnitud = tipo.includes('ajustable') ? 0.00005 : 0.005; // 50uA para LM317, 5mA para fijos
        //     Iq = isNegative ? -magnitud : magnitud; // Para reguladores negativos
        // }

        // // 3. Kirchhoff (La entrada suple a la salida y al reposo)
        // const I_in_real = I_out_real + Iq;

        // return {
        //     I_in: I_in_real,       // Positivo: Entra al pin IN desde la fuente
        //     I_out: I_out_real,    // Negativo: Sale del pin OUT hacia la carga
        //     I_gnd: Iq             // Negativo: Sale del pin GND hacia la tierra
        // };
    }
}

module.exports = VoltageRegulator;