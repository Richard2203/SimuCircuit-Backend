const { LinearizedResistor } = require('./models/Diode');
const BJTModel = require('./models/BJTModel');
const FETModel = require('./models/FETModel');

const VT             = 0.026;
const DIODE_IDEALITY = 1.0;
const EARLY_VOLTAGE  = 50;

/** Tipos intrínsecamente no lineales (para componentes sin isLinear explícito) */
const NONLINEAR_TYPES = new Set([
    'diodo', 'transistor_bjt', 'bjt', 'transistor_fet', 'fet',
    'mosfet', 'jfet', 'regulador_voltaje', 'scr', 'triac',
]);

/**
 * Decide si un componente necesita linealización AC:
 *   - isLinear === false  → siempre linealizar
 *   - isLinear === true   → nunca linealizar
 *   - isLinear no definido → inferir por tipo (cubre componentes de JSON externo)
 */
function necesitaLinealizacion(comp) {
    if (comp.isLinear === false) return true;
    if (comp.isLinear === true)  return false;
    return NONLINEAR_TYPES.has(comp.type);
}

/**
 * Linealiza componentes no lineales para análisis AC basándose en el
 * punto de operación DC.
 *
 * @param {Array}  components - Lista de componentes del circuito
 * @param {Object} dcResult   - { currents: { id: valor }, voltages: {...} }
 * @returns {Object} Mapa  id_componente -> modelo lineal con aportarAC / calcularCorriente
 */
function linearizeForAC(components, dcResult) {
    const models = {};

    for (const comp of components) {
        if (!necesitaLinealizacion(comp)) continue;

        switch (comp.type) {

            case 'diodo': {
                const ID = dcResult?.currents?.[comp.id] ?? 0.001;
                if (ID > 0) {
                    const rd    = (DIODE_IDEALITY * VT) / ID;
                    const model = new LinearizedResistor(rd, comp.nodes);
                    model.id    = comp.id;
                    models[comp.id] = model;
                    console.log(`Diodo ${comp.id} linealizado: rd=${rd.toFixed(2)} Ω`);
                } else {
                    console.log(`Diodo ${comp.id} en inversa: circuito abierto`);
                }
                break;
            }

            case 'transistor_bjt':
            case 'bjt': {
                const IC   = dcResult?.currents?.[comp.id] ?? 0.001;
                const beta = comp.params?.beta ?? comp.beta ?? 100;
                const gm   = IC / VT;
                const rpi  = beta / gm;
                const ro   = EARLY_VOLTAGE / IC;

                const model  = new BJTModel(gm, rpi, ro, comp.nodes);
                model.id     = comp.id;
                model.name   = `bjt_${comp.id}`;
                models[comp.id] = model;

                console.log(
                    `BJT ${comp.id} linealizado: ` +
                    `gm=${gm.toExponential(3)} S, rπ=${rpi.toFixed(1)} Ω, ro=${ro.toFixed(0)} Ω`
                );
                break;
            }

            case 'transistor_fet':
            case 'mosfet':
            case 'jfet':
            case 'fet': {
                // 1. Extraer voltajes DC del resultado previo
                const [nG, nD, nS] = comp.nodes;
                const vG = dcResult?.voltages?.[nG] ?? 0;
                const vS = dcResult?.voltages?.[nS] ?? 0;
                const Vgs = vG - vS;

                // 2. Obtener parámetros del componente
                const idss = comp.params?.idss ?? 0.01;
                const vp = comp.params?.vp ?? -2.0;
                const rd_fet = comp.params?.rd ?? comp.rd ?? 1e6;

                // 3. Calcular la Transconductancia real (gm) basada en el punto de operación DC
                let gm_fet = 0;
                if (Vgs > vp) {
                    const factor = 1 - (Vgs / vp);
                    gm_fet = (-2 * idss / vp) * factor;
                } else {
                    gm_fet = 1e-12; // Transistor en corte
                }

                // 4. Instanciar el modelo AC de pequeña señal
                const model = new FETModel(gm_fet, rd_fet, comp.nodes);
                model.id = comp.id;
                model.name = `fet_${comp.id}`;
                models[comp.id] = model;
                
                console.log(`FET ${comp.id} linealizado para AC: Vgs=${Vgs.toFixed(3)}V, gm=${gm_fet.toExponential(3)} S, rd=${rd_fet} Ω`);
            break;
            }

            case 'regulador_voltaje': {
                const Rout = 0.01;
                if (comp.nodes?.length >= 3) {
                    const model = new LinearizedResistor(Rout, [comp.nodes[1], comp.nodes[2]]);
                    model.id    = comp.id;
                    models[comp.id] = model;
                    console.log(`Regulador ${comp.id} linealizado: Rout=${Rout} Ω`);
                } else {
                    console.warn(`Regulador ${comp.id}: nodos insuficientes, omitido.`);
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