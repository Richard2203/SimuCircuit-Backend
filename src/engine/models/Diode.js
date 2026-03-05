const Component = require('./Component');

class Diode extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_DIODE'; // Estandarizamos el modelo (ej. " 1n 4007 " -> "1N4007")
        this.technology = this.params.technology;
        this.forwardDrop = this.params.forwardDrop;
        this.maxCurrent = this.params.maxCurrent;
        this.breakdownVoltage = this.params.breakdownVoltage;
    }
}

module.exports = Diode;