const parsearValorElectrico = require('../engine/utils/valueParser');
const formatoIngenieria = require('../engine/utils/antiParser');
const { extraerValorDeResultados } = require('../utils/AnalisisUtils');
const math = require('mathjs'); // Indispensable para manejar los fasores

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
        const V_N0 = resultado.voltages['0']; 
        const V_N1 = resultado.voltages['1'];
        const V_N2 = resultado.voltages['2'];
        const V_N3 = resultado.voltages['3'];

        // Extraer Corrientes (YA CALCULADAS POR EL MNA)
        const IR1 = resultado.currents['R1'];
        const IR2 = resultado.currents['R2'];
        const IR3 = resultado.currents['R3'];
        const IR4A = resultado.currents['R4_AW'];
        const IR4B = resultado.currents['R4_WB'];
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

        const VR4A = V_N2 - V_N3;
        const VR4B = VR2;

        return {
            titulo: "Reducción de Resistencias junto con análisis de nodos",
            pasos: [
                {
                    paso: "0. Identificación de variables conocidas.",
                    calculos: [
                        `R1 = ${formatoIngenieria(R1, 'Ω')}`, 
                        `R2 = ${formatoIngenieria(R2, 'Ω')}`, 
                        `R3 = ${formatoIngenieria(R3, 'Ω')}`, 
                        `R4 = ${formatoIngenieria(R4, 'Ω')}`,
                        `Wiper de R4 (Porcentaje de giro del cursor) = ${R4_wiper}`,
                        `V1 = ${formatoIngenieria(V1, 'V')}`
                    ]
                },
                {
                    paso: "1. Transformar el potenciómetro R4 a su equivalente PAR de resistencias.",
                    calculos: [
                        `R4A (Superior) = R4 * Wiper = ${formatoIngenieria(R4A, 'Ω')}`,
                        `R4B (Inferior) = R4 * (1 - Wiper) = ${formatoIngenieria(R4B, 'Ω')}`
                    ]
                },
                {
                    paso: "2. Obtener el valor equivalente de las resistencias en paralelo (Estas son R4B, R2 Y R3) y reducir el circuito con esta resistencia.",
                    calculos: [
                        `RP = (1/R4B + 1/R2 + 1/R3)^-1 = (1/${formatoIngenieria(R4B, 'Ω')} + 1/${formatoIngenieria(R2, 'Ω')} + 1/${formatoIngenieria(R3, 'Ω')})^-1 = ${formatoIngenieria(RP, 'Ω')}`
                        ]
                    },
                {
                    paso: "3. Ahora con la fórmula de la resistencia equivalente total del circuito (en serie), calculamos la corriente total",
                    calculos: [
                        `I_total = V1 / Req = V1/(R1 + R4A + RP) = ${formatoIngenieria(V1, 'V')} / ${formatoIngenieria(Req, 'Ω')} = ${formatoIngenieria(I_total, 'A')}`
                    ]
                },
                {
                    paso: "4. Mediante Análisis de Nodos, Ley de Ohm y Ley de Kirchhoff de Voltajes, resolvemos los potenciales eléctricos absolutos de cada nodo respecto a Tierra.",
                    calculos: [
                        `V_N0 (El voltaje del nodo Tierra siempre es de 0V) = ${formatoIngenieria(V_N0, 'V')}`,
                        `V_N1 (El voltaje es la salida de la fuente) = ${formatoIngenieria(V_N1, 'V')}`,
                        `V_N2 = V1 - VR1 = V1 - (R1 * I_total) = ${formatoIngenieria(V_N2, 'V')}`,
                        `V_N3 (Recordemos que la resistencia RP proviene de las resistencias detalladas en el paso 2) = RP * I_total = ${formatoIngenieria(V_N3, 'V')}`
                    ]
                },
                {
                    paso: "5. Con los voltajes nodales calculados, obtenemos las caídas de tensión (ΔV) por Ley de Kirchhoff de Voltajes",
                    calculos: [
                        `VR1 = V_N1 - V_N2 = ${formatoIngenieria(VR1, 'V')}`,
                        `VR2 = VR3 = VR4B = V_N3 - V_N0 = ${formatoIngenieria(VR2, 'V')}`,
                        `VR4A = V_N2 - V_N3 = ${formatoIngenieria(VR4A, 'V')}`
                    ]
                },
                {
                    paso: "6. Finalmente, se calcula la corriente por cada rama utilizando la Ley de Ohm (I = ΔV / R).",
                    calculos: [
                        `IR1 (Corriente Total) = VR1 / R1 = ${formatoIngenieria(IR1, 'A')}`,
                        `IR2 = VR2 / R2 = ${formatoIngenieria(IR2, 'A')}`,
                        `IR3 = VR3 / R3 = ${formatoIngenieria(IR3, 'A')}`,
                        `IR4A = VR4A / R3B = ${formatoIngenieria(IR4A, 'A')}`,
                        `IR4B = VR4B / R4B = ${formatoIngenieria(IR4B, 'A')}`
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
        const V_N0 = resultado.voltages['0'];
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
                        `R1 = ${formatoIngenieria(R1, 'Ω')}`,
                        `R2 = ${formatoIngenieria(R2, 'Ω')}`, 
                        `R3 = ${formatoIngenieria(R3, 'Ω')}`,
                        `V1 = ${formatoIngenieria(V1, 'V')}`,
                        `I1 = ${formatoIngenieria(I1, 'A')}`
                    ]
                },
                {
                    paso: "1. Planteamiento Teórico del Análisis Nodal (Leyes de Kirchhoff).",
                    calculos: [
                        `El circuito consta de 3 nodos principales. El Nodo 0 es nuestra referencia a tierra (${formatoIngenieria(V_N0, 'V')}).`,
                        `El Nodo 1 está conectado a la fuente ideal V1, por lo que su voltaje es directamente V_N1 = ${formatoIngenieria(V_N1, 'V')}.`,
                        "Para encontrar el voltaje desconocido del Nodo 2, se aplica la Ley de Corrientes de Kirchhoff (La suma de corrientes que salen de un nodo es igual a 0):",
                        "(V_N2 - V_N1) / R1  +  (V_N2 - V_N0) / R3  +  (V_N2 - V_N0) / R2  -  I1  =  0",
                        "Simplificando y sustituyendo valores conocidos...",
                        `V_N2 / ${formatoIngenieria(R1, 'Ω')} +  V_N2 / ${formatoIngenieria(R3, 'Ω')}  +  V_N2 / ${formatoIngenieria(R2, 'Ω')}  =  ${formatoIngenieria(I1, 'A')} + ${formatoIngenieria(V_N1, 'V')} / ${formatoIngenieria(R1, 'Ω')}`,
                        "Nota importante: La fuente I1 se resta en la ecuación porque su flecha indica que la corriente está ENTRANDO al Nodo 2, oponiéndose a las que salen. Dicho esto, pasa sumando al lado derecho de la ecuación"
                    ]
                },
                {
                    paso: "2. Resolución Matricial del Motor MNA.",
                    calculos: [
                        "Al hallar el valor de V_N2 de la ecuación nodal anterior, el motor matricial MNA despeja los potenciales absolutos:",
                        `V_N0 (Tierra) = ${formatoIngenieria(V_N0, 'V')}`,
                        `V_N1 (Alimentación) = ${formatoIngenieria(V_N1, 'V')}`,
                        `V_N2 = ${formatoIngenieria(V_N2, 'V')}`
                    ]
                },
                {
                    paso: "3. Cálculo de Caídas de Tensión (ΔV).",
                    calculos: [
                        "Sabiendo el voltaje absoluto de cada nodo, la caída de voltaje en cada resistencia es simplemente la diferencia entre sus terminales (V_nodo_entrada - V_nodo_salida):",
                        `VR1 = V_N1 - V_N2 = ${formatoIngenieria(VR1, 'V')}`,
                        `VR3 = V_N2 - V_N0 = ${formatoIngenieria(VR3, 'V')}`,
                        `VR2 = V_N2 - V_N0 = ${formatoIngenieria(VR2, 'V')}`
                    ]
                },
                {
                    paso: "4. Cálculo de Corrientes por Rama y Comprobación.",
                    calculos: [
                        "Aplicamos la Ley de Ohm (I = ΔV / R) a cada componente pasivo para encontrar su corriente:",
                        `IR1 = VR1 / R1 = ${formatoIngenieria(VR1, 'V')} / ${formatoIngenieria(R1, 'Ω')} = ${formatoIngenieria(IR1, 'A')}`,
                        `IR3 = VR3 / R3 = ${formatoIngenieria(VR3, 'V')} / ${formatoIngenieria(R3, 'Ω')} = ${formatoIngenieria(IR3, 'A')}`,
                        `IR2 = VR2 / R2 = ${formatoIngenieria(VR2, 'V')} / ${formatoIngenieria(R2, 'Ω')} = ${formatoIngenieria(IR2, 'A')}`,
                        "Si verificamos el Nodo 2 de nuestro circuito simulado (Ambas sumas deben ser iguales):",
                        `Corrientes que entran (IR1 + I1) = ${formatoIngenieria(IR1, 'A')} + ${formatoIngenieria(I1, 'A')}A = ${formatoIngenieria((IR1 + I1), 'A')}`,
                        `Corrientes que salen (IR3 + IR2) = ${formatoIngenieria(IR3, 'A')} + ${formatoIngenieria(IR2, 'A')} = ${formatoIngenieria((IR3 + IR2), 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_3': (netlist, resultado) => {
        //Extraer valores R1-R9, V1, V2
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);
        const R7 = parsearValorElectrico(netlist.find(c => c.id === 'R7').value);
        const R8 = parsearValorElectrico(netlist.find(c => c.id === 'R8').value);
        const R9 = parsearValorElectrico(netlist.find(c => c.id === 'R9').value);
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const V2 = parsearValorElectrico(netlist.find(c => c.id === 'V2').value);

        // Extraer Voltajes Nodales de 'resultado.voltages' (Ya calculados por el MNA)
        const V_N0 = resultado.voltages['0'];
        const V_N1 = resultado.voltages['1'];
        const V_N2 = resultado.voltages['2'];
        const V_N3 = resultado.voltages['3'];
        const V_N4 = resultado.voltages['4'];
        const V_N5 = resultado.voltages['5'];
        const V_N6 = resultado.voltages['6'];

        // Extraer Corrientes (Ya calculadas por el MNA)
        const IR1 = resultado.currents['R1'];
        const IR2 = resultado.currents['R2'];
        const IR3 = resultado.currents['R3'];
        const IR4 = resultado.currents['R4'];
        const IR5 = resultado.currents['R5'];
        const IR6 = resultado.currents['R6'];

        return {
            titulo: "Análisis Nodal Avanzado con Supernodo",
            pasos: [
                {
                    paso: "1. Identificación de Nodos Conocidos.",
                    calculos: [
                        `El Nodo 0 es nuestra referencia (${formatoIngenieria(V_N0, 'V')}).`,
                        `La fuente V1 está conectada entre Tierra y el Nodo 1, por lo que directamente V_N1 = ${formatoIngenieria(V_N1, 'V')}.`,
                        "El resto de los nodos (2, 3, 4, 5 y 6) son incógnitas del sistema."
                    ]
                },
                {
                    paso: "2. Planteamiento del Supernodo (Nodos 3 y 4).",
                    calculos: [
                        "La fuente V2 se encuentra flotando entre los Nodos 3 y 4. Dado que ninguno de los nodos es de referencia, esto crea un 'Supernodo'.",
                        "Primero, establecemos la ecuación de restricción de voltaje de la fuente:",
                        `Ecuación de restricción: V_N3 - V_N4 = ${formatoIngenieria(V2, 'V')}`,
                        "Luego, aplicamos la Ley de Corrientes (KCL) englobando ambos nodos como si fueran uno solo:",
                        "Recuerda: Corrientes que entran = Corrientes que salen",
                        "I_R6 + I_R1 = I_R9 + I_R4 + I_R5"
                    ]
                },
                {
                    paso: "3. Planteamiento de KCL para el resto de los Nodos.",
                    calculos: [
                        "Planteamos el resto de ecuaciones para los nodos 2, 5 y 6",
                        "Para el Nodo 2: Corriente de R7 = Corriente hacia R1 + Corriente hacia R8.",
                        "I_R7 = I_R1 + I_R8",
                        "Para el Nodo 5: La corriente que entra de R8 es igual a la que sale por R2.",
                        "I_R8 = I_R2",
                        "Para el Nodo 6: Las corrientes de R9 y R2 entran, y salen por R3.",
                        "I_R9 + I_R2 = I_R3"
                    ]
                },
                {
                    paso: "4. Sustitución de los valores de corriente con el equivalente de Ley de Ohm",
                    calculos: [
                        "Expresamos todas las ecuaciones en términos de voltajes nodales.",
                        "Para el Nodo 2",
                        `R7 (${formatoIngenieria(R7, 'Ω')}) está entre el nodo 1 y el nodo 2.`,
                        `R1 (${formatoIngenieria(R1, 'Ω')}) está entre el nodo 2 y el nodo 3.`,
                        `R8 (${formatoIngenieria(R8, 'Ω')}) está entre el nodo 2 y el nodo 5.`,
                        "Por lo tanto la ecuación resultante se expresa así:",
                        `(${formatoIngenieria(V_N1, 'V')} - V_N2)/${formatoIngenieria(R7, 'Ω')} = (V_N2 - V_N3)/${formatoIngenieria(R1, 'Ω')} + (V_N2 - V_N5)/${formatoIngenieria(R8, 'Ω')}`,
                        "Para el Nodo 5:",
                        `R8 (${formatoIngenieria(R8, 'Ω')}) está entre el nodo 2 y el nodo 5.`,
                        `R2 (${formatoIngenieria(R2, 'Ω')}) está entre el nodo 5 y el nodo 6.`,
                        "Por lo tanto la ecuación resultante se expresa así:",
                        `(V_N2 - V_N5)/${formatoIngenieria(R8, 'Ω')} = (V_N5 - V_N6)/${formatoIngenieria(R2, 'Ω')}`,
                        "Para el Nodo 6:",
                        `R9 (${formatoIngenieria(R9, 'Ω')}) está entre el nodo 3 y el nodo 6.`,
                        `R2 (${formatoIngenieria(R2, 'Ω')}) está entre el nodo 5 y el nodo 6.`,
                        `R3 (${formatoIngenieria(R3, 'Ω')}) está entre el nodo 6 y el nodo 0.`,
                        "Por lo tanto la ecuación resultante se expresa así:",
                        `(V_N3 - V_N6)/${formatoIngenieria(R9, 'Ω')} + (V_N5 - V_N6)/${formatoIngenieria(R2, 'Ω')} = (V_N6 - ${formatoIngenieria(V_N0, 'V')})/${formatoIngenieria(R3, 'Ω')}`,
                        "Para el Supernodo que engloba al Nodo 3 y 4 identificamos los nodos en los que se encuentra cada resistencia así como en los pasos anteriores, pero ignorando la fuente V2:",
                        `R6 (${formatoIngenieria(R6, 'Ω')}) está entre el nodo 1 y el nodo 3.`,
                        `R1 (${formatoIngenieria(R1, 'Ω')}) está entre el nodo 2 y el nodo 3.`,
                        `R9 (${formatoIngenieria(R9, 'Ω')}) está entre el nodo 3 y el nodo 6.`,
                        `R4 (${formatoIngenieria(R4, 'Ω')}) Y R5 (${formatoIngenieria(R5, 'Ω')}) están entre el nodo de Referencia (Nodo 0) y el nodo 4. (El voltaje que reciben ambos provienen del Nodo 4)`,
                        "Por lo tanto la ecuación resultante se expresa así:",
                        `(${formatoIngenieria(V_N1, 'V')} - V_N3)/${formatoIngenieria(R6, 'Ω')} + (V_N2 - V_N3)/${formatoIngenieria(R1, 'Ω')} = (V_N3 - V_N6)/${formatoIngenieria(R9, 'Ω')} + (V_N4 - ${formatoIngenieria(V_N0, 'V')})/${R4} + (V_N4 - ${formatoIngenieria(V_N0, 'V')})/${formatoIngenieria(R5, 'Ω')}`,
                        `No te olvides de simplificar las ecuaciones anteriores.`
                    ]
                },
                {
                    paso: "5. Resolución del Sistema de Ecuaciones.",
                    calculos: [
                        "Es decisión del alumno utilizar el método de resolución de sistemas de ecuaciones deseado (Sustitución, Igualación, Reducción, Cramer o Gauss-Jordan).",
                        "Se cuentan con 4 ecuaciones de 4 Incógnitas.",
                        "Una vez resuelto, podemos hallar el voltaje del Nodo 4 (V_N4) sustituyendo el valor de V_N3 en la ecuación de restricción definida en el paso 2.", 
                        "Después de resolver el sistema de ecuaciones y de hallar V_N4, obtenemos los voltajes de los nodos:",
                        `V_N2 = ${formatoIngenieria(V_N2, 'V')}`,
                        `V_N3 = ${formatoIngenieria(V_N3, 'V')}`,
                        `V_N4 = ${formatoIngenieria(V_N4, 'V')}`,
                        `V_N5 = ${formatoIngenieria(V_N5, 'V')}`,
                        `V_N6 = ${formatoIngenieria(V_N6, 'V')}`
                    ]
                },
                {
                    paso: "6. Cálculo de Caídas de Voltaje y Corrientes en las resistencias.",
                    calculos: [
                        "Con los voltajes nodales conocidos, podemos hallar cualquier voltaje de cada resistencia del circuito aplicando la caída de voltaje.",
                        "Ejemplo para R1:",
                        `VR1 = V_N2 - V_N3 = ${formatoIngenieria(V_N2, 'V')} - ${formatoIngenieria(V_N3, 'V')} = ${formatoIngenieria((V_N2 - V_N3), 'V')}`,
                        `IR1 = VR1 / R1 = ${formatoIngenieria((V_N2 - V_N3), 'V')} / ${formatoIngenieria(R1, 'Ω')} = ${formatoIngenieria((V_N2 - V_N3)/R1, 'A')}`,
                        "Ejemplo para R9:",
                        `VR9 = V_N3 - V_N6 = ${formatoIngenieria(V_N3, 'V')} - ${formatoIngenieria(V_N6, 'V')} = ${formatoIngenieria((V_N3 - V_N6), 'V')}`,
                        `IR9 = VR9 / R9 = ${formatoIngenieria((V_N3 - V_N6), 'V')} / ${formatoIngenieria(R9, 'Ω')} = ${formatoIngenieria((V_N3 - V_N6)/R9, 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_4': (netlist, resultado) => {
        // Extraer valores NOMINALES de la netlist
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);
        const R7 = parsearValorElectrico(netlist.find(c => c.id === 'R7').value);
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);

        // Cálculos Didácticos Rápidos para la explicación (Bloques Equivalentes)
        const R_superior = R1 + R3;
        const R_rama_der = R4 + R7;
        const R_par = (R2 * R_rama_der) / (R2 + R_rama_der);
        const R_inferior = R6 + R5;
        const R_tot = R_superior + R_par + R_inferior;

        // Extraer Voltajes Nodales (MNA)
        const V_N0 = resultado.voltages['0'];
        const V_N1 = resultado.voltages['1'];
        const V_N2 = resultado.voltages['2'];
        const V_N3 = resultado.voltages['3'];
        const V_N4 = resultado.voltages['4'];
        const V_N5 = resultado.voltages['5'];
        const V_N6 = resultado.voltages['6'];

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR4 = extraerValorDeResultados(resultado, 'R4', 'voltaje', netlist);
        // Extraer Corrientes (YA CALCULADAS POR EL MNA)
        const IR1 = resultado.currents['R1'];
        const IR4 = resultado.currents['R4'];

        return {
            titulo: "Análisis mediante Teorema del Divisor de Voltaje",
            pasos: [
                {
                    paso: "1. Simplificación de las resistencias en serie del circuito.",
                    calculos: [
                        "Para aplicar el divisor de voltaje, reducimos las resistencias agrupándolas dependiendo de los tres bloques principales en serie presentes en el circuito:",
                        `Bloque Superior (R1 + R3) = ${formatoIngenieria(R_superior, 'Ω')}`,
                        `Bloque Inferior (R6 + R5) = ${formatoIngenieria(R_inferior, 'Ω')}`,
                        `Bloque De la derecha (R4 + R7) = ${formatoIngenieria(R_rama_der, 'Ω')}`
                    ]
                },
                {
                    paso: "2. Simplificación de las resistencias en paralelo",
                    calculos: [
                        "Las resistencias de la derecha del circuito (es decir R2 y las resistencias que redujimos sumando R4 Y 47), están en paralelo.",
                        "Por lo tanto obtenemos la resistencia equivalente en paralelo para estas dos resistencias aplicando la fórmula:",
                        `Bloque Paralelo = R2 || (R4 + R7) = (R2 * (R4 + R7)) / (R2 + (R4 + R7)) = (${formatoIngenieria(R2, 'Ω')} * ${formatoIngenieria(R_rama_der, 'Ω')}) / (${formatoIngenieria(R2, 'Ω')} + ${formatoIngenieria(R_rama_der, 'Ω')}) = ${formatoIngenieria(R_par, 'Ω')}`
                    ]
                },
                {
                    paso: "3. Cálculo de la resistencia total.",
                    calculos: [
                        "Hacemos como en el paso 1. Todas las resistencias presentes están en serie, podemos obtener la resistencia total del circuito.",
                        `Resistencia Total (Req) = ${formatoIngenieria(R_superior, 'Ω')} + ${formatoIngenieria(R_par, 'Ω')} + ${formatoIngenieria(R_inferior, 'Ω')} = ${formatoIngenieria(R_tot, 'Ω')}`
                    ]
                },
                {
                    paso: "4. Aplicación del Divisor de Voltaje.",
                    calculos: [
                        "La fórmula del divisor de voltaje dicta que el voltaje en un nodo respecto a tierra es proporcional a la resistencia entre ese nodo y tierra.",
                        `V_N5 = V1 * (Bloque Inferior / Req) = ${formatoIngenieria(V1, 'V')} * (${formatoIngenieria(R_inferior, 'Ω')} / ${formatoIngenieria(R_tot, 'Ω')}) = ${formatoIngenieria(V_N5, 'V')}`,
                        `V_N3 = V1 * ((Bloque Paralelo + Bloque Inferior) / Req) = ${formatoIngenieria(V1, 'V')} * (${formatoIngenieria((R_par + R_inferior), 'Ω')} / ${formatoIngenieria(R_tot, 'Ω')}) = ${formatoIngenieria(V_N3, 'V')}`,
                        `V_N6 = V1 * (R5 / Req) = ${formatoIngenieria(V1, 'V')} * (${formatoIngenieria(R5, 'Ω')} / ${formatoIngenieria(R_tot, 'Ω')}) = ${formatoIngenieria(V_N6, 'V')}`,
                        `V_N2 (Voltaje de la fuente menos lo que recae en R1) = V1 - (V1 * (R1 / Req)) =  ${formatoIngenieria(V1, 'V')} - (${formatoIngenieria(V1, 'V')} * (${formatoIngenieria(R1, 'Ω')} / ${formatoIngenieria(R_tot, 'Ω')})) = ${formatoIngenieria(V_N2, 'V')}`
                    ]
                },
                {
                    paso: "5. Divisor de Voltaje Anidado",
                    calculos: [
                        "El Nodo 4 se encuentra dentro de la rama paralela derecha (R4 y R7).",
                        `Sabemos que la caída de voltaje sobre todo el bloque central es: ΔV_par = V_N3 - V_N5 = ${formatoIngenieria((V_N3 - V_N5), 'V')}`,
                        "Aplicando un divisor interno para R7 obtenemos su caída de voltaje específica:",
                        `ΔV_R7 = ΔV_par * (R7 / (R4 + R7)) = ${formatoIngenieria((V_N3 - V_N5), 'V')} * (${formatoIngenieria(R7, 'Ω')} / ${formatoIngenieria(R_rama_der, 'Ω')})`,
                        `V_N4 = V_N5 + ΔV_R7 = ${formatoIngenieria(V_N4, 'V')}`
                    ]
                },
                {
                    paso: "6. Cálculo de Caídas de Voltaje y Corrientes.",
                    calculos: [
                        "Con los voltajes nodales conocidos, podemos hallar cualquier voltaje de cada resistencia del circuito aplicando la caída de voltaje.",
                        "Ejemplo para R1:",
                        `VR1 = V1 - V_N2 = ${formatoIngenieria(V1, 'V')} - ${formatoIngenieria(V_N2, 'V')} = ${formatoIngenieria(VR1, 'V')}`,
                        `IR1 = VR1 / R1 = ${formatoIngenieria(VR1, 'V')} / ${formatoIngenieria(R1, 'Ω')} = ${formatoIngenieria(IR1, 'A')}`,
                        "Ejemplo para R4:",
                        `VR4 = V_N3 - V_N4 = ${formatoIngenieria(V_N3, 'V')} - ${formatoIngenieria(V_N4, 'V')} = ${formatoIngenieria(VR4, 'V')}`,
                        `IR4 = VR4 / R4 = ${formatoIngenieria(VR4, 'V')} / ${formatoIngenieria(R4, 'Ω')} = ${formatoIngenieria(IR4, 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_5': (netlist, resultado) => {
        // Extraer valores NOMINALES de la netlist
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);

        // Cálculos Didácticos Rápidos para la explicación
        const R_p1 = (R2 * R4) / (R2 + R4);
        const R_rama_der = R6 + R_p1;
        const R_rama_cen = R1 + R3;

        // Formateo de los valores extraídos del MNA
        const V_N0_texto = formatoIngenieria(resultado.voltages['0'], 'V');
        const V_N1_texto = formatoIngenieria(resultado.voltages['1'], 'V');
        const V_N2_texto = formatoIngenieria(resultado.voltages['2'], 'V');
        const V_N3_texto = formatoIngenieria(resultado.voltages['3'], 'V');
        const V_N4_texto = formatoIngenieria(resultado.voltages['4'], 'V');
        
        // Extraemos corrientes y las convertimos a notación de ingeniería (mA, µA, etc)
        const I_total_texto = formatoIngenieria(I1, 'A');
        const I_R1_texto = formatoIngenieria(resultado.currents['R1'], 'A'); // Corriente Rama Central
        const I_R6_texto = formatoIngenieria(resultado.currents['R6'], 'A'); // Corriente Rama Derecha
        const I_R2_texto = formatoIngenieria(resultado.currents['R2'], 'A'); 
        const I_R4_texto = formatoIngenieria(resultado.currents['R4'], 'A');

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR2 = extraerValorDeResultados(resultado, 'R2', 'voltaje', netlist);
        const VR3 = extraerValorDeResultados(resultado, 'R3', 'voltaje', netlist);
        const VR4 = extraerValorDeResultados(resultado, 'R4', 'voltaje', netlist);
        const VR5 = extraerValorDeResultados(resultado, 'R5', 'voltaje', netlist);
        const VR6 = extraerValorDeResultados(resultado, 'R6', 'voltaje', netlist);

        return {
            titulo: "Análisis mediante Teorema del Divisor de Corriente",
            pasos: [
                {
                    paso: "1. Simplificación de ramas en paralelo.",
                    calculos: [
                        "Para saber cómo se dividirá la corriente, evaluamos la resistencia equivalente de cada ruta disponible.",
                        `Resistencia Rama Central (R1 + R3) = ${formatoIngenieria(R_rama_cen, 'Ω')}`,
                        `Resistencia Rama Derecha (R6 + (R2 || R4)) = R6 + (R2 * R4) / (R2 + R4) =  ${formatoIngenieria(R_rama_der, 'Ω')}`
                    ]
                },
                {
                    paso: "2. Primer Divisor de Corriente (Nodo 2).",
                    calculos: [
                        `La fuente inyecta una corriente total de ${I_total_texto} que llega al Nodo 2. Esta corriente se divide inversamente proporcional a la resistencia de cada rama.`,
                        `Aplicando la fórmula de Divisor de Corriente por Rama Central (IR1) = I_total * [R_rama_der / (R_rama_cen + R_rama_der)]`,
                        `I_cen = IR1 = ${I_R1_texto}`,
                        `Corriente por Rama Derecha (IR6) = I_total * [R_rama_cen / (R_rama_der + R_rama_cen)]`,
                        `I_der = IR6 = ${I_R6_texto}`
                    ]
                },
                {
                    paso: "3. Segundo Divisor de Corriente (Nodo 3).",
                    calculos: [
                        `Los ${I_R6_texto} que viajaron por la rama derecha llegan al Nodo 3 y se vuelven a dividir entre R2 y R4.`,
                        `IR4 = I_der * [R2 / (R4 + R2)] = ${I_R4_texto}`,
                        `IR2 = I_der * [R4 / (R2 + R4)] = ${I_R2_texto}`,
                        `Notas: La corriente de R5 es igual a la corriente de la fuente I1 porque está en serie con ella: IR5 = ${I_total_texto}`,
                        `La corriente de IR3 es igual a la de IR1 porque ambas resistencias están en serie: IR3 = ${I_R1_texto}` 
                    ]
                },
                {
                    paso: "4. Cálculo de Voltajes en las resistencias utilizando la Ley de Ohm.",
                    calculos: [
                        "Ahora que tenemos las corrientes de cada resistencia, podemos calcular sus voltajes",
                        `VR1 = IR1 * R1 = ${I_R1_texto} * ${formatoIngenieria(R1, 'Ω')} = ${formatoIngenieria(VR1, 'V')}`,
                        `VR2 = IR2 * R2 = ${I_R2_texto} * ${formatoIngenieria(R2, 'Ω')} = ${formatoIngenieria(VR2, 'V')}`,
                        `VR3 = IR3 * R3 = ${I_R1_texto} * ${formatoIngenieria(R3, 'Ω')} = ${formatoIngenieria(VR3, 'V')}`,
                        `VR4 = IR4 * R4 = ${I_R4_texto} * ${formatoIngenieria(R4, 'Ω')} = ${formatoIngenieria(VR4, 'V')}`,
                        `VR5 = IR5 * R1 = ${I_total_texto} * ${formatoIngenieria(R5, 'Ω')} = ${formatoIngenieria(VR5, 'V')}`,
                        `VR6 = IR6 * R6 = ${I_R6_texto} * ${formatoIngenieria(R6, 'Ω')} = ${formatoIngenieria(VR6, 'V')}`
                    ]
                }
            ]
        };
    },
    'ID_6': (netlist, resultado) => {
        // Extraer valores NOMINALES de la netlist
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);
        const R7 = parsearValorElectrico(netlist.find(c => c.id === 'R7').value);
        const R8 = parsearValorElectrico(netlist.find(c => c.id === 'R8').value);
        const R9 = parsearValorElectrico(netlist.find(c => c.id === 'R9').value);

        // PASO 1: Formateo de los valores extraídos del MNA 
        const V_N0 = formatoIngenieria(resultado.voltages['0'], 'V');
        const V_N1 = formatoIngenieria(resultado.voltages['1'], 'V');
        const V_N2 = formatoIngenieria(resultado.voltages['2'], 'V');
        const V_N3 = formatoIngenieria(resultado.voltages['3'], 'V');
        const V_N4 = formatoIngenieria(resultado.voltages['4'], 'V');
        const V_N5 = formatoIngenieria(resultado.voltages['5'], 'V');
        const V_N6 = formatoIngenieria(resultado.voltages['6'], 'V');
        
        const I_fuente = formatoIngenieria(I1, 'A');

        return {
            titulo: "Análisis Nodal con Fuente de Corriente Flotante",
            pasos: [
                {
                    paso: "1. Identificación de Topología (Corriente vs Voltaje).",
                    calculos: [
                        "A diferencia del circuito con una fuente de voltaje flotante, una fuente de corriente flotante (I1) NO crea un Supernodo.",
                        "En el Análisis Nodal (KCL), la corriente de esta fuente simplemente se suma o se resta como una constante conocida en los nodos a los que está conectada.",
                        `Nodos conocidos: V_N0 = ${V_N0}, V_N1 = ${V_N1}`,
                        `Nodos incógnita: V_N2, V_N3, V_N4, V_N5, V_N6.`
                    ]
                },
                {
                    paso: "2. Ecuación KCL en el Nodo de salida (Nodo 2).",
                    calculos: [
                        `La fuente I1 inyecta ${I_fuente} constantes. Como la flecha indica que sale del Nodo 2 hacia el Nodo 5, esta corriente se suma positivamente a las que abandonan el nodo:`,
                        `Ecuación Nodo 2 (ECUACIÓN 1): (${V_N1} - V_N2)/R7 + (V_N2 - V_N3)/R1 + ${I_fuente} = 0`
                    ]
                },
                {
                    paso: "3. Ecuación KCL en el Nodo de llegada (Nodo 5).",
                    calculos: [
                        `De manera análoga, la corriente I1 entra al Nodo 5. En KCL, las corrientes que entran se restan:`,
                        `Ecuación Nodo 5 (ECUACIÓN 2): (V_N5 - V_N6)/R2 - ${I_fuente} = 0`,
                        `Simplificando se consigue que V_N5 = V_N6 + ${I1 * R2}`
                    ]
                },
                {
                    paso: "4. Ecuaciones KCL restantes.",
                    calculos: [
                        `Obtenemos las ecuaciones restantes para los demás nodos`,
                        `Ecuación Nodo 3 (ECUACIÓN 3): Corriente de R6 + Corriente de R1 = Corriente de R8 + Corriente de R9.`,
                        "I_R6 + I_R1 = I_R8 + I_R9",
                        `(${V_N1} - V_N3) / ${formatoIngenieria(R6, 'Ω')} + (V_N2 - V_N3) / ${formatoIngenieria(R1, 'Ω')} = (V_N3 - V_N4) / ${formatoIngenieria(R8, 'Ω')} + (V_N3 - V_N6) / ${formatoIngenieria(R9, 'Ω')}`,
                        "Para el Nodo 4 (ECUACIÓN 4): Corriente de R8 = Corriente de R4 + Corriente de R5.",
                        "I_R8 = I_R4 + I_R5",
                        `(V_N3 - V_N4) / ${formatoIngenieria(R8, 'Ω')} = (V_N4 - ${formatoIngenieria(V_N0)}) / ${formatoIngenieria(R4, 'Ω')} + (V_N4 - ${formatoIngenieria(V_N0)}) / ${formatoIngenieria(R5, 'Ω')}`,
                        "Para el Nodo 6 (ECUACIÓN 5): Corriente de R9 + Corriente de R2 = Corriente de R3.",
                        "I_R9 + I_R2 = I_R3",
                        `(V_N3 - V_N6)/${formatoIngenieria(R9, 'Ω')} + (V_N5 - V_N6)/${formatoIngenieria(R2, 'Ω')} = (V_N6 - ${formatoIngenieria(V_N0, 'V')})/${formatoIngenieria(R3, 'Ω')}`
                    ]
                },
                {
                    paso: "5. Resolución del Sistema Matricial (MNA).",
                    calculos: [
                        "Es decisión del alumno utilizar el método de resolución de sistemas de ecuaciones deseado (Sustitución, Igualación, Reducción, Cramer o Gauss-Jordan).",
                        "Se cuentan con 5 ecuaciones de 5 Incógnitas.",
                        `V_N2 = ${V_N2}`,
                        `V_N3 = ${V_N3}`,
                        `V_N4 = ${V_N4}`,
                        `V_N5 = ${V_N5}`,
                        `V_N6 = ${V_N6}`
                    ]
                },
                {
                    paso: "6. Cálculo de Corrientes en las resistencias.",
                    calculos: [
                        "Usando la Ley de Ohm y los voltajes calculados en los nodos, podemos hallar cualquier corriente.",
                        "Se calculan las corrientes de R7 y R2 como ejemplo:",
                        `I_R7 = (V_N1 - V_N2) / R7 = ${formatoIngenieria(resultado.currents['R7'], 'A')}`,
                        `I_R2 = (V_N5 - V_N6) / R2 = ${formatoIngenieria(resultado.currents['R2'], 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_7': (netlist, resultado) => {
        //Extraer valores NOMINALES
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR2 = extraerValorDeResultados(resultado, 'R2', 'voltaje', netlist);
        const VR3 = extraerValorDeResultados(resultado, 'R3', 'voltaje', netlist);
        const VR4 = extraerValorDeResultados(resultado, 'R4', 'voltaje', netlist);
        const VR5 = extraerValorDeResultados(resultado, 'R5', 'voltaje', netlist);
        const VR6 = extraerValorDeResultados(resultado, 'R6', 'voltaje', netlist);

        // Cálculos de los Sub-estados (Superposición)
        const R_izq = R5 + R2 + R1; //con la fuente I1 desconectada (Circuito Abierto)
        const R_der = R3 + R6 + R4;
        const R_tot = R_izq + R_der;

        // Estado 1 (Solo V1)
        const I_V1_only = V1 / R_tot;

        // Estado 2 (Solo I1)
        const I_der_I1_only = I1 * (R_izq / R_tot); //Con la fuente V1 apagada (Cortocircuito)
        const I_izq_I1_only = I1 * (R_der / R_tot);

        // Extracción MNA (Total real)
        const I_R3_total_MNA = resultado.currents['R3'];
        const I_R2_total_MNA = resultado.currents['R2'];

        return {
            titulo: "Análisis por Teorema de Superposición",
            pasos: [
                {
                    paso: "1. Principio de Superposición.",
                    calculos: [
                        "En un circuito lineal con múltiples fuentes, la respuesta total es la suma de las respuestas de cada fuente actuando de manera independiente.",
                        "Analizaremos el circuito apagando una fuente a la vez."
                    ]
                },
                {
                    paso: "2. Estado 1: Solo actúa V1 (Apagamos I1).",
                    calculos: [
                        "Para apagar una fuente de corriente, se reemplaza por un circuito abierto. Esto elimina la rama central.",
                        "¡El circuito queda como un único lazo en serie gigantesco compuesto por todas las resistencias!",
                        `R_izq está compuesto de las resistencias R1, R2 y R5`, 
                        `R_izq = R1 + R2 + R5 = ${formatoIngenieria(R_izq, 'Ω')}`,
                        `R_der está compuesto de las resistencias R3, R4 y R6`, 
                        `R_der = R3 + R4 + R6 = ${formatoIngenieria(R_der, 'Ω')}`,
                        `Resistencia total del lazo = R_izq + R_der = ${formatoIngenieria(R_tot, 'Ω')}`,
                        `Corriente aportada por V1 a todo el lazo (En el sentido de las manecillas del reloj) = V1 / R_tot = ${formatoIngenieria(I_V1_only, 'A')}`
                    ]
                },
                {
                    paso: "3. Estado 2: Solo actúa I1 (Apagamos V1).",
                    calculos: [
                        "Para apagar una fuente de voltaje, se reemplaza por un cortocircuito (un cable).",
                        "Al hacer esto, la fuente I1 inyecta corriente hacia el Nodo 3, la cual se divide en dos caminos paralelos para regresar al Nodo 4.",
                        `¡Solo basta con aplicar un divisor de corriente!`,
                        `Corriente aportada hacia la rama derecha = I1 * (R_izq / R_tot) = ${formatoIngenieria(I_der_I1_only, 'A')}`,
                        `Corriente aportada hacia la rama izquierda = I1 * (R_der / R_tot) = ${formatoIngenieria(I_izq_I1_only, 'A')}`
                    ]
                },
                {
                    paso: "4. Superposición (Suma de Estados).",
                    calculos: [
                        "Para hallar la corriente real en cualquier componente, sumamos algebraicamente sus contribuciones (respetando la dirección).",
                        "En la rama derecha (R3, R4 y R6) la corriente es la misma para cada una de las resistencias:",
                        `IR3 Total = IR4 Total = IR6 Total = Aporte de V1 + Aporte de I1 = ${formatoIngenieria(I_V1_only, 'A')} + ${formatoIngenieria(I_der_I1_only, 'A')} = ${formatoIngenieria(I_V1_only + I_der_I1_only, 'A')}`,
                        `Para encontrar la corriente de la rama izquierda, podemos hacer una pequeña ecuación aplicando KCL (I_R2 + I1 = IR3), o podemos sumar algebraicamente las contribuciones al igual que en la rama derecha, pero sería la rama izquierda la que usaremos.`,
                        `IR1 Total = IR2 Total = IR5 Total = ${formatoIngenieria(I_V1_only, 'A')} + ${formatoIngenieria(I_izq_I1_only, 'A')} = ${formatoIngenieria(I_R2_total_MNA, 'A')}`
                    ]
                },
                {
                    paso: "5. Voltajes en cada resistencia",
                    calculos: [
                        "Ahora que contamos con las corrientes de cada resistencia, podemos calcular sus voltajes utilizando la ley de Ohm",
                        `VR1 = R1 * IR1 = ${formatoIngenieria(VR1, 'V')}`,
                        `VR2 = R2 * IR2 = ${formatoIngenieria(VR2, 'V')}`,
                        `VR3 = R3 * IR3 = ${formatoIngenieria(VR3, 'V')}`,
                        `VR4 = R4 * IR4 = ${formatoIngenieria(VR4, 'V')}`,
                        `VR5 = R5 * IR5 = ${formatoIngenieria(VR5, 'V')}`,
                        `VR6 = R6 * IR6 = ${formatoIngenieria(VR6, 'V')}`
                    ]
                }
            ]
        };
    },
    'ID_8': (netlist, resultado) => {
        // Extraer valores NOMINALES de la netlist
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const R6 = parsearValorElectrico(netlist.find(c => c.id === 'R6').value);
        const R7 = parsearValorElectrico(netlist.find(c => c.id === 'R7').value);
        const R8 = parsearValorElectrico(netlist.find(c => c.id === 'R8').value);

        // Cálculos de Transformación
        const R_eq_der = R4 + R7;
        const V_th_izq = I1 * R6; 
        const R_eq_izq = R6 + R1;

        // Extracción MNA formateada
        const V_N2 = formatoIngenieria(resultado.voltages['2'], 'V');
        const V_N3 = formatoIngenieria(resultado.voltages['3'], 'V');
        const V_N4 = formatoIngenieria(resultado.voltages['4'], 'V');
        const V_N5 = formatoIngenieria(resultado.voltages['5'], 'V');
        const V_N6 = formatoIngenieria(resultado.voltages['6'], 'V');

        // Extraer Caídas de Voltaje
        const VR1 = extraerValorDeResultados(resultado, 'R1', 'voltaje', netlist);
        const VR2 = extraerValorDeResultados(resultado, 'R2', 'voltaje', netlist);
        const VR3 = extraerValorDeResultados(resultado, 'R3', 'voltaje', netlist);
        const VR4 = extraerValorDeResultados(resultado, 'R4', 'voltaje', netlist);
        const VR5 = extraerValorDeResultados(resultado, 'R5', 'voltaje', netlist);
        const VR6 = extraerValorDeResultados(resultado, 'R6', 'voltaje', netlist);
        const VR7 = extraerValorDeResultados(resultado, 'R7', 'voltaje', netlist);
        const VR8 = extraerValorDeResultados(resultado, 'R8', 'voltaje', netlist);

        return {
            titulo: "Simplificación mediante Transformación de Fuentes (Thévenin / Norton)",
            pasos: [
                {
                    paso: "1. Principio de Dualidad (Thévenin ↔ Norton).",
                    calculos: [
                        "El análisis de este circuito se simplifica drásticamente aplicando transformaciones de fuentes.",
                        "Cualquier fuente de corriente en paralelo con una resistencia (Norton) puede convertirse en una fuente de voltaje en serie con la misma resistencia (Thévenin), y viceversa."
                    ]
                },
                {
                    paso: "2. Simplificación de la Rama Derecha (Reducción Serie).",
                    calculos: [
                        "En el extremo derecho, la fuente V1 está conectada en serie con R4 y R7 hacia el Nodo 3.",
                        "Podemos sumar estas resistencias para obtener una rama equivalente de Thévenin más limpia:",
                        `R_eq_derecha = R4 + R7 = ${formatoIngenieria(R4, 'Ω')} + ${formatoIngenieria(R7, 'Ω')} = ${formatoIngenieria(R_eq_der, 'Ω')}`,
                        `El circuito a la derecha del Nodo 3 es equivalente a una fuente de ${formatoIngenieria(V1, 'V')} en serie con ${formatoIngenieria(R_eq_der, 'Ω')}.`
                    ]
                },
                {
                    paso: "3. Transformación Norton a Thévenin (Extremo Izquierdo).",
                    calculos: [
                        "En la parte izquierda, tenemos la fuente I1 en paralelo con R6 entre los nodos 5 y 6. Este es un modelo de Norton.",
                        "Convertimos este bloque a un modelo de Thévenin (Voltaje en serie):",
                        `V_Thevenin_Izq = I1 * R6 = ${formatoIngenieria(I1, 'A')} * ${formatoIngenieria(R6, 'Ω')} = ${formatoIngenieria(V_th_izq, 'V')}`,
                        `Esta nueva fuente equivalente de voltaje queda en serie con R6 (${formatoIngenieria(R6, 'Ω')}).`
                    ]
                },
                {
                    paso: "4. Colapso Final de la Rama Izquierda.",
                    calculos: [
                        "Al realizar la transformación anterior, la resistencia R6 queda inmediatamente en serie con R1 en el camino hacia el Nodo 4.",
                        `R_eq_izquierda = R6 + R1 = ${formatoIngenieria(R6, 'Ω')} + ${formatoIngenieria(R1, 'Ω')} = ${formatoIngenieria(R_eq_izq, 'Ω')}`,
                        `Conclusión topológica: Toda la compleja sección izquierda se resume a una única rama conectada entre el Nodo 4 y 5, equivalente a una fuente de ${formatoIngenieria(V_th_izq, 'V')} en serie con ${formatoIngenieria(R_eq_izq, 'Ω')}.`
                    ]
                },
                {
                    paso: "5. Planteamiento de ecuaciones con KCL",
                    calculos: [
                        "Con el circuito reducido, aplicamos la Ley de Corrientes de Kirchhoff (KCL) en los tres nodos esenciales restantes (3, 4 y 5).",
                        "Al realizar las transformaciones de fuentes, eliminamos la necesidad de usar Supernodos, obteniendo un sistema de ecuaciones directo:",

                        `Nodo 3: (${formatoIngenieria(V1, 'V')} - V_N3)/${formatoIngenieria(R_eq_der, 'Ω')} = V_N3/${formatoIngenieria(R2, 'Ω')} + (V_N3 - V_N4)/${formatoIngenieria(R3, 'Ω')}`,
                        `Nodo 4: (${formatoIngenieria(V_th_izq, 'V')} + V_N5 - V_N4)/${formatoIngenieria(R_eq_izq, 'Ω')} = (V4 - V5)/${formatoIngenieria(R5, 'Ω')} + (V_N3 - V_N4)/${formatoIngenieria(R3, 'Ω')}`,
                        `Nodo 5: -V_N5/${formatoIngenieria(R8, 'Ω')} + (V_N4 - V_N5)/${formatoIngenieria(R5, 'Ω')} = (VN_5 + ${formatoIngenieria(V_th_izq, 'V')} - VN_4)/${formatoIngenieria(R_eq_izq, 'Ω')}`
                    ]

                },
                {
                    paso: "6. Calcular el voltaje de los nodos 2 y 6 después de resolver el sistema de ecuaciones anterior",
                    calculos: [
                        "Se cuentan con 3 ecuaciones de 3 Incógnitas. Es decisión del alumno utilizar el método de resolución de sistemas de ecuaciones deseado (Sustitución, Igualación, Reducción, Cramer o Gauss-Jordan).",
                        `Voltajes de N3, N4 y N5:`,
                        `V_N3 = ${V_N3}`,
                        `V_N4 = ${V_N4}`,
                        `V_N5 = ${V_N5}`,
                        "Una vez resuelto, podemos hallar el voltaje del Nodo 2 (V_N2) y el Nodo 6 (V_N6) del circuito original con otro par de ecuaciones KCL", 
                        `Para Nodo 3: (${V1} - V_N2)/${formatoIngenieria(R4, 'Ω')} = (V_N2 - ${V_N3})/${formatoIngenieria(R7, 'Ω')}`,
                        `Para Nodo 6: ${formatoIngenieria(I1, 'A')} = (V_N6 - ${V_N5})/${formatoIngenieria(R6, 'Ω')} + (V_N6 - ${V_N4})/${formatoIngenieria(R1, 'Ω')}`,
                        `Finalmente se tiene que el Voltaje de los nodos restantes es el siguiente:`,
                        `V_N2 = ${V_N2}`,
                        `V_N6 = ${V_N6}`
                    ]
                },
                {
                    paso: "7. Cálculo de Caídas de Voltaje en cada resistencias.",
                    calculos: [
                        "Con los voltajes nodales conocidos, podemos hallar cualquier voltaje de cada resistencia del circuito aplicando la caída de voltaje entre nodos, y después hallar su corriente utilizando Ley de ohm.",
                        `VR1 = ${formatoIngenieria(VR1, 'V')}`,
                        `VR2 = ${formatoIngenieria(VR2, 'V')}`,
                        `VR3 = ${formatoIngenieria(VR3, 'V')}`,
                        `VR4 = ${formatoIngenieria(VR4, 'V')}`,
                        `VR5 = ${formatoIngenieria(VR5, 'V')}`,
                        `VR6 = ${formatoIngenieria(VR6, 'V')}`,
                        `VR7 = ${formatoIngenieria(VR7, 'V')}`,
                        `VR8 = ${formatoIngenieria(VR8, 'V')}`
                    ]
                }
            ]
        };
    },
    'ID_9': (netlist, resultado) => {
        //Extraer valores
        const V1 = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const I1 = parsearValorElectrico(netlist.find(c => c.id === 'I1').value);
        const R1 = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const R3 = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);
        const R4 = parsearValorElectrico(netlist.find(c => c.id === 'R4').value);
        const R5 = parsearValorElectrico(netlist.find(c => c.id === 'R5').value);
        const RL = parsearValorElectrico(netlist.find(c => c.id === 'RL').value);

        // PASO 1: Calcular el Equivalente de Thévenin (Resolución Analítica Pura)
        const R_p1 = (R2 * R3) / (R2 + R3);
        const R_s1 = R_p1 + R4;
        const R_th = R5 + R_s1 + R1;

        const V_eq_der = V1 * (R3 / (R2 + R3));
        const V_th = (I1 * R_s1) + V_eq_der;

        // PASO 2: Extraer valores reales del MNA (Con el RL actual de 1k)
        const I_RL_MNA = resultado.currents['RL'];
        const P_RL_MNA = Math.pow(I_RL_MNA, 2) * RL;

        // PASO 3: Calcular la Potencia Máxima Posible
        const P_MAX_Teorica = Math.pow(V_th, 2) / (4 * R_th);

        return {
            titulo: "Teorema de Thévenin y Máxima Transferencia de Potencia en RL",
            pasos: [
                {
                    paso: "1. Objetivo del Teorema.",
                    calculos: [
                        "Para analizar la transferencia de potencia hacia la carga RL, primero debemos 'retirarla' del circuito para calcular el equivalente de Thévenin (V_th y R_th) visto desde sus terminales (Nodos 4 y 5)."
                    ]
                },
                {
                    paso: "2. Cálculo de la Resistencia de Thévenin (R_th).",
                    calculos: [
                        "Apagamos las fuentes (V1 se vuelve un cable, I1 se vuelve un circuito abierto) y reducimos las resistencias vistas desde los nodos 4 y 5.",
                        `R2 en paralelo con R3 = R_p1 = (R2 * R3) / (R2 + R3) = ${formatoIngenieria(R_p1, 'Ω')}`,
                        `Sumado en serie con R4 = R_s1 = R4 + R_p1 = ${formatoIngenieria(R_s1, 'Ω')}`,
                        `La ruta completa de Nodo 4 a 5 es: R5 + R_s1 + R1 = ${formatoIngenieria(R_th, 'Ω')}`,
                        `Teorema de Máxima Transferencia de Potencia: Para obtener la MÁXIMA potencia posible, la carga RL debería configurarse exactamente a ${formatoIngenieria(R_th, 'Ω')}.`
                    ]
                },
                {
                    paso: "3. Cálculo del Voltaje de Thévenin (V_th) por Reducción Sucesiva.",
                    calculos: [
                        "Con el circuito original y solo con RL retirada, reducimos el circuito de derecha a izquierda para hallar el voltaje de circuito abierto.",
                        `V1, R2 y R3 forman un equivalente de (con Divisor de Volaje): V_eq = V1 * (R3 / (R2 + R3)) = ${formatoIngenieria(V_eq_der, 'V')}, en serie con la resistencia r_p1: ${formatoIngenieria(R_p1, 'Ω')}.`,
                        `Toda la corriente de I1 (${formatoIngenieria(I1, 'A')}) fluye a través de R4 y R_p1 hacia esta fuente equivalente.`,
                        `V_th = (I1 * (R4 + R_p1)) + V_eq = (${formatoIngenieria(I1, 'A')} * ${formatoIngenieria(R_s1, 'Ω')}) + ${formatoIngenieria(V_eq_der, 'V')} = ${formatoIngenieria(V_th, 'V')}`
                    ]
                },
                {
                    paso: "4. Análisis de Potencia (Simulado vs Máximo Teórico).",
                    calculos: [
                        `Utilizando el Equivalente de Thévenin (V_th = ${formatoIngenieria(V_th, 'V')}, R_th = ${formatoIngenieria(R_th, 'Ω')}), analizamos el rendimiento:`,
                        `POTENCIA ACTUAL (Con RL = ${formatoIngenieria(RL, 'Ω')}): El motor MNA calcula una corriente de ${formatoIngenieria(I_RL_MNA, 'A')}. Potencia disipada = I²*R = ${formatoIngenieria(P_RL_MNA, 'W')}.`,
                        `POTENCIA MÁXIMA TEÓRICA (Si RL fuera ${formatoIngenieria(R_th, 'Ω')}): P_max = (V_th)² / (4 * R_th) = ${formatoIngenieria(P_MAX_Teorica, 'W')}.`
                    ]
                }
            ]
        };
    },
    'ID_10': (netlist, resultado) => {
        // 1. Extraer Parámetros Base
        const freq = parsearValorElectrico(netlist.find(c => c.id === 'V1').params.frequency);
        const C1_val = parsearValorElectrico(netlist.find(c => c.id === 'C1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2_val = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);

        // 2. Cálculos de Impedancia (Fasores)
        const omega = 2 * Math.PI * freq;
        const Xc = 1 / (omega * C1_val);
        const Zc = math.complex(0, -Xc);
        const Zr1 = math.complex(R1_val, 0);
        const Zr2 = math.complex(R2_val, 0);

        // Impedancia del bloque paralelo: Zp = (R2 * Zc) / (R2 + Zc)
        const Zp = math.divide(math.multiply(Zr2, Zc), math.add(Zr2, Zc));
        const Zp_polar = Zp.toPolar();
        const Zp_texto = `${formatoIngenieria(Zp_polar.r, 'Ω')} ∠ ${(Zp_polar.phi * 180 / Math.PI).toFixed(2)}°`;

        // Impedancia total equivalente: Zeq = R1 + Zp
        const Zeq = math.add(Zr1, Zp);
        const Zeq_polar = Zeq.toPolar();
        const Zeq_texto = `${formatoIngenieria(Zeq_polar.r, 'Ω')} ∠ ${(Zeq_polar.phi * 180 / Math.PI).toFixed(2)}°`;

        // 3. Obtener Datos del Motor MNA (Buscando el índice de frecuencia exacto)
        const freqSweep = resultado.frequencySweep;
        let closestIdx = 0;
        let minDiff = Infinity;
        freqSweep.forEach((f, idx) => {
            if (Math.abs(f - freq) < minDiff) {
                minDiff = Math.abs(f - freq);
                closestIdx = idx;
            }
        });

        // Extraemos voltajes y corrientes fasoriales calculados por el motor
        const v2_complex = math.complex(resultado.phasorVoltages['2'][closestIdx].re, resultado.phasorVoltages['2'][closestIdx].im);
        const iC1_complex = math.complex(resultado.phasorCurrents['C1'][closestIdx].re, resultado.phasorCurrents['C1'][closestIdx].im);
        const iR1_complex = math.complex(resultado.phasorCurrents['R1'][closestIdx].re, resultado.phasorCurrents['R1'][closestIdx].im);

        // Convertimos el JSON crudo a un objeto mathjs y luego a Polar
        const v2_math = math.complex(v2_complex.re, v2_complex.im);
        const v2_polar = v2_math.toPolar(); 
        // toPolar devuelve { r: magnitud, phi: angulo en radianes }
        
        const v2_magnitud = formatoIngenieria(v2_polar.r, 'V');
        const v2_angulo_grados = (v2_polar.phi * 180 / Math.PI).toFixed(2);

        const iC1_math = math.complex(iC1_complex.re, iC1_complex.im);
        const iC1_polar = iC1_math.toPolar();
        const iC1_magnitud = formatoIngenieria(iC1_polar.r, 'A');
        const iC1_angulo_grados = (iC1_polar.phi * 180 / Math.PI).toFixed(2);

        return {
            titulo: "Análisis AC en Estado Estable (Fasores e Impedancia)",
            pasos: [
                {
                    paso: "1. De Dominio del Tiempo a Dominio de la Frecuencia.",
                    calculos: [
                        "Al estar alimentado por una onda senoidal pura, no usamos ecuaciones diferenciales, sino Álgebra Fasorial.",
                        `Calculamos la frecuencia angular (ω) = 2πf = 2 * π * ${freq}Hz = ${omega.toFixed(2)} rad/s.`,
                        `f es la frecuencia de la fuente`
                    ]
                },
                {
                    paso: "2. Reactancia Capacitiva e Impedancia.",
                    calculos: [
                        "En AC, los capacitores oponen una 'resistencia' llamada Reactancia (Xc) que depende de la frecuencia.",
                        `Xc = 1 / (ω * C1) = 1 / (${omega.toFixed(2)} * ${formatoIngenieria(C1_val, 'F')}) = ${formatoIngenieria(Xc, 'Ω')}.`,
                        `En notación compleja, la impedancia del capacitor retrasa el voltaje 90°, por lo que: Z_C1 = -j${Xc.toFixed(2)} Ω.`
                    ]
                },
                {
                    paso: "3. Reducción del Circuito (Álgebra Compleja).",
                    calculos: [
                        "El circuito se resuelve igual que en DC, pero usando números complejos.",
                        `La impedancia de las resistencias (Z_R): No cambian. Z_R1 = ${formatoIngenieria(R1_val, 'Ω')}, Z_R2 = ${formatoIngenieria(R2_val, 'Ω')}.`,
                        `R2 está en paralelo con C1. Su impedancia equivalente es: Z_p = (Z_R2 * Z_C1) / (Z_R2 + Z_C1) = = ${Zp_texto} (Bloque Paralelo).`,
                        "Z_p queda en serie con R1, formando la Impedancia Total (Z_eq) que 've' la fuente.",
                        `Z_eq = R1 + Z_p = ${Zeq_texto}`
                    ]
                },
                {
                    paso: "4. Aplicación de la Ley de Ohm en el dominio Fasorial.",
                    calculos: [
                        "Utilizamos el voltaje de la fuente (Vin) y las impedancias calculadas para hallar flujos y tensiones:",
                        `Corriente Total (Itot) = Vin / Zeq = ${formatoIngenieria(V1_val, 'V')} / ${Zeq_texto}`,
                        `Voltaje en Nodo 2 (V2) = Itot * Zp`,
                        `Corriente en Capacitor (IC1) = V2 / Zc`
                    ]
                },
                {
                    paso: "5. Resultados Finales del Motor MNA.",
                    calculos: [
                        "El sistema resuelve las matrices de admitancia compleja para obtener la magnitud y el desfase real:",
                        `Voltaje en Nodo 2: ${formatoIngenieria(v2_math.toPolar().r, 'V')} ∠ ${(v2_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Corriente por Capacitor (C1): ${formatoIngenieria(iC1_math.toPolar().r, 'A')} ∠ ${(iC1_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Corriente Total (R1): ${formatoIngenieria(iR1_complex.toPolar().r, 'A')} ∠ ${(iR1_complex.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        "Nota: La corriente en C1 adelanta al voltaje en sus terminales, confirmando el comportamiento capacitivo del circuito."
                    ]
                }
            ]
        };
    },
    'ID_11': (netlist, resultado) => {
        // 1. Extraer Parámetros Base
        const freq = parsearValorElectrico(netlist.find(c => c.id === 'V1').params.frequency);
        const L1_val = parsearValorElectrico(netlist.find(c => c.id === 'L1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);

        // 2. Cálculos de Impedancia (Fasores)
        const omega = 2 * Math.PI * freq;
        const Xl = omega * L1_val;
        
        // El inductor tiene impedancia imaginaria positiva (+jXl)
        const Zl = math.complex(0, Xl);
        const Zr = math.complex(R1_val, 0);

        // Impedancia total equivalente (Serie): Zeq = R1 + Zl
        const Zeq = math.add(Zr, Zl);
        const Zeq_polar = Zeq.toPolar();
        const Zeq_texto = `${formatoIngenieria(Zeq_polar.r, 'Ω')} ∠ ${(Zeq_polar.phi * 180 / Math.PI).toFixed(2)}°`;

        // 3. Buscar el índice de frecuencia exacto para MNA
        const freqSweep = resultado.frequencySweep;
        let closestIdx = 0;
        let minDiff = Infinity;
        freqSweep.forEach((f, idx) => {
            if (Math.abs(f - freq) < minDiff) {
                minDiff = Math.abs(f - freq);
                closestIdx = idx;
            }
        });

        // 4. Extraer fasores del motor
        const v2_math = math.complex(resultado.phasorVoltages['2'][closestIdx].re, resultado.phasorVoltages['2'][closestIdx].im);
        const iL1_math = math.complex(resultado.phasorCurrents['L1'][closestIdx].re, resultado.phasorCurrents['L1'][closestIdx].im);
        
        // En serie, la corriente del inductor es la misma que la de la resistencia
        const iR1_math = math.complex(resultado.phasorCurrents['R1'][closestIdx].re, resultado.phasorCurrents['R1'][closestIdx].im);

        return {
            titulo: "Análisis Circuito RL Serie (Fasores)",
            pasos: [
                {
                    paso: "1. Frecuencia Angular e Impedancias Base.",
                    calculos: [
                        `Frecuencia angular (ω) = 2πf = 2 * π * ${freq} Hz = ${omega.toFixed(2)} rad/s.`,
                        `Recordemos que f es la frecuencia de la fuente.`,
                        `A diferencia del capacitor, la Reactancia Inductiva (Xl) crece con la frecuencia: Xl = ω * L1 = ${omega.toFixed(2)} * ${formatoIngenieria(L1_val, 'H')} = ${formatoIngenieria(Xl, 'Ω')}.`,
                        `La impedancia del inductor adelanta el voltaje 90°, representándose como un imaginario positivo: Z_L1 = +j${Xl.toFixed(2)} Ω.`
                    ]
                },
                {
                    paso: "2. Impedancia Equivalente (Zeq).",
                    calculos: [
                        "Al estar los componentes en serie, la oposición total al flujo de AC es la suma directa de sus impedancias complejas:",
                        `Zeq = Z_R1 + Z_L1 = ${R1_val} + j${Xl.toFixed(2)} Ω`,
                        `Transformando a forma polar (Magnitud y Ángulo): Zeq = ${Zeq_texto}`
                    ]
                },
                {
                    paso: "3. Ley de Ohm Fasorial.",
                    calculos: [
                        "Con la impedancia total, calculamos la corriente extraída de la fuente (Itot) y la caída de tensión en R1 (Nodo 2).",
                        `Corriente Total (Itot) = V_in / Zeq = ${formatoIngenieria(V1_val, 'V')} ∠ 0° / ${Zeq_texto} = ${formatoIngenieria(iR1_math.toPolar().r, 'A')} ∠ ${(iR1_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Voltaje en Nodo 2 (V2) = Itot * Z_R1 = ${formatoIngenieria(v2_math.toPolar().r, 'V')} ∠ ${(v2_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`
                    ]
                },
                {
                    paso: "4. Resultados Finales del Motor MNA.",
                    calculos: [
                        "El motor confirma los cálculos fasoriales para la frecuencia especificada:",
                        `Corriente Total del Circuito: ${formatoIngenieria(iR1_math.toPolar().r, 'A')} ∠ ${(iR1_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Voltaje en Nodo 2 (Carga R1): ${formatoIngenieria(v2_math.toPolar().r, 'V')} ∠ ${(v2_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        "Nota: El ángulo negativo de la corriente indica que esta 'se retrasa' respecto al voltaje de la fuente, confirmando el efecto inductivo."
                    ]
                }
            ]
        };
    },
    'ID_12': (netlist, resultado) => {

        // 1. Extraer Parámetros
        const freq = parsearValorElectrico(netlist.find(c => c.id === 'V1').params.frequency);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const L1_val = parsearValorElectrico(netlist.find(c => c.id === 'L1').value);
        const C1_val = parsearValorElectrico(netlist.find(c => c.id === 'C1').value);
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);

        // 2. Cálculos de Reactancias
        const omega = 2 * Math.PI * freq;
        const Xl = omega * L1_val;
        const Xc = 1 / (omega * C1_val);
        
        // Creación de fasores
        const Zr = math.complex(R1_val, 0);
        const Zl = math.complex(0, Xl);
        const Zc = math.complex(0, -Xc);

        // Impedancia Total (Suma de los tres)
        const Zeq = math.add(math.add(Zr, Zl), Zc);
        const Zeq_polar = Zeq.toPolar();
        const Zeq_texto = `${formatoIngenieria(Zeq_polar.r, 'Ω')} ∠ ${(Zeq_polar.phi * 180 / Math.PI).toFixed(2)}°`;

        // 3. Extracción del MNA (Punto exacto de frecuencia)
        const freqSweep = resultado.frequencySweep;
        let closestIdx = 0;
        let minDiff = Infinity;
        freqSweep.forEach((f, idx) => {
            if (Math.abs(f - freq) < minDiff) {
                minDiff = Math.abs(f - freq);
                closestIdx = idx;
            }
        });

        // Fasores de corriente y voltajes intermedios
        const iTot_math = math.complex(resultado.phasorCurrents['R1'][closestIdx].re, resultado.phasorCurrents['R1'][closestIdx].im);
        
        // En tu diagrama, el Nodo 2 está entre L1 y R1, y el Nodo 3 está entre R1 y C1
        const v2_math = math.complex(resultado.phasorVoltages['2'][closestIdx].re, resultado.phasorVoltages['2'][closestIdx].im);
        const v3_math = math.complex(resultado.phasorVoltages['3'][closestIdx].re, resultado.phasorVoltages['3'][closestIdx].im);

        // Lógica didáctica para ver qué componente domina
        let comportamiento = "";
        if (Xl > Xc) comportamiento = "inductivo (la reactancia del inductor es mayor)";
        else if (Xc > Xl) comportamiento = "capacitivo (la reactancia del capacitor es mayor)";
        else comportamiento = "puramente resistivo (¡Resonancia! Se cancelan mutuamente)";

        return {
            titulo: "Análisis AC: Circuito RLC Serie",
            pasos: [
                {
                    paso: "1. Cálculo de Reactancias Opuestas.",
                    calculos: [
                        `En un circuito RLC, el inductor y el capacitor actúan en direcciones opuestas.`,
                        `Frecuencia angular (ω) = ${omega.toFixed(2)} rad/s.`,
                        `Reactancia Inductiva (+jXl) = +j${Xl.toFixed(2)} Ω (Tira hacia arriba en la fase).`,
                        `Reactancia Capacitiva (-jXc) = -j${Xc.toFixed(2)} Ω (Tira hacia abajo en la fase).`,
                        `A la frecuencia de ${formatoIngenieria(freq, 'Hz')}, el circuito tiene un comportamiento fuertemente ${comportamiento}.`
                    ]
                },
                {
                    paso: "2. Impedancia Total Equivalente (Zeq).",
                    calculos: [
                        "Al estar en serie, las reactancias se restan directamente y se suman a la parte real (resistencia):",
                        `Zeq = Z_R1 + Z_L1 + Z_C1 = ${R1_val} + j${Xl.toFixed(2)} - j${Xc.toFixed(2)} Ω`,
                        `Zeq = ${R1_val} - j${(Xc - Xl).toFixed(2)} Ω`,
                        `Transformando a forma polar: Zeq = ${Zeq_texto}`
                    ]
                },
                {
                    paso: "3. Ley de Ohm Fasorial (Corriente Principal).",
                    calculos: [
                        `Corriente Total (Itot) = V_in / Zeq = ${formatoIngenieria(V1_val, 'V')} ∠ 0° / ${Zeq_texto}`,
                        "Esta corriente es la misma para los tres componentes al estar en un lazo único serie."
                    ]
                },
                {
                    paso: "4. Resultados del Motor MNA.",
                    calculos: [
                        "El sistema matricial confirma los cálculos fasoriales resolviendo los nodos:",
                        `Corriente Total: ${formatoIngenieria(iTot_math.toPolar().r, 'A')} ∠ ${(iTot_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Voltaje en Nodo 2 (Entrada R1): ${formatoIngenieria(v2_math.toPolar().r, 'V')} ∠ ${(v2_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`,
                        `Voltaje en Nodo 3 (Entrada C1): ${formatoIngenieria(v3_math.toPolar().r, 'V')} ∠ ${(v3_math.toPolar().phi * 180 / Math.PI).toFixed(2)}°`
                    ]
                }
            ]
        };
    },
    'ID_13': (netlist, resultado) => {
        // 1. Extraer Parámetros
        const Vp_in = parsearValorElectrico(netlist.find(c => c.id === 'V1').value); //El sistema ya guarda la amplitud de la onda de la fuente en su atributo value
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        
        // Extraer los parámetros no lineales del diodo (por si decidieron cambiarlos en el frontend)
        const diodoParams = netlist.find(c => c.id === 'D1').params || {};
        const Is = parsearValorElectrico((diodoParams.is_saturacion === '1e-14' ? '0.01p' : '1p')); 
        const Vd_caida = parsearValorElectrico(diodoParams.caida_tension || '0.7'); 

        // 2. Cálculos Teóricos 
        const Vp_out = Vp_in - Vd_caida;
        const Ip_out = Vp_out / R1_val;
        const V_dc = Vp_out / Math.PI; // Promedio de media onda
        const I_dc = Ip_out / Math.PI;

        return {
            titulo: "Análisis Transitorio: Rectificador de Media Onda",
            pasos: [
                {
                    paso: "1. Identificación de Señal Pico.",
                    calculos: [
                        "La fuente de voltaje de corriente alterna cuenta con el valor máximo que alcanza la onda, este valor es el voltaje pico (Vp).",
                        `V_pico_entrada = ${formatoIngenieria(Vp_in, 'V')}`
                    ]
                },
                {
                    paso: "2. Comportamiento No Lineal del Diodo (Polarización Directa e Inversa).",
                    calculos: [
                        "El diodo D1 actúa como una válvula de un solo sentido gobernada por la Ecuación de Shockley.",
                        `Semiciclo Positivo: Cuando la entrada supera la barrera del diodo (~${Vd_caida}V), este conduce.`,
                        `Semiciclo Negativo: El diodo se bloquea (Corriente de fuga muy pequeña, Is = ${formatoIngenieria(Is, 'A')}), recortando la onda a 0V en la carga (R1).`
                    ]
                },
                {
                    paso: "3. Cálculo de Picos en la Carga (R1).",
                    calculos: [
                        "Debido a la barrera de potencial del diodo, el voltaje máximo que llega a la carga es ligeramente menor que el de la fuente.",
                        `Voltaje Pico en R1 (V_Nodo2) = V_pico_entrada - Vd = ${formatoIngenieria(Vp_in, 'V')} - ${Vd_caida}V = ${formatoIngenieria(Vp_out, 'V')}`,
                        `Corriente Pico en R1 (Ley de Ohm) = V_pico_out / R1 = ${formatoIngenieria(Vp_out, 'V')} / ${formatoIngenieria(R1_val, 'Ω')} = ${formatoIngenieria(Ip_out, 'A')}`
                    ]
                },
                {
                    paso: "4. Nivel de Voltaje Promedio (DC).",
                    calculos: [
                        "Como el diodo bloquea la mitad de la onda, el valor promedio (lo que leería un multímetro en modo DC) es el área del semiciclo positivo dividida entre el periodo completo.",
                        `Voltaje Promedio (V_DC) = V_pico_out / π = ${formatoIngenieria(Vp_out, 'V')} / 3.1416 = ${formatoIngenieria(V_dc, 'V')}`,
                        `Corriente Promedio (A_DC) = A_pico_out / π = ${formatoIngenieria(Ip_out, 'A')} / 3.1416 = ${formatoIngenieria(I_dc, 'A')}`,
                        "Nota: Al observar la gráfica del análisis transitorio, verás cómo el voltaje en el Nodo 2 forma 'montañas' separadas por espacios planos en 0V."
                    ]
                }
            ]
        };
    },
    'ID_14': (netlist, resultado) => {
        // 1. Extraer Parámetros
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const RL_val = parsearValorElectrico(netlist.find(c => c.id === 'RL').value);
        
        // Extraemos el parámetro Vz del Zener (asumimos 5.1V por defecto si no lo tiene)
        const zenerParams = netlist.find(c => c.id === 'D1').params || {};
        const Vz_val = parsearValorElectrico(zenerParams.voltaje_inv_max || '5.1'); 

        // 2. Cálculos Teóricos Didácticos
        const V_open = V1_val * (RL_val / (R1_val + RL_val));
        
        let estaRegulando = V_open >= Vz_val;
        let V_load = estaRegulando ? Vz_val : V_open;
        
        const V_R1 = V1_val - V_load;
        const I_S = V_R1 / R1_val;
        const I_L = V_load / RL_val;
        const I_Z = estaRegulando ? (I_S - I_L) : 0;

        // 3. Extraer valores del motor MNA (Resolución real no lineal)
        // (Ajusta estas llaves de acuerdo a cómo tu motor transitorio/DC devuelva los datos del Zener)
        const v2_mna = resultado.voltages ? resultado.voltages['2'] : V_load; 
        const iZ_mna = resultado.currents ? Math.abs(resultado.currents['D1']) : I_Z;

        return {
            titulo: "Regulación de Voltaje con Diodo Zener",
            pasos: [
                {
                    paso: "1. Prueba de Estado (Voltaje de Circuito Abierto).",
                    calculos: [
                        "Para que el diodo Zener regule el voltaje, el circuito debe poder suministrar un voltaje superior al umbral Zener (Vz) si el diodo no estuviera allí.",
                        `V_abierto = V1 * [RL / (R1 + RL)] = ${formatoIngenieria(V1_val, 'V')} * [${formatoIngenieria(RL_val, 'Ω')} / (${formatoIngenieria(R1_val, 'Ω')} + ${formatoIngenieria(RL_val, 'Ω')})] = ${formatoIngenieria(V_open, 'V')}`,
                        estaRegulando 
                            ? `Como V_abierto (${V_open.toFixed(2)}V) >= Vz (${Vz_val}V), el Zener ESTÁ EN RUPTURA y fijará el voltaje a ${Vz_val}V.`
                            : `Como V_abierto (${V_open.toFixed(2)}V) < Vz (${Vz_val}V), el Zener está APAGADO y no regula. El voltaje será ${V_open.toFixed(2)}V.`
                    ]
                },
                {
                    paso: "2. Voltaje y Corriente de la Resistencia Serie (R1).",
                    calculos: [
                        "La resistencia R1 se encarga de absorber la diferencia de voltaje entre la fuente de alimentación y la carga regulada.",
                        `Caída en R1 = V1 - V_carga = ${V1_val}V - ${V_load.toFixed(2)}V = ${formatoIngenieria(V_R1, 'V')}`,
                        `Corriente Total (Itotal) = V_R1 / R1 = ${formatoIngenieria(V_R1, 'V')} / ${formatoIngenieria(R1_val, 'Ω')} = ${formatoIngenieria(I_S, 'A')}`
                    ]
                },
                {
                    paso: "3. Ley de Corrientes de Kirchhoff (KCL en el Nodo 2).",
                    calculos: [
                        "La corriente total (Itotal) llega al Nodo 2 y se divide entre la resistencia de carga (RL) y el diodo Zener (D1).",
                        `Corriente en la Carga (Il) = V_carga / RL = ${formatoIngenieria(V_load, 'V')} / ${formatoIngenieria(RL_val, 'Ω')} = ${formatoIngenieria(I_L, 'A')}`,
                        `Corriente absorbida por el Zener (Iz) = Itotal - Il = ${formatoIngenieria(I_S, 'A')} - ${formatoIngenieria(I_L, 'A')} = ${formatoIngenieria(I_Z, 'A')}`,
                        "Nota: El Zener actúa como una válvula de alivio, desviando a tierra toda la corriente que la carga no necesita."
                    ]
                },
                {
                    paso: "4. Confirmación del Motor No Lineal.",
                    calculos: [
                        "El motor interno resuelve el circuito iterativamente usando el modelo exponencial del diodo, confirmando:",
                        `Voltaje Regulado (Nodo 2): ${formatoIngenieria(v2_mna, 'V')}`,
                        `Corriente de Zener (Iz): ${formatoIngenieria(iZ_mna, 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_15': (netlist, resultado) => {
        //Extraer Parámetros
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);

        // Extraer parámetros teóricos del LED (Nominal)
        const ledParams = netlist.find(c => c.id === 'D1').params || {};
        const Vf_teorico = parsearValorElectrico(ledParams.caida_tension || '2.1'); 

        // 2. Extraer Valores EXACTOS del Motor MNA
        const v2_mna = formatoIngenieria(resultado.voltages['2'], 'V');
        // Usamos la corriente de R1 o D1 (están en serie)
        const iLED_mna = Math.abs(resultado.currents['R1']); 

        // 3. Cálculos Didácticos Ideales (Para contrastar con la realidad)
        const enciende_teoria = V1_val > Vf_teorico;
        const V_R1_teorico = enciende_teoria ? (V1_val - Vf_teorico) : 0;
        const I_teorica = V_R1_teorico / R1_val;
        return {
            titulo: "Polarización de Diodo Emisor de Luz (LED)",
            pasos: [
                {
                    paso: "1. Características del Componente (Voltaje Directo).",
                    calculos: [
                        "Los LEDs son semiconductores que emiten fotones al ser atravesados por corriente.",
                        "A diferencia de un diodo rectificador normal de silicio (~0.7V), los LEDs tienen una caída de tensión directa (Vf) mayor, la cual depende del color de su luz.",
                        `Para este LED, el voltaje típico de operación (Vf) se estima en aproximadamente ${formatoIngenieria(Vf_teorico, 'V')}.`
                    ]
                },
                {
                    paso: "2. El Modelo Ideal (Aproximación Constante).",
                    calculos: [
                        "En el análisis de papel, se suele usar un modelo simplificado donde se asume que si el LED enciende, su voltaje se 'clava' exactamente en su valor nominal.",
                        `Valor Vf teórico asumido = ${Vf_teorico}V.`,
                        enciende_teoria 
                            ? `Corriente teórica (I) = (V1 - Vf) / R1 = (${V1_val}V - ${Vf_teorico}V) / ${R1_val}Ω = ${formatoIngenieria(I_teorica, 'A')}`
                            : `Como la fuente es menor al Vf teórico, idealmente asumimos corriente = 0A.`
                    ]
                },
                {
                    paso: "3. El Comportamiento Físico Real (Semiconductor).",
                    calculos: [
                        "Sin embargo, el diodo no es un interruptor perfecto. Su resistencia interna y su caída de voltaje cambian dinámicamente dependiendo de la cantidad exacta de corriente que lo atraviesa (Ecuación de Shockley).",
                        "Esto significa que el voltaje en el LED no es un número rígido, sino que se ajusta logarítmicamente para encontrar un equilibrio físico con la resistencia R1."
                    ]
                },
                {
                    paso: "4. Resultados del Motor MNA (Simulación Avanzada).",
                    calculos: [
                        `El simulador no usa aproximaciones. Realizó ${resultado.iterations} iteraciones matemáticas para encontrar el punto de operación exacto en la curva característica del LED:`,
                        `Voltaje REAL en el LED (Nodo 2) = ${v2_mna}`,
                        `Corriente REAL en el circuito = ${formatoIngenieria(iLED_mna, 'A')}`,
                        `Nota de ingeniería: Observa cómo el voltaje real (${v2_mna}) difiere de la aproximación de ${Vf_teorico}V. ¡Esta precisión es la verdadera utilidad de un simulador de circuitos!`
                    ]
                }
            ]
        };
    },
    'ID_16': (netlist, resultado) => {
        // Extraer Parámetros
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        
        const regulador_params = netlist.find(c => c.id === 'U1').params || {};
        // Parámetros nominales del 7805
        const Vout_nominal = parsearValorElectrico(regulador_params.voltaje_salida || 5.0); 
        const V_dropout = parsearValorElectrico(regulador_params.dropout_voltage || 2.0); // Dropout típico de la familia 78XX

        // 2. Extraer Valores del Motor MNA (La Realidad)
        const v2_mna = resultado.voltages['2']; // Voltaje real de salida
        const i_load_mna = Math.abs(resultado.currents['R1']); 
        
        // Asumiendo que tu motor devuelve las corrientes de los pines del subcircuito/modelo U1
        // Si no, puedes aproximar Iq a 5mA para la teoría
        const i_in_mna = Math.abs(resultado.currents['V1']); 
        const i_q_mna = i_in_mna - i_load_mna; // Corriente por el pin Common

        // 3. Cálculos de Potencia y Eficiencia (Basados en resultados reales)
        const P_load = v2_mna * i_load_mna;
        const P_in = V1_val * i_in_mna;
        const P_reg_dissipated = P_in - P_load; 
        const Eficiencia = (P_load / P_in) * 100;

        // Evaluación de estado
        const tieneSuficienteVoltaje = V1_val >= (Vout_nominal + V_dropout);

        return {
            titulo: "Regulador Lineal Fijo (LM7805)",
            pasos: [
                {
                    paso: "1. Comprobación de las Condiciones de Operación.",
                    calculos: [
                        "Los reguladores lineales como el LM7805 necesitan que el voltaje de entrada sea superior al de salida por un margen conocido como 'Voltaje de Caída' (Dropout Voltage, típicamente ~2V).",
                        `Voltaje mínimo requerido = Vout_nominal + V_dropout = ${Vout_nominal}V + ${V_dropout}V = ${Vout_nominal + V_dropout}V.`,
                        tieneSuficienteVoltaje
                            ? `Como Vin (${V1_val}V) es suficiente, el regulador operará correctamente entregando ${Vout_nominal}V.`
                            : `¡ATENCIÓN! Vin (${V1_val}V) es MENOR al mínimo requerido. El regulador está en estado de 'Dropout' y no podrá alcanzar los ${Vout_nominal}V prometidos.`
                    ]
                },
                {
                    paso: "2. Comportamiento de los Capacitores de Filtrado.",
                    calculos: [
                        "En un análisis de Estado Estable DC, los capacitores C1 y C2 se comportan como circuitos abiertos.",
                        "Corriente por C1 = 0 A.",
                        "Corriente por C2 = 0 A.",
                        "Su función principal es mitigar el rizado si la fuente fuera pulsante o atenuar transitorios al encender el circuito."
                    ]
                },
                {
                    paso: "3. Análisis de Corrientes del Regulador (Motor MNA).",
                    calculos: [
                        "Aplicamos la Ley de Corrientes de Kirchhoff en el regulador: I_in = I_out + I_q (Corriente Quiescente).",
                        "La corriente Quiescente del Regulador (I_q), es la corriente que se va por el pin de Tierra (Common). Un 7805 típico consume unos 5 mA solo por existir, independientemente de la carga.",
                        `Voltaje REAL en la carga (Nodo 2) = ${formatoIngenieria(v2_mna, 'V')}`,
                        `Corriente de Carga (I_out) = V_Nodo2 / R1 = ${formatoIngenieria(v2_mna, 'V')} / ${formatoIngenieria(R1_val, 'Ω')} = ${formatoIngenieria(i_load_mna, 'A')}`,
                        `Corriente de Entrada suministrada por V1 (I_in) = ${formatoIngenieria(i_in_mna, 'A')}`,
                        `Corriente Quiescente perdida por el pin Common (I_q) = I_in - I_out = ${formatoIngenieria(i_q_mna, 'A')}`
                    ]
                },
                {
                    paso: "4. Análisis de Potencia y Eficiencia Térmica.",
                    calculos: [
                        "Los reguladores lineales disipan el exceso de energía en forma de calor.",
                        `Potencia Entregada a la Carga (P_load) = V_out * I_out = ${formatoIngenieria(P_load, 'W')}`,
                        `Potencia Total Consumida (P_in) = Vin * I_in = ${formatoIngenieria(P_in, 'W')}`,
                        `Potencia Disipada como Calor en el LM7805 (P_reg) = P_in - P_load = ${formatoIngenieria(P_reg_dissipated, 'W')}`,
                        `Eficiencia del Regulador (η) = (P_load / P_in) * 100 = ${Eficiencia.toFixed(2)} %`
                    ]
                }
            ]
        };
    },
    'ID_17': (netlist, resultado) => {
        // Extraer Parámetros
        const Vcc = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const Rc = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const Rb = parsearValorElectrico(netlist.find(c => c.id === 'R2').value);
        const Re = parsearValorElectrico(netlist.find(c => c.id === 'R3').value);

        // Extraer parámetros del Transistor (Ganancia Beta y caída Vbe)
        const q1Params = netlist.find(c => c.id === 'Q1').params || {};
        const beta = parsearValorElectrico(q1Params.beta || 100);
        const Vbe_teo = parsearValorElectrico(q1Params.vbe_saturacion || 0.7); // Caída típica para silicio

        // 2. Cálculos Teóricos Didácticos
        const Ib_teo = (Vcc - Vbe_teo) / (Rb + (beta + 1) * Re);
        const Ic_teo = beta * Ib_teo;
        const Ie_teo = (beta + 1) * Ib_teo;
        
        const Vce_teo = Vcc - (Ic_teo * Rc) - (Ie_teo * Re);
        const Ic_sat = Vcc / (Rc + Re);

        // Identificar región teórica
        let regionTeorica = "Región Activa Lineal";
        let explicacion_saturacion = "";

        if (Vce_teo < 0.2) {
            regionTeorica = "Saturación";
            explicacion_saturacion = `¡ATENCIÓN! El Vce teórico dio un valor imposible (${Vce_teo.toFixed(3)} V). Esto significa que la alta ganancia (β = ${beta}) exige más corriente de la que la fuente de ${Vcc}V puede entregar. El transistor chocó con su 'techo' físico y entró en SATURACIÓN.`;
        } else if (Ib_teo <= 0) {
            regionTeorica = "Corte";
        }

        // Extraer Valores del Motor MNA (No lineal, Ebers-Moll / Gummel-Poon)
        const vC_mna = resultado.voltages['2'];
        const vB_mna = resultado.voltages['3'];
        const vE_mna = resultado.voltages['4'];

        const Vce_mna = vC_mna - vE_mna;
        const Vbe_mna = vB_mna - vE_mna;

        // Corrientes extraídas del componente BJT o por las ramas correspondientes
        const Ic_mna = Math.abs(resultado.currents['R1']); 
        const Ib_mna = Math.abs(resultado.currents['R2']);
        const Ie_mna = Math.abs(resultado.currents['R3']);

        return {
            titulo: "Análisis DC: Polarización Estabilizada en Emisor (BJT)",
            pasos: [
                {
                    paso: "1. Análisis de la Malla de Entrada (Base-Emisor).",
                    calculos: [
                        "Aplicamos KVL en la ruta que alimenta la base del transistor (Nodos 1, 3 y 4), asumiendo una caída nominal de Vbe = 0.7V.",
                        `Ecuación: Vcc - (Ib * Rb) - Vbe - (Ie * Re) = 0`,
                        `Como Ie = (β + 1) * Ib, despejamos la corriente de base (Ib):`,
                        `Ib = (Vcc - Vbe) / (Rb + (β + 1) * Re) = (${formatoIngenieria(Vcc, 'V')} - ${formatoIngenieria(Vbe_teo, 'V')}) / (${formatoIngenieria(Rb, 'Ω')} + ${beta + 1} * ${formatoIngenieria(Re, 'Ω')}) = ${formatoIngenieria(Ib_teo, 'A')}`
                    ]
                },
                {
                    paso: "2. Intento de Amplificación de Corriente. (Modelo Lineal)",
                    calculos: [
                        `Si el transistor operara como un amplificador perfecto (Región Activa), multiplicaríamos Ib por la ganancia (β = ${beta}):`,
                        `Corriente de Colector (Ic) = β * Ib = ${beta} * ${formatoIngenieria(Ib_teo, 'A')} = ${formatoIngenieria(Ic_teo, 'A')}`,
                        `Corriente de Emisor (Ie) = Ib + Ic = ${formatoIngenieria(Ie_teo, 'A')}`
                    ]
                },
                {
                    paso: "3. Prueba de Límites Físicos y Recta de Carga.",
                    calculos: [
                        "Evaluamos si el circuito tiene suficiente voltaje para soportar esa corriente teórica calculando Vce:",
                        `Vce_teórico = Vcc - (Ic * Rc) - (Ie * Re) = ${Vce_teo.toFixed(3)} V`,
                        explicacion_saturacion || `Como Vce > 0.2V, el transistor está operando en la ${regionTeorica}.`,
                        `El techo máximo real del circuito (Ic_sat) es = Vcc / (Rc + Re) = ${formatoIngenieria(Ic_sat, 'A')}. La corriente del colector nunca podrá superar este valor.`
                    ]
                },
                {
                    paso: "4. Resolución Exacta del Motor MNA (Ebers-Moll).",
                    calculos: [
                        "El motor no usa aproximaciones lineales, sino las ecuaciones exponenciales físicas de los semiconductores, descubriendo la realidad del circuito:",
                        `Estado Real (Vce) = ${Vce_mna.toFixed(3)} V (Confirma la ${regionTeorica})`,
                        `Corrientes Reales topadas por el circuito: Ib = ${formatoIngenieria(Ib_mna, 'A')}, Ic = ${formatoIngenieria(Ic_mna, 'A')}, Ie = ${formatoIngenieria(Ie_mna, 'A')}`
                    ]
                }
            ]
        };
    },
    'ID_18': (netlist, resultado) => {
        // 1. Extraer Parámetros
        const V1_val = parsearValorElectrico(netlist.find(c => c.id === 'V1').value);
        const R1_val = parsearValorElectrico(netlist.find(c => c.id === 'R1').value);
        const R2 = parsearValorElectrico(netlist.find(c => c.id === 'R2').value); //Valor Nominal del Potenciómetro
        const R2_wiper = Math.min(0.999, Math.max(0.001, parsearValorElectrico(netlist.find(c => c.id === 'R2').params.wiper)));
        const regulador_params = netlist.find(c => c.id === 'U1').params || {};
        // extraemos el valor real que tiene el potenciometro ajustado con el cursor (wiper)
        const R2_val = R2 * R2_wiper; 
        const R3_load = parsearValorElectrico(netlist.find(c => c.id === 'R3').value); // Carga RL

        // Parámetros internos del LM317
        const Vref = parsearValorElectrico(regulador_params.voltaje_salida || 1.25); 
        const V_dropout = parsearValorElectrico(regulador_params.dropout_voltage || 2.0);
        
        console.log("Voltaje de V_drop: ", V_dropout)
        const I_adj = 0.00005; // 50 uA, la corriente quiescente del ADJ

        // 2. Cálculos Teóricos de Alta Precisión
        // Vout = Vref * (1 + R2/R1) + (Iadj * R2)
        const V_resistencia = Vref * (1 + (R2_val / R1_val));
        const V_error_Iadj = I_adj * R2_val;
        const Vout_teo = V_resistencia + V_error_Iadj;
        
        const tieneSuficienteVoltaje = V1_val >= (Vout_teo + V_dropout);

        // 3. Extraer Valores del Motor MNA 
        const vOut_mna = resultado.voltages['2']; // Nodo de salida regulada
        
        const i_load_mna = Math.abs(resultado.currents['R3']); 
        const i_in_mna = Math.abs(resultado.currents['V1']); 

        // 4. Cálculos Térmicos y de Eficiencia
        const P_load = vOut_mna * i_load_mna;
        const P_in = V1_val * i_in_mna;
        const P_reg_dissipated = P_in - P_load; 
        const Eficiencia = (P_load / P_in) * 100;

        return {
            titulo: "Análisis de un Regulador Variable (LM317)",
            pasos: [
                {
                    paso: "1. Ecuación Completa de Programación de Voltaje.",
                    calculos: [
                        "El LM317 intenta mantener 1.25V entre OUT y ADJ. A diferencia del cálculo ideal, un análisis profesional debe incluir la pequeña corriente de ajuste (I_adj ≈ 50 µA) que fluye hacia R2.",
                        `Valor actual de R2 con el wiper ajustado a ${R2_wiper}. R2 = ${formatoIngenieria(R2, 'Ω')} * ${R2_wiper} = ${formatoIngenieria(R2_val, 'Ω')}`,
                        `Ecuación: Vout = Vref * (1 + R2 / R1) + (I_adj * R2)`,
                        `Vout = 1.25 * (1 + ${formatoIngenieria(R2_val, 'Ω')} / ${formatoIngenieria(R1_val, 'Ω')}) + (0.00005 * ${formatoIngenieria(R2_val, 'Ω')})`,
                        `Vout = ${formatoIngenieria(V_resistencia, 'V')} (Divisor) + ${formatoIngenieria(V_error_Iadj, 'V')} (Caída por I_adj) = ${Vout_teo.toFixed(3)} V.`
                    ]
                },
                {
                    paso: "2. Comprobación de Dropout y Límite de la Fuente.",
                    calculos: [
                        "Para estabilizar el voltaje, el regulador requiere que Vin sea ~2V a ~3V superior al voltaje de salida demandado.",
                        `El Dropout establecido para este regulador es de: ${formatoIngenieria(V_dropout, 'V')}`,
                        `Voltaje mínimo requerido = Vout_solicitado + Dropout = ${(Vout_teo + V_dropout).toFixed(3)} V.`,
                        tieneSuficienteVoltaje
                            ? `Como Vin (${V1_val}V) es suficiente, el LM317 regulará la salida a los ${Vout_teo.toFixed(2)}V solicitados.`
                            : `¡ATENCIÓN! La fuente de ${V1_val}V NO es suficiente para entregar los ${Vout_teo.toFixed(2)}V programados. El circuito no tiene 'margen' suficiente y entra en Dropout.`
                    ]
                },
                {
                    paso: "3. Confirmación del Motor No Lineal MNA.",
                    calculos: [
                        "El motor interno resuelve el circuito evaluando dinámicamente las caídas en las ramas, entregando la respuesta real del circuito:",
                        `Voltaje REAL estabilizado en la Carga (Nodo 2) = ${vOut_mna.toFixed(3)} V`,
                        `Corriente entregada a la Carga (I_R3) = ${formatoIngenieria(i_load_mna, 'A')}`,
                        `Corriente Total drenada de la Fuente (I_V1) = ${formatoIngenieria(i_in_mna, 'A')}`
                    ]
                },
                {
                    paso: "4. Análisis de Eficiencia Térmica.",
                    calculos: [
                        "Toda la diferencia de voltaje entre la entrada y la salida se transforma en calor dentro del regulador. Si la diferencia es grande y la corriente es alta, se requerirá un disipador de calor.",
                        `Potencia Útil (R3) = ${formatoIngenieria(P_load, 'W')}`,
                        `Calor Disipado por el LM317 = ${formatoIngenieria(P_reg_dissipated, 'W')}`,
                        `Eficiencia Global = ${Eficiencia.toFixed(2)} %`
                    ]
                }
            ]
        };
    }
};

module.exports = ProcedureManager;