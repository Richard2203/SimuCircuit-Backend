const { LinearizedResistor } = require('./models/Diode');
const BJTModel = require('./models/BJTModel');
const FETModel = require('./models/FETModel');

// Constantes físicas (ajustables)
const VT            = 0.026; // Tensión térmica a 300 K
const DIODE_IDEALITY = 1.0;  // Factor de idealidad del diodo
const EARLY_VOLTAGE  = 50;   // Tensión Early típica (V)

/**
 * Linealiza componentes no lineales para análisis AC basándose en el
 * punto de operación DC.
 *
 * @param {Array}  components - Lista de componentes del circuito
 * @param {Object} dcResult   - Resultado DC: { currents: { id: valor, ... }, voltages: {...} }
 * @returns {Object} Mapa  id_componente -> modelo lineal con aportarAC / calcularCorriente
 */
function linearizeForAC(components, dcResult) {
    const models = {};

    for (const comp of components) {
        // Solo procesar componentes explícitamente marcados como no lineales
        if (comp.isLinear !== false) continue;

        switch (comp.type) {

            case 'diodo': {
                const ID = dcResult?.currents?.[comp.id] ?? 0.001;
                if (ID > 0) {
                    // Diodo en directa → resistencia dinámica rd = n·VT / ID
                    const rd = (DIODE_IDEALITY * VT) / ID;
                    const model = new LinearizedResistor(rd, comp.nodes);
                    // Preservar el id original para que ACAnalysis use la clave correcta
                    model.id = comp.id;
                    models[comp.id] = model;
                    console.log(`Diodo ${comp.id} linealizado con rd = ${rd.toFixed(4)} Ω`);
                }
                // Si ID <= 0 el diodo está en inversa → circuito abierto (no se estampa nada)
                break;
            }

            case 'transistor_bjt': {
                const IC   = dcResult?.currents?.[comp.id] ?? 0.001;
                const beta = comp.params?.beta ?? comp.beta ?? 100;
                const gm   = IC / VT;
                const rpi  = beta / gm;
                const ro   = EARLY_VOLTAGE / IC;

                const model = new BJTModel(gm, rpi, ro, comp.nodes);
                // ── FIX: asignar id para evitar la clave "undefined" en phasorCurrents ──
                model.id   = comp.id;
                model.name = `bjt_${comp.id}`;

                models[comp.id] = model;
                console.log(
                    `BJT ${comp.id} linealizado: gm=${gm.toExponential(3)}, ` +
                    `rπ=${rpi.toFixed(2)} Ω, ro=${ro.toFixed(2)} Ω`
                );
                break;
            }

            case 'transistor_fet': {
                const gm_fet = comp.params?.gm ?? comp.gm ?? 0.01;
                const rd_fet = comp.params?.rd  ?? comp.rd  ?? 1e6;

                const model = new FETModel(gm_fet, rd_fet, comp.nodes);
                model.id   = comp.id;
                model.name = `fet_${comp.id}`;

                models[comp.id] = model;
                console.log(
                    `FET ${comp.id} linealizado: gm=${gm_fet}, rd=${rd_fet} Ω`
                );
                break;
            }

            case 'regulador_voltaje': {
                const Rout = 0.01; // 10 mΩ — resistencia de salida del regulador
                if (comp.nodes?.length >= 3) {
                    const model = new LinearizedResistor(Rout, [comp.nodes[1], comp.nodes[2]]);
                    model.id = comp.id;
                    models[comp.id] = model;
                    console.log(`Regulador ${comp.id} linealizado: Rout=${Rout} Ω`);
                } else {
                    console.warn(`Regulador ${comp.id}: nodos insuficientes, se omite.`);
                }
                break;
            }

            default:
                console.warn(`Componente no lineal desconocido: tipo="${comp.type}", id=${comp.id}`);
                break;
        }
    }

    return models;
}

module.exports = linearizeForAC;
