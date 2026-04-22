const MotorCalculos = require('../engine/MotorCalculos');
const ComponentFactory = require('../engine/factories/ComponentFactory');
const { armarObjetoCircuito } = require('../utils/ConstructorCircuitos');
const { extraerValorDeResultados } = require('../utils/AnalisisUtils');
const parsearValorElectrico = require('../engine/utils/valueParser');

const ejecutarTheveninNorton = async (req, res) => {
    try {
        const { netlist, componenteCargaId, nombre_circuito } = req.body;

        // Validamos que la netlist tenga el formato esperado o no esté vacía
        if (!netlist || !Array.isArray(netlist) || netlist.length === 0) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió una Netlist válida para realizar el análisis.' 
            });
        }

        // Validamos que el componente de carga haya sido especificado en el cuerpo de la solicitud
        if (!componenteCargaId) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió el ID del componente de carga. Por favor, especifica el ID del componente que deseas analizar.' 
            });
        }

        // --- SIMULACIÓN 1: Circuito Abierto (Voc) ---
        // 1. Encontrar la carga original para saber a qué nodos estaba conectada
        const cargaOriginal = netlist.find(c => c.id === componenteCargaId);

        // 2. Extraer los valores de sus nodos. 
        // Usamos Object.values() porque una resistencia usa {n1: "x", n2: "y"} 
        // pero otros componentes podrían usar {pos: "x", neg: "y"}
        const valoresNodos = Object.values(cargaOriginal.nodes);
        const nodoA = String(valoresNodos[0]); 
        const nodoB = String(valoresNodos[1]);

        // 3. Filtramos la netlist para quitar la resistencia de carga, esto para la simulación de circuito Abierto (OC)
        const netlistOC = netlist.filter(c => c.id !== componenteCargaId);

        //Identificamos el nombre del circuito para generar un ID único
        const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
        const idCircuito = `circuito_dc_${nombreSeguro}_${Date.now()}`;

        // Preparamos el circuito para la simulación de circuito abierto (OC)
        const circuitoOC = armarObjetoCircuito(netlistOC, `${idCircuito}_OC`);

        const motorOC = new MotorCalculos(circuitoOC);
        const resOC = await motorOC.ejecutarAnalisisDC();

        // 5. Calcular el voltaje de Thévenin con los nodos identificados
        const vA = resOC.voltages[nodoA] !== undefined ? resOC.voltages[nodoA] : 0;
        const vB = resOC.voltages[nodoB] !== undefined ? resOC.voltages[nodoB] : 0;
        const Vth = vA - vB;

        // --- SIMULACIÓN 2: Cortocircuito (Isc) ---
        // 5. Inyectar la fuente de 0V exactamente en los mismos nodos
        const fuenteCorto = {
            id: 'V_SHORT',
            type: 'fuente_voltaje',
            value: '0',
            nodes: { pos: nodoA, neg: nodoB },
            params: { dcOrAc: 'dc' }
        };
        const netlistSC = [...netlistOC, fuenteCorto];

        // Preparamos el circuito para la simulación de cortocircuito (SC)
        const circuitoSC = armarObjetoCircuito(netlistSC, `${idCircuito}_SC`);

        const motorSC = new MotorCalculos(circuitoSC);
        const resSC = await motorSC.ejecutarAnalisisDC();

        // La corriente de Norton es la corriente que pasa por nuestra fuente de 0V
        const In = resSC.voltageSourceCurrents['V_SHORT'];

        //NOTA: recordemos que Rth es igual a Rn si el circuito es lineal.
        const Rth = Math.abs(Vth / In);

        // --- CÁLCULO DE POTENCIA MÁXIMA ---
        const Pmax = Math.pow(Vth, 2) / (4 * Rth);

        res.json({
            exito: true,
            teorema: 'Thévenin / Norton',
            data: {
                thevenin: { Vth, Rth, unidadV: 'V', unidadR: 'Ω' },
                norton: { In, Rn: Rth, unidadI: 'A', unidadR: 'Ω' },
                maximaPotencia: { valor: Pmax, unidad: 'W' },
                procedimiento: [
                    { paso: 1, eq: `V_{th} = ${Vth.toFixed(10)}V` },
                    { paso: 2, eq: `I_{n} = ${In.toFixed(10)}A` },
                    { paso: 3, eq: `R_{th} = \\frac{${Vth.toFixed(10)}}{${In.toFixed(10)}} = ${Rth.toFixed(10)}\\Omega` }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

const ejecutarSuperposicion = async (req, res) => {
    try {
        const { netlist, componenteObjetivoId, parametroAnalisis, nombre_circuito } = req.body;
        // parametroAnalisis puede ser "voltaje" o "corriente"

        // 1. Encontrar todas las fuentes independientes
        const fuentes = netlist.filter(c => c.type === 'fuente_voltaje' || c.type === 'fuente_corriente');
        
        //Recordemos que para ejecutar superposición, necesitamos al menos 2 fuentes para que tenga sentido el análisis, si solo hay una fuente, entonces no hay superposición que analizar.
        if (fuentes.length < 2) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito necesita al menos 2 fuentes para aplicar superposición.'
            });
        }

        const aportaciones = [];
        let sumaTotal = 0;

        // 2. Bucle de Superposición
        for (let fuenteActiva of fuentes) {
            // Clonamos la netlist para no mutar la original
            let netlistTemporal = JSON.parse(JSON.stringify(netlist));

            // Apagamos todas las fuentes EXCEPTO la activa
            netlistTemporal.forEach(comp => {
                if ((comp.type === 'fuente_voltaje' || comp.type === 'fuente_corriente') && comp.id !== fuenteActiva.id) {
                    if (comp.type === 'fuente_voltaje') {
                        comp.value = "0"; // Cortocircuito
                    } else if (comp.type === 'fuente_corriente') {
                        comp.value = "0"; // Circuito abierto
                    }
                }
            });

            // 3. Ejecutar simulación con la netlist temporal
            const circuitoTemp = armarObjetoCircuito(netlistTemporal, `circuito_superposicion_${fuenteActiva.id}_${Date.now()}`);
            const motorTemp = new MotorCalculos(circuitoTemp);
            const resTemp = await motorTemp.ejecutarAnalisisDC();

            // 4. Extraer el valor del componente objetivo
            const valorAporte = extraerValorDeResultados(resTemp, componenteObjetivoId, parametroAnalisis.toLowerCase(), netlistTemporal);
            
            sumaTotal += valorAporte;

            aportaciones.push({
                fuenteId: fuenteActiva.id,
                tipoFuente: fuenteActiva.type,
                valorAporte: valorAporte
            });
        }

        // 5. Formatear la respuesta con ecuaciones LaTeX para el Frontend
        const procedimiento = aportaciones.map((aporte, index) => ({
            paso: index + 1,
            titulo: `Aporte de ${aporte.fuenteId} (Demás fuentes apagadas)`,
            eq: `${parametroAnalisis === 'voltaje' ? 'V' : 'I'}_{${componenteObjetivoId}}^{(${aporte.fuenteId})} = ${aporte.valorAporte.toFixed(10)}`
        }));

        const ecuacionSuma = aportaciones.map(a => `${parametroAnalisis === 'voltaje' ? 'V' : 'I'}_{${componenteObjetivoId}}^{(${a.fuenteId})}`).join(' + ');
        procedimiento.push({
            paso: aportaciones.length + 1,
            titulo: "Suma Algebraica Total",
            eq: `${parametroAnalisis === 'voltaje' ? 'V' : 'I'}_{${componenteObjetivoId}}^{Total} = ${ecuacionSuma} = ${sumaTotal.toFixed(10)}`
        });

        res.json({
            exito: true,
            teorema: 'Superposición',
            data: {
                total: sumaTotal,
                aportaciones: aportaciones,
                procedimiento: procedimiento
            }
        });

    } catch (error) {
        res.status(500).json({
            exito: false,
            error: error.message
        });
    }
};

const obtenerResistenciaEquivalente = async (req, res) => {
    try {
        const { netlist, nodoA, nodoB, nombre_circuito } = req.body;

        //Validar que los nodos sean distintos
        if (nodoA === nodoB) {
            return res.status(400).json({ exito: false, mensaje: 'Debes seleccionar dos nodos distintos.' });
        }

        // 1. "LIMPIAR" EL CIRCUITO (Apagar fuentes independientes)
        // Clonamos la netlist para no alterar la original.
        let netlistPasiva = JSON.parse(JSON.stringify(netlist));
        
        // Filtramos para quitar fuentes de corriente y ponemos a 0V las de voltaje
        netlistPasiva = netlistPasiva.filter(comp => comp.type !== 'fuente_corriente');
        netlistPasiva.forEach(comp => {
            if (comp.type === 'fuente_voltaje') comp.value = "0";
        });

        // 2. INYECTAR LA PRUEBA (Fuente de Corriente de 1A)
        // Esta fuente entrará por el nodoA y saldrá por el nodoB
        const fuentePrueba = {
            id: 'I_PRUEBA_REQ',
            type: 'fuente_corriente',
            value: '1', // 1 Amperio exacto
            nodes: { pos: String(nodoA), neg: String(nodoB) },
            params: { dcOrAc: 'dc' }
        };
        netlistPasiva.push(fuentePrueba);

        //Identificamos el nombre del circuito para generar un ID único
        const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
        const idCircuito = `circuito_req_${nombreSeguro}_${Date.now()}`;

        // 3. SIMULAR
        const circuito = armarObjetoCircuito(netlistPasiva, idCircuito);
        const motor = new MotorCalculos(circuito);
        const resultados = await motor.ejecutarAnalisisDC();

        // 4. CALCULAR Req
        // Por Ley de Ohm: Req = (V_nodoA - V_nodoB) / I_prueba
        // Como I_prueba = 1, entonces Req = Diferencia de Voltaje
        const vA = resultados.voltages[String(nodoA)] || 0;
        const vB = resultados.voltages[String(nodoB)] || 0;
        const Req = Math.abs(vA - vB);

        res.json({
            exito: true,
            analisis: 'Resistencia Equivalente Universal',
            nodos: { inicio: nodoA, fin: nodoB },
            valor: Req,
            unidad: 'Ω',
            mensaje: `La resistencia equivalente entre los nodos ${nodoA} y ${nodoB} es de ${Req.toFixed(3)} Ω.`
        });

    } catch (error) {
        console.error('Error en Req:', error);
        res.status(500).json({ exito: false, error: error.message });
    }
};

const calcularDivisorVoltaje = async (req, res) => {
    try {
        const { netlist, componenteObjetivoId, nombre_circuito } = req.body;

        // 1. Extraemos los valores clave ANTES de la simulación para la fórmula
        const fuentesVoltaje = netlist.filter(c => c.type === 'fuente_voltaje');
        const componenteObjetivo = netlist.find(c => c.id === componenteObjetivoId);

        //Validaciones iniciales básicas
        if (fuentesVoltaje.length !== 1) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito debe contener exactamente 1 fuente de voltaje para aplicar el análisis de divisor de voltaje.'
            });
        }
        if(!componenteObjetivo || componenteObjetivo.type !== 'resistencia') {
            return res.status(400).json({
                exito: false,
                mensaje: 'El componente objetivo debe ser una resistencia para aplicar el análisis de divisor de voltaje.'
            });
        }

        //Validar que el circuito solo tenga componentes de tipo resistencia y una fuente de voltaje, esto para asegurar que la fórmula del divisor de voltaje sea aplicable sin complicaciones adicionales.
        const tiposValidos = ['resistencia', 'fuente_voltaje'];
        const tiposCircuito = new Set(netlist.map(c => c.type));

        if (![...tiposCircuito].every(t => tiposValidos.includes(t))) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito contiene componentes no compatibles con el análisis de divisor de voltaje. Asegúrate de que solo haya resistencias y una fuente de voltaje.'
            });
        }

        const voltajeFuente = parsearValorElectrico(fuentesVoltaje[0].value);
        const Rx = parsearValorElectrico(componenteObjetivo.value);

        // Calculamos la resistencia equivalente total (Req) sumando todas las resistencias del circuito, asumiendo que están en serie para este análisis didáctico
        let Req = 0;
        netlist.filter(c => c.type === 'resistencia').forEach(r => {
            Req += parsearValorElectrico(r.value);
        });
        
        // 2. Ejecutamos MNA "en frío" para obtener la realidad del circuito
        const circuito = armarObjetoCircuito(netlist, `divisor_voltaje_${Date.now()}`);
        const motor = new MotorCalculos(circuito);
        const resultados = await motor.ejecutarAnalisisDC();

        // 2. Extraemos el voltaje real del componente usando la función extraerValorDeResultados, esto para comparar con el resultado de la fórmula didáctica
        const voltajeRealMNA = extraerValorDeResultados(resultados, componenteObjetivoId, 'voltaje', netlist);

        // 3. Calculamos la expectativa segun la fórmula del divisor de voltaje
        const voltajeFormula = voltajeFuente * (Rx / Req);

        console.log(`Voltaje según fórmula: ${voltajeFormula.toFixed(5)} V, Voltaje según MNA: ${voltajeRealMNA.toFixed(5)} V`);

        // 4. La validación con margen de error de 0.001V
        const diferencia = Math.abs(Math.abs(voltajeRealMNA) - Math.abs(voltajeFormula));
        if (diferencia > 0.001) {
            return res.status(400).json({
                exito: false,
                mensaje: `La topología del circuito no permite aplicar la regla del divisor de voltaje simple. Asegúrate de que todas las resistencias estén en serie y que solo haya una fuente de voltaje.`
            });
        }

        // 5 Si todo coincide, devolvemos el JSON didáctico
        res.json({
            exito: true,
            analisis: 'Divisor de Voltaje',
            data: {
                voltajeCaida: voltajeRealMNA,
                unidad: 'V',
                procedimiento: [
                    {
                        paso: 1,
                        titulo: "Fórmula del Divisor de Voltaje",
                        eq: `V_{${componenteObjetivoId}} = V_s \\left( \\frac{R_{${componenteObjetivoId}}}{R_{eq}} \\right)`
                    },
                    {
                        paso: 2,
                        titulo: "Suma de Resistencias para R_(eq)",
                        eq: `R_{eq} = ${Req.toFixed(5)}\\Omega`
                    },
                    {
                        paso: 3,
                        titulo: "Sustitución de Valores",
                        eq: `V_{${componenteObjetivoId}} = ${voltajeFuente} \\left( \\frac{${Rx}}{${Req}} \\right) = ${voltajeRealMNA.toFixed(3)}\\text{V}`
                    }
                ]
            }
        });

    } catch (error) {
        res.status(500).json({
            exito: false,
            error: error.message
        });
    }
};

