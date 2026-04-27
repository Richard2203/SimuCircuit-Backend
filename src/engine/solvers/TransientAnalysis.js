const math = require('mathjs');
const LinearSolver = require('./LinearSolver');
const { reconstruirVoltajes } = require('../utils/mathUtils');

class TransientAnalysis {
    /**
     * @param {Object} circuito - Objeto del circuito ya instanciado con sus componentes
     * @param {Object} configuracion_transitorio - { tStop: 0.05, deltaT: 0.001 }
     */
    static async resolver(circuito, configuracion_transitorio) {
        const { t_stop, delta_t } = configuracion_transitorio;
        const resultadosTiempo = [];

        const groundNode = circuito.obtenerNodoTierra(); // Identificamos el nodo tierra para excluirlo de los nodos activos
        const nodosActivos = circuito.nodos.filter(n => n.id !== groundNode);
        console.log('Nodos activos:', nodosActivos.map(n => n.id));
        const numNodos = nodosActivos.length;

        if (numNodos === 0) {
            throw new Error('No hay nodos activos (todos son tierra)');
        }

        // Mapa de índices para nodos activos
        const nodeIndex = {};
        nodosActivos.forEach((node, idx) => { nodeIndex[node.id] = idx; });

        const voltageSources = circuito.componentes.filter(
            c => c.type === 'fuente_voltaje' || c.constructor.name === 'VoltageSource'
        );
        const M = voltageSources.length;

        let size = numNodos + M; // Tamaño total del sistema (nodos + fuentes de voltaje)

        // Mapa para saber qué índice le toca a cada fuente de voltaje (de 0 a M-1)
        const vsIndex = {};
        voltageSources.forEach((vs, idx) => { vsIndex[vs.id] = idx; });

        // Memorias del circuito (El estado en t - deltaT)
        // Inicialmente el circuito arranca descargado (0V y 0A)
        let voltajesAnteriores = {}; 
        let corrientesAnterioresBobinas = {}; // Mapa para guardar la corriente de cada inductor

        // Inicializamos los voltajes en 0 para el arranque
        nodosActivos.forEach(nodo => { voltajesAnteriores[nodo.id] = 0; });

        console.log(`Iniciando Análisis Transitorio: 0 a ${t_stop}s en pasos de ${delta_t}s`);

        // ==========================================================
        // DETECCIÓN DE COMPONENTES NO LINEALES (Antes de iniciar el bucle del tiempo)
        // ==========================================================
        const componentesNoLineales = [];
        circuito.componentes.forEach(c => {
            if (typeof c.aportarNonLinearDC === 'function') {
                componentesNoLineales.push(c);
            }
        });

        // ==========================================
        // EL BUCLE DEL TIEMPO
        // ==========================================
        for (let t = 0; t <= t_stop; t += delta_t) {
            
            // 1. Matrices en blanco para este instante 't'
            let Y = math.matrix(math.zeros([size, size]));
            let Z = math.matrix(math.zeros([size, 1]));

            // 2. Estampar Componentes Lineales Estáticos (Resistencias)
            // Aportan su conductancia habitual a la matriz Y
            circuito.componentes.forEach(comp => {
                if (comp.type === 'resistencia' && comp.aportarDC) {
                    comp.aportarDC(Y, Z, nodosActivos, groundNode, nodeIndex, vsIndex, numNodos); // Frecuencia 0 para DC
                    console.log(JSON.stringify(comp));
                }
            });

            // 3. Estampar Fuentes Dinámicas en el tiempo 't'
            circuito.componentes.forEach(comp => {
                if (comp.type === 'fuente_voltaje' || comp.type === 'fuente_corriente') {
                    comp.aportarTransitorio(Y, Z, t, nodosActivos, groundNode, nodeIndex, vsIndex, numNodos);
                    console.log(JSON.stringify(comp));
                }
            });

            // 4. Estampar Componentes Reactivos (Los Modelos Acompañantes)
            circuito.componentes.forEach(comp => {
                if (comp.type === 'capacitor') {
                    const [n1, n2] = comp.nodes;
                    const vPosAnterior = voltajesAnteriores[n1] || 0;
                    const vNegAnterior = voltajesAnteriores[n2] || 0;
                    
                    comp.aportarTransitorio(Y, Z, delta_t, vPosAnterior, vNegAnterior, nodeIndex);
                }
                
                if (comp.type === 'bobina') {
                    const iAnterior = corrientesAnterioresBobinas[comp.id] || 0;
                    comp.aportarTransitorio(Y, Z, delta_t, iAnterior, nodeIndex);
                }
            });

            // =========================================================
            // PASOS 5, 6 y 7 INTEGRADOS: SOLVER MNA + NEWTON-RAPHSON
            // =========================================================
            let V_solucion;
            let voltajesActuales = {};

            if (componentesNoLineales.length === 0) {
                // --- RUTA 100% LINEAL (RC, RL, Resistencias puras) ---
                try {
                    V_solucion = LinearSolver.resolver(Y, Z); 
                } catch (error) {
                    throw new Error(`Matriz singular en t=${t.toFixed(4)}s. Error: ${error.message}`);
                }

                // Extracción blindada de voltajes
                Object.keys(nodeIndex).forEach(nodo => {
                    const idx = nodeIndex[nodo];
                    let val = V_solucion.get ? V_solucion.get([idx, 0]) : (Array.isArray(V_solucion[idx]) ? V_solucion[idx][0] : V_solucion[idx]);
                    voltajesActuales[nodo] = val || 0;
                });
                voltajesActuales[groundNode] = 0;

            } else {
                // --- RUTA NO LINEAL (EL MOTOR SPICE CON NEWTON-RAPHSON) ---
                const maxIter = 20; // 20 intentos por milisegundo es el estándar SPICE
                const tolerancia = 1e-4; // Convergencia a 0.1 milivoltios
                let convergencia = false;
                
                let voltajesIteracion = { ...voltajesAnteriores }; 

                for (let iter = 0; iter < maxIter; iter++) {
                    // A. Clonamos las matrices lineales base de este milisegundo
                    let Y_iter = Y.clone();
                    let Z_iter = Z.clone();

                    // B. Los diodos inyectan sus derivadas usando un bucle a prueba de fallos
                    for (const comp of componentesNoLineales) {
                        console.log(JSON.stringify(comp));
                        comp.aportarNonLinearDC(Y_iter, Z_iter, nodosActivos, groundNode, nodeIndex, vsIndex, numNodos, voltajesIteracion);
                    }

                    // C. Resolvemos el sistema de esta iteración
                    try {
                        V_solucion = LinearSolver.resolver(Y_iter, Z_iter);
                    } catch (error) {
                        throw new Error(`NR Matrix Error en t=${t.toFixed(4)}s, iter ${iter}.`);
                    }

                    // D. Extraemos los nuevos voltajes sugeridos
                    let nuevosVoltajes = {};
                    Object.keys(nodeIndex).forEach(nodo => {
                        const idx = nodeIndex[nodo];
                        let val = V_solucion.get ? V_solucion.get([idx, 0]) : (Array.isArray(V_solucion[idx]) ? V_solucion[idx][0] : V_solucion[idx]);
                        nuevosVoltajes[nodo] = val || 0;
                    });
                    nuevosVoltajes[groundNode] = 0;

                    // E. Comprobamos la Convergencia
                    let maxCambio = 0;
                    Object.keys(nuevosVoltajes).forEach(nodo => {
                        const dif = Math.abs(nuevosVoltajes[nodo] - voltajesIteracion[nodo]);
                        if (dif > maxCambio) maxCambio = dif;
                    });

                    voltajesIteracion = nuevosVoltajes; // Actualizamos la adivinanza

                    if (maxCambio < tolerancia) {
                        convergencia = true;
                        break;
                    }
                }

                if (!convergencia) {
                    console.warn(`[Warning] El motor no logró convergencia en t=${t.toFixed(5)}s después de ${maxIter} iteraciones. "Voltajes_finales" podrían ser inexactos.`);
                }

                // Fijamos los voltajes de este milisegundo
                voltajesActuales = voltajesIteracion;
            }
            
            // 8. Actualizar Memorias para el SIGUIENTE milisegundo
            voltajesAnteriores = { ...voltajesActuales };
            
            // circuito.componentes.forEach(comp => {
            //     if (comp.type === 'bobina') {
            //         // La nueva corriente histórica se calcula a partir de los voltajes que acabamos de hallar
            //         // I_nueva = I_anterior + (V_actual / L) * delta_t (o usando tu modelo acompañante)
            //         // ... calcularás esto usando una función de la bobina
            //     }
            // });

            // 9. Guardar la fotografía de este instante
            resultadosTiempo.push({
                tiempo: Number(t.toFixed(5)), // Limpiar decimales de JS
                voltajes: voltajesActuales
            });
        }

        return resultadosTiempo;
    }
}

module.exports = TransientAnalysis;