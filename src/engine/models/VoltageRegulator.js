const Component = require('./Component');

class VoltageRegulator extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_VOLTAGE_REGULATOR'; // Estandarizamos el modelo (ej. "lm 7805 " -> "LM7805")
        this.type = this.params.type; // Tipo específico de regulador de voltaje (por ejemplo, lineal o conmutado)
        this.outputVoltage = this.params.outputVoltage; // Voltaje de salida del regulador
        this.maxCurrent = this.params.maxCurrent; // Corriente máxima que el regulador puede suministrar
        this.minInputVoltage = this.params.minInputVoltage; // Voltaje mínimo de entrada requerido para el regulador
        this.maxInputVoltage = this.params.maxInputVoltage; // Voltaje máximo de entrada permitido para el regulador
        this.dropoutVoltage = this.params.dropoutVoltage; // Voltaje de caída mínimo para reguladores lineales
        this.maxDissipation = this.params.maxDissipation; // Potencia máxima que el regulador puede disipar sin dañarse
        this.tolerance = this.params.tolerance; // Tolerancia del voltaje de salida (por ejemplo, ±5%)
    }
}

module.exports = VoltageRegulator;