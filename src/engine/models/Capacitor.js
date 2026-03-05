const Component = require('./Component');
const parsearValorElectrico = require('../utils/valueParser');

class Capacitor extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.numericValue = parsearValorElectrico(this.value); // Sobrescribimos el 'value' del padre con el valor numérico calculado
        this.voltageRating = this.params.voltageRating; // Voltaje máximo que puede soportar el capacitor
        this.dielectricType = this.params.dielectricType; // Tipo de dieléctrico (cerámico, electrolítico, tantalio, etc.)
        this.isPolarized = this.params.isPolarized ?? false; // Indica si el capacitor es polarizado (como los electrolíticos) o no (como los cerámicos)
    }
}

module.exports = Capacitor;