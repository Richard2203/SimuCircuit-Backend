const math = require('mathjs');
const LinearSolver = require('./LinearSolver');
const { reconstruirVoltajes } = require('../utils/mathUtils');

class DCAnalysis {
    static async ejecutar(circuit, params = {}) {
        console.log('Iniciando Análisis DC (Newton-Raphson MNA)...');

        // Identificar el nodo tierra y los nodos activos (N)
        const groundNode = circuit.obtenerNodoTierra();
        const activeNodes = circuit.nodos.filter(n => n.id !== groundNode);
        const N = activeNodes.length;

        // Mapa para encontrar rápidamente en qué fila/columna va cada nodo
        const nodeIndex = {};
        activeNodes.forEach((node, idx) => { nodeIndex[node.id] = idx; });

        // Identificar las fuentes de voltaje (M)
        // Esto es crucial para el Análisis Nodal Modificado
        const voltageSources = circuit.componentes.filter(
            c => c.type === 'fuente_voltaje' || c.constructor.name === 'VoltageSource'
        );
        const M = voltageSources.length;

        // Mapa para saber qué índice le toca a cada fuente de voltaje (de 0 a M-1)
        const vsIndex = {};
        voltageSources.forEach((vs, idx) => { vsIndex[vs.id] = idx; });

        const totalSize = N + M;
        if (totalSize === 0) throw new Error('El circuito no tiene nodos activos.');

        // --- CONFIGURACIÓN NEWTON-RAPHSON ---
        const MAX_ITER = params.maxIter || 100;
        const TOLERANCE = params.tolerance || 1e-6; 
        
        // Estado inicial (Adivinanza inicial: Todos los nodos en 0V)
        let lastVoltages = {};
        circuit.nodos.forEach(n => lastVoltages[n.id] = 0);
        
        let X; // Vector solución
        let iter = 0;
        let converged = false;

        // ¿El circuito tiene semiconductores (componentes no lineales)?
        const hasNonLinear = circuit.componentes.some(c => typeof c.aportarNonLinearDC === 'function');

        // --- BUCLE PRINCIPAL ---
        for (iter = 0; iter < MAX_ITER; iter++) {
            // Reiniciamos las matrices en cada iteración
            // A = [ G  B ]
            //     [ C  D ]
            let A = math.matrix(math.zeros([totalSize, totalSize]));
            let Z = math.matrix(math.zeros([totalSize, 1]));

            // Ensamblamos los componentes
            for (const comp of circuit.componentes) {
                // Componentes Lineales (Resistencias, Fuentes, etc.)
                if (typeof comp.aportarDC === 'function') {
                    comp.aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N);
                }
                
                // Componentes No Lineales (Diodos, Transistores. Necesitan los voltajes anteriores)
                if (typeof comp.aportarNonLinearDC === 'function') {
                    comp.aportarNonLinearDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N, lastVoltages);
                }
            }

            try {
                // Resolvemos el sistema lineal de esta iteración
                console.log('--- Sistema de Ecuaciones DC ---');
                console.log('Matriz A (MNA):\n', math.format(A, { precision: 4, compact: true }));
                console.log('Vector Z (Lado Derecho):\n', math.format(Z, { precision: 4, compact: true }));

                X = LinearSolver.resolver(A, Z);

                console.log('Vector X (Solución):\n', X.map(x => math.format(x, { precision: 4 })));
            } catch (error) {
                throw new Error(`Fallo de convergencia en la iteración ${iter}: ${error.message}. ¿Hay nodos flotantes o cortos?`);
            }

            // Reconstruimos los voltajes calculados en esta vuelta
            const nodeVoltagesArray = X.slice(0, N);
            const calculatedVoltages = reconstruirVoltajes(nodeVoltagesArray, groundNode, circuit, activeNodes, nodeIndex);

            // --- PRUEBA DE CONVERGENCIA Y AMORTIGUAMIENTO---
            let maxDiff = 0;
            const currentVoltages = {};

            for (const nodeId in calculatedVoltages) {
                let step = calculatedVoltages[nodeId] - lastVoltages[nodeId];
            
                //Limitar el salto máximo de voltaje para evitar oscilaciones
                //Evita que el algoritmo "rebote" hacia el infinito
            
                if(hasNonLinear){
                    const MAX_STEP = 0.5; // El voltaje no puede cambiar más de 0.5V por iteración
                    if (step > MAX_STEP) step = MAX_STEP;
                    if (step < -MAX_STEP) step = -MAX_STEP;
                }

                currentVoltages[nodeId] = lastVoltages[nodeId] + step;
                
                const diff = Math.abs(currentVoltages[nodeId] - lastVoltages[nodeId]);
                if (diff > maxDiff) maxDiff = diff;
                console.log(`diferencia diff: ${diff}. Diferencia máxima actualizada: ${maxDiff}`);
            }

            // Actualizamos la memoria de voltajes para la siguiente vuelta
            lastVoltages = currentVoltages;

            // Si la mayor diferencia es menor a nuestra tolerancia, el circuito se estabilizó
            if (maxDiff < TOLERANCE) {
                converged = true;
                break; 
            }
        }

        if (!converged) {
            console.warn(`Advertencia: El análisis DC no convergió después de ${MAX_ITER} iteraciones.`);
        } else {
            console.log(`Convergencia alcanzada en ${iter + 1} iteraciones.`);
        }

        // --- EXTRACCIÓN DE RESULTADOS FINALES ---
        const currentThroughVS = {};
        voltageSources.forEach((vs, idx) => {
            currentThroughVS[vs.id] = X[N + idx];
        });

        // Calcular las corrientes individuales de cada componente lineal
        const currents = {};
        for (const comp of circuit.componentes) {
            // Pasamos lastVoltages que ahora contiene los voltajes finales y perfectos
            if (typeof comp.calcularCorrienteDC === 'function') {
                currents[comp.id || comp.name] = comp.calcularCorrienteDC(lastVoltages);
            }
        }

        // Retornamos el formato ordenado
        return {
            voltages: lastVoltages,
            currents: currents,
            voltageSourceCurrents: currentThroughVS,
            iterations: iter + 1
        };
    }
}

module.exports = DCAnalysis;