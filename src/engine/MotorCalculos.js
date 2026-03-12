const ACAnalysis = require('./solvers/ACAnalysis');
const DCAnalysis = require('./solvers/DCAnalysis'); // 1. Importamos el nuevo Solver DC

class MotorCalculos {
    constructor(circuito) {
        this.circuito = circuito;
    }

    // --- MOTOR DC ---
    async ejecutarAnalisisDC(params = {}) {
        console.log(`\nIniciando Análisis DC para: ${this.circuito.nombre || this.circuito.id}`);
        // Llamamos al solver de analisis en DC y retornamos su resultado
        const resultadoDC = await DCAnalysis.ejecutar(this.circuito, params);
        return resultadoDC;
    }

    // --- MOTOR AC ACTUALIZADO ---
    async ejecutarAnalisisAC(params) {
        console.log(`\nIniciando Análisis AC para: ${this.circuito.nombre || this.circuito.id}`);
        
        let dcResult = { currents: {}, voltages: {} };
        
        // 2. Antes de barrer frecuencias en AC, calculamos el punto de operación DC real
        try {
            console.log('Calculando punto de operación DC para linealización de semiconductores...');
            dcResult = await this.ejecutarAnalisisDC(params);
        } catch (error) {
            // Si el DC falla (ej. circuito puramente capacitivo sin camino a tierra), 
            // atrapamos el error para que el AC no colapse y use sus valores por defecto (0.001A).
            console.warn('Advertencia: Análisis DC previo falló. Usando valores por defecto para linealización.');
            console.warn(error.message);
        }

        // 3. Ejecutamos el AC inyectando los voltajes y corrientes reales del DC
        const resultado = await ACAnalysis.ejecutar(this.circuito, params, dcResult);
        return resultado;
    }
}

module.exports = MotorCalculos;
