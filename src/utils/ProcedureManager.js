const parsearValorElectrico = require('../engine/utils/valueParser');
const { extraerValorDeResultados } = require('../utils/AnalisisUtils');

const ProcedureManager = {
    'ID_1': (netlist, resultado) => { 
        
        // Extraer valores NOMINALES de la netlist
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const R4_wiper = Math.min(0.999, Math.max(0.001, parsearValorElectrico(netlist.find(c => c.id === 'R4').params.wiper)));

        // Extraer Voltajes Nodales (YA CALCULADOS POR EL MNA)
        // Solo necesitamos formatearlos a 3 decimales para que se vean bien
        const V_N0 = 0; 
        const V_N1 = resultado.voltages['1'];
        const V_N2 = resultado.voltages['2'];
        const V_N3 = resultado.voltages['3'];

        // Extraer Corrientes (YA CALCULADAS POR EL MNA)
        const IR1 = resultado.currents['R1'];
        const IR2 = resultado.currents['R2'];
        const IR3 = resultado.currents['R3'];
        const I_total = resultado.voltageSourceCurrents['V1'] ? Math.abs(resultado.voltageSourceCurrents['V1']) : IR1;

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR2 = extraerValorDeResultados(resultado, 'R2', 'voltaje', netlist);
        const VR3 = extraerValorDeResultados(resultado, 'R3', 'voltaje', netlist);

        // Calcular opciones extras que no estan en el MNA
        const R4A = (R4 * R4_wiper);
        const R4B = (R4 * (1 - R4_wiper));
        const RP = Math.pow(1/R4B + 1/R2 + 1/R3, -1);
        const Req = Number(R1) + Number(R4A) + Number(RP);

        return {
            titulo: "Reducción de Resistencias junto con análisis de nodos",
            pasos: [
                {
                    paso: "0. Identificación de variables conocidas.",
                    calculos: [
                        `R1 = ${R1}Ω`, 
                        `R2 = ${R2}Ω`, 
                        `R3 = ${R3}Ω`, 
                        `R4 = ${R4}Ω`,
                        `Wiper de R4 (Porcentaje de giro del cursor) = ${R4_wiper}`,
                        `V1 = ${V1}V`
                    ]
                },
                {
                    paso: "1. Transformar el potenciómetro R4 a su equivalente PAR de resistencias.",
                    calculos: [
                        `R4A (Superior) = R4 * Wiper = ${R4A}Ω`,
                        `R4B (Inferior) = R4 * (1 - Wiper) = ${R4B}Ω`
                    ]
                },
                {
                    paso: "2. Obtener el valor equivalente de las resistencias en paralelo (Estas son R4B, R2 Y R3) y reducir el circuito con esta resistencia.",
                    calculos: [
                        `RP = (1/R4B + 1/R2 + 1/R3)^-1 = (1/${R4B} + 1/${R2} + 1/${R3})^-1 = ${RP}Ω`
                        ]
                    },
                {
                    paso: "3. Ahora con la fórmula de la resistencia equivalente total del circuito (en serie), calculamos la corriente total",
                    calculos: [
                        `I_total = V1 / Req = V1/(R1 + R4A + RP) = ${V1}V / ${Req}Ω = ${I_total}A`
                    ]
                },
                {
                    paso: "4. Mediante Análisis de Nodos, Ley de Ohm y Ley de Kirchhoff de Voltajes, resolvemos los potenciales eléctricos absolutos de cada nodo respecto a Tierra.",
                    calculos: [
                        `V_N0 (El voltaje del nodo Tierra siempre es de 0V) = ${V_N0}V`,
                        `V_N1 (El voltaje es la salida de la fuente) = ${V_N1}V`,
                        `V_N2 = V1 - VR1 = V1 - (R1 * I_total) = ${V_N2}V`,
                        `V_N3 (Recordemos que la resistencia RP proviene de las resistencias detalladas en el paso 2) = RP * I_total = ${V_N3}V`
                    ]
                },
                {
                    paso: "5. Con los voltajes nodales calculados, obtenemos las caídas de tensión (ΔV) por Ley de Kirchhoff de Voltajes",
                    calculos: [
                        `VR1 = V_N1 - V_N2 = ${VR1}V`,
                        `VR2 = VR3 = VR4B = V_N3 - V_N0 = ${VR2}V`,
                        `VR4A = V_N2 - V_N3 = ${V_N2-V_N3}V`,
                    ]
                },
                {
                    paso: "6. Finalmente, se calcula la corriente por cada rama utilizando la Ley de Ohm (I = ΔV / R).",
                    calculos: [
                        `IR1 (Corriente Total) = VR1 / R1 = ${IR1}A`,
                        `IR2 = VR2 / R2 = ${IR2}A`,
                        `IR3 = VR3 / R3 = ${IR3}A`,
                        `IR4A = VR4A / R3B = ${((V_N2-V_N3)/R4A)}A`,
                        `IR4B = VR4B / R4B = ${(VR3/R4B)}A`,
                    ]
                }
            ]
        };
    },
    'ID_2': (netlist, resultado) => {
        // Extraer valores NOMINALES de la netlist 
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);

        // Extraer Voltajes Nodales (YA CALCULADOS POR EL MNA)
        const V_N0 = 0;
        const V_N1 = resultado.voltages['1'];
        const V_N2 = resultado.voltages['2'];

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR2 = extraerValorDeResultados(resultado, 'R2', 'voltaje', netlist);
        const VR3 = extraerValorDeResultados(resultado, 'R3', 'voltaje', netlist);

        // Extraer Corrientes (YA CALCULADAS POR EL MNA)
        const IR1 = resultado.currents['R1'];
        const IR2 = resultado.currents['R2'];
        const IR3 = resultado.currents['R3'];

        return {
            titulo: "Análisis Nodal con Fuentes Independientes Múltiples",
            pasos: [
                {
                    paso: "0. Identificación de variables conocidas.",
                    calculos: [
                        `R1 = ${R1}Ω`,
                        `R2 = ${R2}Ω`, 
                        `R3 = ${R3}Ω`,
                        `V1 = ${V1}V`,
                        `I1 = ${I1}A`
                    ]
                },
                {
                    paso: "1. Planteamiento Teórico del Análisis Nodal (Leyes de Kirchhoff).",
                    calculos: [
                        "El circuito consta de 3 nodos principales. El Nodo 0 es nuestra referencia a tierra (0V).",
                        `El Nodo 1 está conectado a la fuente ideal V1, por lo que su voltaje es directamente V_N1 = ${V1}V.`,
                        "Para encontrar el voltaje desconocido del Nodo 2, se aplica la Ley de Corrientes de Kirchhoff (La suma de corrientes que salen de un nodo es igual a 0):",
                        "(V_N2 - V_N1) / R1  +  (V_N2 - V_N0) / R3  +  (V_N2 - V_N0) / R2  -  I1  =  0",
                        "Simplificando y sustitutendo valores conocidos...",
                        `V_N2 / ${R1} +  V_N2 / ${R3}  +  V_N2 / ${R2}  =  ${I1} + ${V_N1} / ${R1}`,
                        "Nota importante: La fuente I1 se resta en la ecuación porque su flecha indica que la corriente está ENTRANDO al Nodo 2, oponiéndose a las que salen. Dicho esto, pasa sumando al lado derecho de la ecuación"
                    ]
                },
                {
                    paso: "2. Resolución Matricial del Motor MNA.",
                    calculos: [
                        "Al hallar el valor de V_N2 de la ecuación nodal anterior, el motor matricial MNA despeja los potenciales absolutos:",
                        `V_N0 (Tierra) = ${V_N0}V`,
                        `V_N1 (Alimentación) = ${V_N1}V`,
                        `V_N2 = ${V_N2}V`
                    ]
                },
                {
                    paso: "3. Cálculo de Caídas de Tensión (ΔV).",
                    calculos: [
                        "Sabiendo el voltaje absoluto de cada nodo, la caída de voltaje en cada resistencia es simplemente la diferencia entre sus terminales (V_nodo_entrada - V_nodo_salida):",
                        `VR1 = V_N1 - V_N2 = ${V_N1}V - ${V_N2}V = ${VR1}V`,
                        `VR3 = V_N2 - V_N0 = ${V_N2}V - 0V = ${VR3}V`,
                        `VR2 = V_N2 - V_N0 = ${V_N2}V - 0V = ${VR2}V`
                    ]
                },
                {
                    paso: "4. Cálculo de Corrientes por Rama y Comprobación.",
                    calculos: [
                        "Aplicamos la Ley de Ohm (I = ΔV / R) a cada componente pasivo para encontrar su corriente:",
                        `IR1 = VR1 / R1 = ${VR1}V / ${R1}Ω = ${IR1}A`,
                        `IR3 = VR3 / R3 = ${VR3}V / ${R3}Ω = ${IR3}A`,
                        `IR2 = VR2 / R2 = ${VR2}V / ${R2}Ω = ${IR2}A`,
                        "Si verificamos el Nodo 2 de nuestro circuito simulado (Ambas sumas deben ser iguales):",
                        `Corrientes que entran (IR1 + I1) = ${IR1}A + ${I1}A = ${IR1 + I1}A`,
                        `Corrientes que salen (IR3 + IR2) = ${IR3}A + ${IR2}A = ${IR3 + IR2}A`
                    ]
                }
            ]
        };
    },
};

module.exports = ProcedureManager;