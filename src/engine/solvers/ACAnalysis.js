const math = require('mathjs');
const generarFrecuencias = require('../utils/frecuencyGenerator');
const LinearSolver = require('./LinearSolver');
const { reconstruirVoltajes } = require('../utils/mathUtils');
const linearizeForAC = require('../linearization'); // Ajusta la ruta según tu estructura

class ACAnalysis {
    static async ejecutar(circuit, params, dcResult) {
        const { f_inicial, f_final, puntos, barrido } = params;

        // 1. Obtener modelos lineales para componentes no lineales
        const linearModels = linearizeForAC(circuit.componentes, dcResult);

        // 2. Construir lista de componentes para AC:
        //    - Si hay un modelo lineal, se usa ese modelo.
        //    - Si no, se usa el componente original (debe ser lineal y tener método aportarAC).
        const acComponents = circuit.componentes.map(comp => {
            if (linearModels[comp.id]) {
                return linearModels[comp.id];
            }
            return comp;
        });

        // 3. Generar lista de frecuencias
        const frequencies = generarFrecuencias(f_inicial, f_final, puntos, barrido);

        // 4. Identificar nodo tierra y nodos activos
        const groundNode = circuit.obtenerNodoTierra();
        console.log('Nodo tierra:', groundNode);

        const activeNodes = circuit.nodos.filter(n => n.id !== groundNode);
        console.log('Nodos activos:', activeNodes.map(n => n.id));
        const n = activeNodes.length;

        if (n === 0) {
            throw new Error('No hay nodos activos (todos son tierra)');
        }

        // Mapa de índices para nodos activos
        const nodeIndex = {};
        activeNodes.forEach((node, idx) => { nodeIndex[node.id] = idx; });

        const resultsByFreq = [];

        for (const freq of frequencies) {
            const omega = 2 * Math.PI * freq;

            // Inicializar matriz Y (n x n) y vector I (n x 1) con ceros
            let Y = math.matrix(math.zeros([n, n]));
            let I = math.matrix(math.zeros([n, 1]));

            // Ensamblar contribuciones de cada componente
            for (const comp of acComponents) {
                if (comp.aportarAC) {
                    comp.aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex);
                }
            }

            // Resolver sistema lineal
            let V;
            try {
                console.log(`Frecuencia ${freq} Hz (ω = ${omega} rad/s):`);
                console.log('Y:\n', math.format(Y, { precision: 4, compact: true }));
                console.log('I:\n', math.format(I, { precision: 4, compact: true }));

                V = LinearSolver.resolver(Y, I);
                console.log('V (array):', V.map(v => math.format(v)));
            } catch (error) {
                throw new Error(`Error en frecuencia ${freq}: ${error.message}`);
            }

            // Reconstruir voltajes en todos los nodos (incluyendo tierra = 0)
            const fullVoltages = reconstruirVoltajes(V, groundNode, circuit, activeNodes, nodeIndex);
            console.log('Voltajes completos:', fullVoltages);

            // Calcular corrientes en cada componente (opcional)
            const currents = {};
            for (const comp of acComponents) {
                if (comp.calcularCorriente) {
                    currents[comp.id || comp.name] = comp.calcularCorriente(fullVoltages, omega);
                }
            }

            // Guardar resultados de esta frecuencia
            resultsByFreq.push({
                frequency: freq,
                voltages: fullVoltages,
                currents: currents,
                powers: {},
                factors: {}
            });
        }

        // 5. Mapear resultados a formato de salida (por nodo/componente y por frecuencia)
        return this.mapResults(resultsByFreq, frequencies, circuit.id);
    }

    static mapResults(resultsByFreq, frequencies, circuitId) {
        const phasorVoltages = {};
        const phasorCurrents = {};

        if (resultsByFreq.length > 0) {
            const first = resultsByFreq[0];
            for (const node in first.voltages) {
                phasorVoltages[node] = new Array(frequencies.length);
            }
            for (const comp in first.currents) {
                phasorCurrents[comp] = new Array(frequencies.length);
            }
        }

        resultsByFreq.forEach((res, idx) => {
            for (const [node, phasor] of Object.entries(res.voltages)) {
                phasorVoltages[node][idx] = phasor;
            }
            for (const [comp, phasor] of Object.entries(res.currents)) {
                phasorCurrents[comp][idx] = phasor;
            }
        });

        return {
            id: circuitId,
            phasorVoltages,
            phasorCurrents,
            complexPowers: {},
            powerFactors: {},
            frequencySweep: frequencies
        };
    }
}

module.exports = ACAnalysis;