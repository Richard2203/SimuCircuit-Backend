const ResistorModel = require('./models/ResistorModel');
const BJTModel = require('./models/BJTModel');
const FETModel = require('./models/FETModel');

// Constantes fisicas (ajustables)
const VT = 0.026;          // Tension termica a 300K
const DIODE_IDEALITY = 1.0; // Factor de idealidad del diodo
const EARLY_VOLTAGE = 50;   // Tension Early tipica

/**
 * Linealiza componentes no lineales para analisis AC basandose en el punto de operacion DC.
 * @param {Array} components - Lista de componentes (instancias de las clases del motor)
 * @param {Object} dcResult - Objeto con resultados DC (por ejemplo, mapa de corrientes)
 * @returns {Object} Mapa id_componente -> modelo lineal (instancia de LinearModel)
 */
function linearizeForAC(components, dcResult) {
    const models = {};

    for (const comp of components) {
        // Si el componente esta explicitamente marcado como no lineal, se linealiza.
        // Si isLinear no esta definido, se asume lineal (por defecto todos son lineales a menos que la subclase lo establezca en false).
        if (comp.isLinear === false) {
            switch (comp.type) {
                case 'diodo':
                    const ID = dcResult.currents?.[comp.id] || 0.001; // corriente por defecto
                    if (ID <= 0) {
                        // Diodo en inversa: circuito abierto (no aporta)
                        // No se agrega modelo
                    } else {
                        const rd = (DIODE_IDEALITY * VT) / ID;
                        models[comp.id] = new ResistorModel(rd, comp.nodes);
                        console.log(`Diodo ${comp.id} linealizado con rd = ${rd} Ω`);
                    }
                    break;

                case 'transistor_bjt':
                    const IC = dcResult.currents?.[comp.id] || 0.001;
                    const beta = comp.beta || 100;
                    const gm = IC / VT;
                    const rpi = beta / gm;
                    const ro = EARLY_VOLTAGE / IC;
                    models[comp.id] = new BJTModel(gm, rpi, ro, comp.nodes);
                    console.log(`BJT ${comp.id} linealizado con gm = ${gm}, rπ = ${rpi}, ro = ${ro}`);
                    break;

                case 'transistor_fet':
                    const ID_fet = dcResult.currents?.[comp.id] || 0.001;
                    // gm puede venir de la BD o estimarse
                    let gm_fet = comp.gm;
                    if (!gm_fet) {
                        // Estimacion burda: 0.01 S
                        gm_fet = 0.01;
                    }
                    const rd = comp.rd || 1e6; // resistencia de drenaje (por defecto alta)
                    models[comp.id] = new FETModel(gm_fet, rd, comp.nodes);
                    console.log(`FET ${comp.id} linealizado con gm = ${gm_fet}, rd = ${rd}`);
                    break;

                case 'regulador_voltaje':
                    // Modelo simple: resistencia de salida muy pequeña
                    const Rout = 0.01; // 10 mOhm
                    // Nodos del regulador: se espera que sean [entrada, salida, tierra] en ese orden.
                    // Para el modelo AC, solo nos interesa la salida y tierra.
                    if (comp.nodes && comp.nodes.length >= 3) {
                        // Suponemos que el segundo nodo es la salida y el tercero es tierra
                        models[comp.id] = new ResistorModel(Rout, [comp.nodes[1], comp.nodes[2]]);
                        console.log(`Regulador ${comp.id} linealizado con Rout = ${Rout} Ω entre salida y tierra`);
                    } else {
                        console.warn(`Regulador ${comp.id} no tiene suficientes nodos; se omite linealizacion.`);
                    }
                    break;

                // Añadir otros casos segun sea necesario
                default:
                    console.warn(`Tipo de componente no lineal desconocido: ${comp.type}`);
                    break;
            }
        }
    }

    return models;
}

module.exports = linearizeForAC;