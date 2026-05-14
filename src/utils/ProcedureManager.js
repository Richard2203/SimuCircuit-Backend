const parsearValorElectrico = require('../engine/utils/valueParser');
const formatoIngenieria = require('../engine/utils/antiParser');
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
                        `I_total = V1 / Req = V1/(R1 + R4A + RP) = ${formatoIngenieria(V1, 'V')} / ${formatoIngenieria(Req, 'Ω')} = ${formatoIngsenieria(I_total, 'A')}`
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
    }
};

module.exports = ProcedureManager;