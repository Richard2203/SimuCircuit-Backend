const math = require('mathjs');
const LinearSolver = require('./LinearSolver');
const { reconstruirVoltajes } = require('../utils/mathUtils');

class DCAnalysis {
    static async ejecutar(circuit, params = {}) {
        console.log('Iniciando Análisis DC (MNA)...');

        // 1. Identificar el nodo tierra y los nodos activos (N)
        const groundNode = circuit.obtenerNodoTierra();
        const activeNodes = circuit.nodos.filter(n => n.id !== groundNode);
        const N = activeNodes.length;

        // Mapa para encontrar rápidamente en qué fila/columna va cada nodo
        const nodeIndex = {};
        activeNodes.forEach((node, idx) => { nodeIndex[node.id] = idx; });

        // 2. Identificar las fuentes de voltaje (M)
        // Esto es crucial para el Análisis Nodal Modificado
        const voltageSources = circuit.componentes.filter(
            c => c.type === 'fuente_voltaje' || c.constructor.name === 'VoltageSource'
        );
        const M = voltageSources.length;

        // Mapa para saber qué índice le toca a cada fuente de voltaje (de 0 a M-1)
        const vsIndex = {};
        voltageSources.forEach((vs, idx) => { vsIndex[vs.id] = idx; });

        const totalSize = N + M;

        if (totalSize === 0) {
            throw new Error('El circuito no tiene nodos activos ni fuentes para analizar.');
        }

        // 3. Inicializar la Matriz A y el Vector Z con ceros
        // A = [ G  B ]
        //     [ C  D ]
        let A = math.matrix(math.zeros([totalSize, totalSize]));
        let Z = math.matrix(math.zeros([totalSize, 1]));

        // 4. Ensamblar el sistema (Estampar componentes)
        for (const comp of circuit.componentes) {
            // Verificamos si el componente tiene la capacidad de aportar en DC
            if (typeof comp.aportarDC === 'function') {
                // Pasamos A, Z, y los índices para que cada componente sepa dónde estamparse
                comp.aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N);
            }
        }

        // 5. Resolver el sistema lineal ( A * X = Z )
        let X;
        try {
            console.log('--- Sistema de Ecuaciones DC ---');
            console.log('Matriz A (MNA):\n', math.format(A, { precision: 4, compact: true }));
            console.log('Vector Z (Lado Derecho):\n', math.format(Z, { precision: 4, compact: true }));

            // Usamos tu solver LU que ya tienes implementado
            X = LinearSolver.resolver(A, Z);
            
            console.log('Vector X (Solución):\n', X.map(x => math.format(x, { precision: 4 })));
        } catch (error) {
            throw new Error(`Error matemático al resolver el sistema DC: ${error.message}. ¿Hay nodos flotantes o cortos?`);
        }

        // 6. Extraer y formatear los resultados
        // Los primeros N valores del vector X son los voltajes de los nodos
        const nodeVoltagesArray = X.slice(0, N);
        // Usamos tu función de mathUtils para incluir la tierra (0V) en el mapa final
        const fullVoltages = reconstruirVoltajes(nodeVoltagesArray, groundNode, circuit, activeNodes, nodeIndex);

        // Los siguientes M valores son las corrientes que atraviesan las fuentes de voltaje
        const currentThroughVS = {};
        voltageSources.forEach((vs, idx) => {
            currentThroughVS[vs.id] = X[N + idx]; // N + idx nos da la posición exacta en la parte inferior del vector
        });

        // 7. Calcular las corrientes individuales de cada componente lineal
        const currents = {};
        for (const comp of circuit.componentes) {
            if (typeof comp.calcularCorrienteDC === 'function') {
                currents[comp.id || comp.name] = comp.calcularCorrienteDC(fullVoltages);
            }
        }

        // Retornamos el formato ordenado
        return {
            voltages: fullVoltages,
            currents: currents,
            voltageSourceCurrents: currentThroughVS
        };
    }
}

module.exports = DCAnalysis;