const Component = require('./Component');
const parsearValorElectrico = require('../../utils/valueParser');

class Resistor extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.numericValue = parsearValorElectrico(this.value); // Sobrescribimos el 'value' del padre con el valor numérico calculado
        this.powerRating = this.params.powerRating; // Potencia nominal de la resistencia
        this.bands = this.params.bands; // Colores de las 3 bandas de la resistencia, incluida la banda de tolerancia
    }

    obtenerConductancia() {
        return 1.0 / this.numericValue;
    }
}

module.exports = Resistor;