const parsearValorElectrico = require('../engine/utils/valueParser');
const math = require('mathjs');

/**
 * Extrae la caída de voltaje o la corriente de un componente específico 
 * a partir de los resultados brutos del motor MNA.
 * * @param {Object} resultadosMNA - El objeto que devuelve motor.ejecutarAnalisisDC()
 * @param {string} componenteId - El designador (ej. 'R2')
 * @param {string} parametro - 'voltaje' o 'corriente'
 * @param {Array} netlist - El JSON original para saber a qué nodos está conectado
 * @returns {number} - El valor calculado
 */
const extraerValorDeResultados = (resultadosMNA, componenteId, parametro, netlist) => {
    // 1. Buscar el componente en la netlist para saber sus nodos de conexión
    const componente = netlist.find(c => c.id === componenteId);
    
    if (!componente) {
        throw new Error(`Componente ${componenteId} no encontrado en la netlist.`);
    }

    // Extraemos los nodos (usamos Object.values porque las llaves son 'n1', 'pos', etc.)
    const valoresNodos = Object.values(componente.nodes);
    const nodoA = String(valoresNodos[0]);
    const nodoB = String(valoresNodos[1]);

    // Extraemos los potenciales absolutos de esos nodos desde los resultados del MNA
    // Si el nodo es '0' (Tierra) o no existe, su potencial es 0
    const voltajeNodoA = resultadosMNA.voltages[nodoA] !== undefined ? resultadosMNA.voltages[nodoA] : 0;
    const voltajeNodoB = resultadosMNA.voltages[nodoB] !== undefined ? resultadosMNA.voltages[nodoB] : 0;

    // La caída de voltaje (ΔV) siempre es la diferencia entre los terminales
    const caidaVoltaje = voltajeNodoA - voltajeNodoB;

    const tipoComp = componente.type.toLowerCase();

    if (parametro === 'voltaje') {
        // EN DC ideal, una bobina es un corcocircuito (OV), por lo que su caída de voltaje es 0.
        if(tipoComp === 'bobina') {
            return 0;
        }

        // Para todos los demás (Capacitores, Resistencias, Fuentes de Voltaje, Fuentes de Corriente), la caída de voltaje es la diferencia entre los nodos.
        return caidaVoltaje;
    }

    // 3. Calcular Corriente
    if (parametro === 'corriente') {
        // CASO A: Es una Resistencia (Aplicamos Ley de Ohm: I = V/R)
        if (tipoComp === 'resistencia') {
            const resistenciaValor = parsearValorElectrico(componente.value); //Para obtener el valor numérico de la resistencia, sin multiplicadores
            return caidaVoltaje / resistenciaValor;
        }

        // CASO B: Es una Fuente de Voltaje 
        // El MNA ya calcula esta corriente directamente en el arreglo (VoltageSourceCurrents)
        // Además, las bobinas en DC ideal se modelan internamente como fuentes de voltaje con caída de 0V, por lo que su corriente también se obtiene de esta sección.
        if (tipoComp === 'fuente_voltaje' || tipoComp === 'bobina') {
            return resultadosMNA.voltageSourceCurrents[componenteId] || 0;
        }
        
        // CASO C: Es una Fuente de Corriente
        if (tipoComp === 'fuente_corriente') {
             // Por definición, su corriente es su propio valor inyectado
             return parsearValorElectrico(componente.value); 
        }

        // Caso D: Capacitores
        // En DC se le llama estado estacionario, y se comportan como circuitos abiertos, por lo que su corriente es 0A.
        if (tipoComp === 'capacitor') {
            return 0; 
        }
    }

    throw new Error('Parámetro de análisis no válido. Usa "voltaje" o "corriente".');
};

/**
 * Extrae la caída de voltaje o la corriente de un componente específico 
 * a partir de los resultados complejos (fasoriales) del motor MNA en AC.
 * Devuelve un arreglo de objetos math.complex (uno por cada frecuencia analizada).
 * @param {Object} resultadosMNA - El objeto que devuelve motor.ejecutarAnalisisAC()
 * @param {string} componenteId - El designador (ej. 'R2')
 * @param {string} parametro - 'voltaje' o 'corriente'
 * @param {Array} netlist - El JSON original para saber a qué nodos está conectado
 * @returns {Array<math.complex>} - El arreglo de valores complejos calculados en forma de objetos math.complex
 */
const extraerValorDeResultadosAC = (resultadosMNA, componenteId, parametro, netlist) => {
    //Buscar el componente para saber sus nodos de conexión
    const componente = netlist.find(c => c.id === componenteId);

    //Validación de existencia del componente
    if (!componente) {
        throw new Error(`Componente ${componenteId} no encontrado en la netlist.`);
    }

    // 1. Extraer Corriente (Directamente del arreglo de corrientes fasoriales del MNA)
    if (parametro === 'corriente') {
        const corrientesArreglo = resultadosMNA.phasorCurrents[componenteId];
        
        if (!corrientesArreglo) {
            return []; // O manejar el error si el componente no generó corriente
        }

        // Convertimos el JSON {re, im} a verdaderos objetos math.complex
        // para que se puedan hacer operaciones matemáticas con ellos más adelante
        return corrientesArreglo.map(c => math.complex(c.re, c.im));
    }

    // 2. Extraer Caída de Voltaje (Restamos el fasor del Nodo A menos el Nodo B)
    if (parametro === 'voltaje') {
        const valoresNodos = Object.values(componente.nodes);
        const nodoA = String(valoresNodos[0]);
        const nodoB = String(valoresNodos[1]);

        // Extraemos los arreglos de fasores de ambos nodos
        const vA_array = resultadosMNA.phasorVoltages[nodoA] || [];
        const vB_array = resultadosMNA.phasorVoltages[nodoB] || [];

        const caidasVoltajeArreglo = [];

        // Iteramos sobre todos los puntos de frecuencia analizados (deben ser iguales para ambos nodos, pero por seguridad usamos Math.max)
        // Usamos Math.max por si la longitud varía, aunque deberían ser iguales
        const numPuntos = Math.max(vA_array.length, vB_array.length);

        for (let i = 0; i < numPuntos; i++) {
            // Si el nodo es 0 (Tierra) o no tiene voltaje, el fasor es 0 + 0i
            const vA_json = vA_array[i] || { re: 0, im: 0 };
            const vB_json = vB_array[i] || { re: 0, im: 0 };

            const fasorA = math.complex(vA_json.re, vA_json.im);
            const fasorB = math.complex(vB_json.re, vB_json.im);

            // Caída de Voltaje = Va - Vb (Resta vectorial de complejos)
            const caidaFasorial = math.subtract(fasorA, fasorB);
            
            caidasVoltajeArreglo.push(caidaFasorial);
        }

        return caidasVoltajeArreglo;
    }

    throw new Error('Parámetro de análisis no válido. Usa "voltaje" o "corriente".');
};

module.exports = {
    extraerValorDeResultados,
    extraerValorDeResultadosAC
};