const Component = require('./Component');

class TransistorBJT extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_BJT'; // Estandarizamos el modelo (ej. " 2n2222 " -> "2N2222")
        this.polarity = this.params.polarity; // 'NPN' o 'PNP'
        this.configuration = this.params.configuration; // 'common-emitter', 'common-base', 'common-collector'
        this.beta = this.params.beta; // Ganancia de corriente
        this.vbeSat = this.params.vbeSat; // Tensión de saturación base-emisor
        this.vceSat = this.params.vceSat; // Tensión de saturación colector-emisor
        this.maxCurrentColector = this.params.maxCurrentCollector; // Corriente máxima del colector
        this.maxPower = this.params.maxPower; // Potencia máxima disipada
        this.transitionFrequency = this.params.transitionFrequency; // Frecuencia de transición (fT)
        this.mode = this.params.mode; // 'active', 'saturation', 'cutoff', 'reverse-active' 
    }
}

module.exports = TransistorBJT;