const calcularDivisorCorriente = async (req, res) => {
    try {
        const { netlist, componenteObjetivoId, nombre_circuito } = req.body;

        // 1. Extraemos los valores clave ANTES de la simulación
        const fuentesCorriente = netlist.filter(c => c.type === 'fuente_corriente');
        const componenteObjetivo = netlist.find(c => c.id === componenteObjetivoId);

        // Validaciones iniciales básicas
        if (fuentesCorriente.length !== 1) {
            return res.status(400).json({ exito: false, mensaje: 'El divisor de corriente requiere exactamente 1 fuente de corriente.' });
        }
        if (!componenteObjetivo || componenteObjetivo.type !== 'resistencia') {
            return res.status(400).json({ exito: false, mensaje: 'El componente objetivo debe ser una resistencia.' });
        }

        //Validar que el circuito solo tenga componentes de tipo resistencia y una fuente de corriente, esto para asegurar que la fórmula del divisor de corriente sea aplicable sin complicaciones adicionales.
        const tiposValidos = ['resistencia', 'fuente_corriente'];
        const tiposCircuito = new Set(netlist.map(c => c.type));

        if (![...tiposCircuito].every(t => tiposValidos.includes(t))) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito contiene componentes no compatibles con el análisis de divisor de corriente. Asegúrate de que solo haya resistencias y una fuente de corriente.'
            });
        }

        const corrienteFuente = parsearValorElectrico(fuentesCorriente[0].value); 
        const Rx = parsearValorElectrico(componenteObjetivo.value);

        // Calculamos la Resistencia Equivalente en PARALELO
        let sumaConductancias = 0;
        netlist.filter(c => c.type === 'resistencia').forEach(r => {
            const valorR = parsearValorElectrico(r.value);
            sumaConductancias += (1 / valorR);
        });
        const Req = 1 / sumaConductancias;

        // 2. Ejecutamos la "Verdad Absoluta" (Motor MNA)
        const circuito = armarObjetoCircuito(netlist, `divisor_corriente_${Date.now()}`);
        const motor = new MotorCalculos(circuito);
        const resultadosMNA = await motor.ejecutarAnalisisDC();

        // Extraemos la corriente real usando la función utils con el parámetro 'corriente'
        const corrienteRealMNA = extraerValorDeResultados(resultadosMNA, componenteObjetivoId, 'corriente', netlist);

        // 3. Calculamos la expectativa según la Fórmula del Divisor
        const corrienteFormula = corrienteFuente * (Req / Rx);

        // 4. LA SUPER VALIDACIÓN (Margen de error de 0.001A o 1mA)
        const diferencia = Math.abs(Math.abs(corrienteRealMNA) - Math.abs(corrienteFormula));
        
        if (diferencia > 0.001) {
            // ¡La topología no es un paralelo puro!
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'La topología del circuito no permite aplicar la regla del divisor de corriente simple. Asegúrate de que todas las resistencias estén en una configuración de paralelo puro.' 
            });
        }

        // 5. Todo coincide, empaquetamos el éxito para el Frontend
        res.json({
            exito: true,
            analisis: 'Divisor de Corriente',
            data: {
                corrienteCaida: corrienteRealMNA,
                unidad: 'A',
                procedimiento: [
                    {
                        paso: 1,
                        titulo: "Fórmula del Divisor de Corriente",
                        eq: `I_{${componenteObjetivoId}} = I_{fuente} \\left( \\frac{R_{eq}}{R_{${componenteObjetivoId}}} \\right)`
                    },
                    {
                        paso: 2,
                        titulo: "Resistencia Equivalente (Paralelo)",
                        eq: `R_{eq} = \\left( \\sum \\frac{1}{R_i} \\right)^{-1} = ${Req.toFixed(3)}\\Omega`
                    },
                    {
                        paso: 3,
                        titulo: "Sustitución de Valores",
                        eq: `I_{${componenteObjetivoId}} = ${corrienteFuente} \\left( \\frac{${Req.toFixed(3)}}{${Rx}} \\right) = ${Math.abs(corrienteRealMNA).toFixed(4)}\\text{A}`
                    }
                ]
            }
        });

    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

