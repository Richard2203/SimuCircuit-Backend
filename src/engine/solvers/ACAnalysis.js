const math = require('mathjs');
const generarFrecuencias = require('../utils/frecuencyGenerator');
const LinearSolver = require('./LinearSolver');
const { reconstruirVoltajes } = require('../utils/mathUtils');

class ACAnalysis {
    static async ejecutar(circuito, params, dcResult) {
        const { f_inicial, f_final, puntos, tipo_barrido } = params;

        // 1. Linealizar componentes no lineales
        const componentesLineales = circuito.componentes.map(comp => {
            if (comp.linearize) {
                return comp.linearize(dcResult);
            }
            return comp;
        });

        // 2. Generar frecuencias
        const frecuencias = generarFrecuencias(f_inicial, f_final, puntos, tipo_barrido);

        // 3. Identificar nodo tierra y activos
        const nodoTierra = circuito.obtenerNodoTierra();
        console.log('nodoTierra:', nodoTierra);

        const nodosActivos = circuito.nodos.filter(n => n.id !== nodoTierra);
        console.log('nodosActivos:', nodosActivos.map(n => n.id));
        const n = nodosActivos.length;

        if (n === 0) {
            throw new Error('No hay nodos activos (todos son tierra)');
        }

        // Mapa de índices para nodos activos
        const indiceNodo = {};
        nodosActivos.forEach((nodo, idx) => { indiceNodo[nodo.id] = idx; });

        const resultadosPorFrec = [];

        for (const freq of frecuencias) {
            // Inicializar matriz Y (n x n) y vector I (n x 1) con ceros complejos
            let Y = math.matrix(math.zeros([n, n]));
            let I = math.matrix(math.zeros([n, 1]));

            // Ensamblar contribuciones
            for (const comp of componentesLineales) {
                if (comp.aportarAC) {
                    comp.aportarAC(Y, I, freq, nodosActivos, nodoTierra);
                }
            }

            // Resolver sistema
            let V;
            try {
                console.log(`Frecuencia ${freq}:`);
                console.log('Y:\n', math.format(Y, {precision: 4, compact: true}));
                console.log('I:\n', math.format(I, {precision: 4, compact: true}));

                V = LinearSolver.resolver(Y, I); // debe ser un array de complejos
                console.log('V (array):', V.map(v => math.format(v)));
            } catch (error) {
                throw new Error(`Error en frecuencia ${freq}: ${error.message}`);
            }

            // Reconstruir voltajes completos
            const voltajesCompletos = reconstruirVoltajes(V, nodoTierra, circuito, nodosActivos, indiceNodo);
            console.log('voltajesCompletos:', voltajesCompletos);

            // Calcular corrientes
            const corrientesComp = {};
            for (const comp of componentesLineales) {
                if (comp.calcularCorriente) {
                    corrientesComp[comp.id || comp.name] = comp.calcularCorriente(voltajesCompletos, freq);
                }
            }

            // Guardar resultados
            resultadosPorFrec.push({
                frecuencia: freq,
                voltajes: voltajesCompletos,
                corrientes: corrientesComp,
                potencias: {},
                factores: {}
            });
        }

        return this.mapearResultados(resultadosPorFrec, frecuencias);
    }

    static mapearResultados(resultadosPorFrec, frecuencias) {
        const voltajesFasoriales = {};
        const corrientesFasoriales = {};

        if (resultadosPorFrec.length > 0) {
            const primer = resultadosPorFrec[0];
            for (const nodo in primer.voltajes) {
                voltajesFasoriales[nodo] = new Array(frecuencias.length);
            }
            for (const comp in primer.corrientes) {
                corrientesFasoriales[comp] = new Array(frecuencias.length);
            }
        }

        resultadosPorFrec.forEach((res, idx) => {
            for (const [nodo, fasor] of Object.entries(res.voltajes)) {
                voltajesFasoriales[nodo][idx] = fasor;
            }
            for (const [comp, fasor] of Object.entries(res.corrientes)) {
                corrientesFasoriales[comp][idx] = fasor;
            }
        });

        return {
            voltajesFasoriales,
            corrientesFasoriales,
            potenciasComplejas: {},
            factoresPotencia: {},
            barridoFrecuencias: frecuencias
        };
    }
}

module.exports = ACAnalysis;