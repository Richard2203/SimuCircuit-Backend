const ACAnalysis = require('./solvers/ACAnalysis');

class MotorCalculos {
    constructor(circuito) {
        this.circuito = circuito;
    }

    async ejecutarAnalisisAC(params) {
        // En un caso real, aquí se ejecutaría el análisis DC para obtener dcResult
        const dcResult = { corrientes: {} }; // simulación DC vacía por ahora
        const resultado = await ACAnalysis.ejecutar(this.circuito, params, dcResult);
        return resultado;
    }
}

module.exports = MotorCalculos;