const transformarFuente = async (req, res) => {
    try {
        //fuenteId es el identificador de la fuente tanto de voltaje como de corriente que se desea transformar/intercambiar.
        const { netlist, fuenteId } = req.body;

        // 1. Encontrar la fuente objetivo
        const fuente = netlist.find(c => c.id === fuenteId);
        if (!fuente) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Fuente no encontrada.'
            });
        }

        const tipoFuente = fuente.type.toLowerCase();
        const valorFuente = parsearValorElectrico(fuente.value);
        const nodosFuente = Object.values(fuente.nodes);

        //Aplican para ambas fuentes, si esSerie es false, entonces es paralelo.
        let resistenciaAsociada = null;
        let esSerie = false;

        // 2. BUSQUEDA DE LA PAREJA DE RESISTENCIA PARA LA TRANSFORMACIÓN
        if (tipoFuente === 'fuente_voltaje') {
            // Buscamos un nodo exclusivo (serie)
            // Para que el nodo sea serie, significa que solo hay 2 conexiones a ese nodo y en esas conexiones una corresponde a la fuente y la otra a la resistencia. Si hay más de 2 conexiones, entonces no es un nodo serie puro.
            for (let nodo of nodosFuente) {
                // Contamos cuántas conexiones hay a este nodo en todo el circuito
                const conexiones = netlist.filter(c => Object.values(c.nodes).includes(nodo));
                
                // Si hay exactamente 2 conexiones, una es la fuente y la otra debe ser la resistencia
                if (conexiones.length === 2) {
                    const posibleResistencia = conexiones.find(c => c.id !== fuenteId && c.type === 'resistencia');
                    if (posibleResistencia) {
                        resistenciaAsociada = posibleResistencia;
                        esSerie = true;
                        break;
                    }
                }
            }
            if (!resistenciaAsociada) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'No hay una resistencia en serie pura asociada a esta fuente de voltaje para transformarla. No puede aplicarse el teorema de transformación de fuentes en estas conexiones.'
                });
            }

        } else if (tipoFuente === 'fuente_corriente') {
            // Buscamos una resistencia que comparta ambos nodos (paralelo)
            resistenciaAsociada = netlist.find(c => {
                if (c.type !== 'resistencia') return false;
                const nodosR = Object.values(c.nodes);
                return nodosR.includes(nodosFuente[0]) && nodosR.includes(nodosFuente[1]);
            });

            if (!resistenciaAsociada) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'No hay una resistencia en paralelo puro asociada a esta fuente de corriente para transformarla. No puede aplicarse el teorema de transformación de fuentes en estas conexiones.'
                });
            }
        } else {
            return res.status(400).json({
                exito: false,
                mensaje: 'El componente no es una fuente independiente.'
            });
        }

        //console.log(`Fuente encontrada: ${fuenteId} (${tipoFuente}), Resistencia asociada: ${resistenciaAsociada.id} (${esSerie ? 'Serie' : 'Paralelo'})`);

        // 3. LA MATEMÁTICA DE LA TRANSFORMACIÓN
        const valorResistencia = parsearValorElectrico(resistenciaAsociada.value);
        let nuevoValor, nuevaUnidad, nuevoTipo, formula;

        if (tipoFuente === 'fuente_voltaje') {
            // Voltaje a Corriente (I = V / R)
            nuevoValor = valorFuente / valorResistencia;
            nuevaUnidad = 'A';
            nuevoTipo = 'Fuente de Corriente en Paralelo';
            formula = `I_s = \\frac{V_s}{R_s} = \\frac{${valorFuente}}{${valorResistencia}} = ${nuevoValor.toFixed(3)}\\text{A}`;
        } else {
            // Corriente a Voltaje (V = I * R)
            nuevoValor = valorFuente * valorResistencia;
            nuevaUnidad = 'V';
            nuevoTipo = 'Fuente de Voltaje en Serie';
            formula = `V_s = I_s \\times R_p = ${valorFuente} \\times ${valorResistencia} = ${nuevoValor.toFixed(3)}\\text{V}`;
        }

        // 4. RESPUESTA AL FRONTEND
        res.json({
            exito: true,
            teorema: 'Intercambio/Transformación de Fuentes',
            data: {
                fuenteOriginal: fuenteId,
                resistenciaInvolucrada: resistenciaAsociada.id,
                transformacion: {
                    tipo: nuevoTipo,
                    nuevoValorFuente: nuevoValor,
                    unidad: nuevaUnidad,
                    valorResistencia: valorResistencia // La resistencia no cambia de valor, solo de posición
                },
                procedimiento: [
                    {
                        paso: 1,
                        titulo: "Identificación del Equivalente",
                        eq: tipoFuente === 'fuente_voltaje' 
                            ? `\\text{Fuente de Voltaje en Serie con } ${resistenciaAsociada.id}` 
                            : `\\text{Fuente de Corriente en Paralelo con } ${resistenciaAsociada.id}`
                    },
                    {
                        paso: 2,
                        titulo: "Cálculo de la Nueva Fuente (Ley de Ohm)",
                        eq: formula
                    }
                ]
            }
        });

    } catch (error) {
        res.status(500).json({ 
            exito: false,
            error: error.message 
        });
    }
};

module.exports = {
    ejecutarTheveninNorton,
    ejecutarSuperposicion,
    obtenerResistenciaEquivalente,
    calcularDivisorVoltaje,
    calcularDivisorCorriente,
    transformarFuente
};