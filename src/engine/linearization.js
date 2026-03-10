const { LinearizedResistor } = require('./models/Diode'); // Para el diodo
const BJTModel = require('./models/BJTModel');
const FETModel = require('./models/FETModel');

// Constantes físicas (ajustables)
const VT = 0.026;          // Tensión térmica a 300K
const DIODE_IDEALITY = 1.0; // Factor de idealidad del diodo
const EARLY_VOLTAGE = 50;   // Tensión Early típica

/**
 * Linealiza componentes no lineales para análisis AC basándose en el punto de operación DC.
 * @param {Array} components - Lista de componentes (instancias de las clases del motor)
 * @param {Object} dcResult - Objeto con resultados DC (por ejemplo, mapa de corrientes)
 * @returns {Object} Mapa id_componente -> modelo lineal (instancia de alguna clase con aportarAC)
 */
function linearizeForAC(components, dcResult) {
    const models = {};

    for (const comp of components) {
        // Solo procesar si el componente está explícitamente marcado como no lineal
        if (comp.isLinear === false) {
            switch (comp.type) {
                case 'diodo': {
                    const ID = dcResult.currents?.[comp.id] || 0.001; // corriente por defecto
                    if (ID > 0) {
                        // Diodo polarizado directamente: se modela como resistencia dinámica
                        const rd = (DIODE_IDEALITY * VT) / ID;
                        models[comp.id] = new LinearizedResistor(rd, comp.nodes);
                        console.log(`Diodo ${comp.id} linealizado con rd = ${rd} Ω`);
                    }
                    // Si ID <= 0, el diodo está en inversa: se ignora (circuito abierto)
                    break;
                }

                case 'transistor_bjt': {
                    const IC = dcResult.currents?.[comp.id] || 0.001;
                    const beta = comp.beta || 100;
                    const gm = IC / VT;
                    const rpi = beta / gm;
                    const ro = EARLY_VOLTAGE / IC;
                    models[comp.id] = new BJTModel(gm, rpi, ro, comp.nodes);
                    console.log(`BJT ${comp.id} linealizado con gm = ${gm}, rπ = ${rpi}, ro = ${ro}`);
                    break;
                }

                case 'transistor_fet': {
                    const ID_fet = dcResult.currents?.[comp.id] || 0.001;
                    // gm puede venir de la BD o estimarse
                    let gm_fet = comp.gm;
                    if (!gm_fet) {
                        gm_fet = 0.01; // estimación burda
                    }
                    const rd = comp.rd || 1e6; // resistencia de drenaje (por defecto alta)
                    models[comp.id] = new FETModel(gm_fet, rd, comp.nodes);
                    console.log(`FET ${comp.id} linealizado con gm = ${gm_fet}, rd = ${rd}`);
                    break;
                }

                case 'regulador_voltaje': {
                    // Modelo simple: resistencia de salida muy pequeña entre salida y tierra
                    const Rout = 0.01; // 10 mOhm
                    // Se espera que los nodos sean [entrada, salida, tierra]
                    if (comp.nodes && comp.nodes.length >= 3) {
                        // El modelo se coloca entre el segundo nodo (salida) y el tercero (tierra)
                        models[comp.id] = new LinearizedResistor(Rout, [comp.nodes[1], comp.nodes[2]]);
                        console.log(`Regulador ${comp.id} linealizado con Rout = ${Rout} Ω entre salida y tierra`);
                    } else {
                        console.warn(`Regulador ${comp.id} no tiene suficientes nodos; se omite linealización.`);
                    }
                    break;
                }

                default:
                    console.warn(`Tipo de componente no lineal desconocido: ${comp.type}`);
                    break;
            }
        }
    }

    return models;
}

module.exports = linearizeForAC;