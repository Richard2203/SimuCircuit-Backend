const Component = require('./Component');
const parsearValorElectrico = require('../utils/valueParser');

class Coil extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.numericValue = parsearValorElectrico(this.value); // Sobrescribimos el 'value' del padre con el valor numérico calculado
        this.maxCurrent = this.params.maxCurrent; // Corriente máxima que puede soportar la bobina
        this.dcResistance = this.params.dcResistance; // Resistencia de corriente continua
    }
}

module.exports = Coil;