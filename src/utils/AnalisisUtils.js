const parsearValorElectrico = require('../engine/utils/valueParser');

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

module.exports = {
    extraerValorDeResultados
};