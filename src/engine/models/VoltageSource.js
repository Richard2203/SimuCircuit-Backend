const Component = require('./Component');
const parsearValorElectrico = require('../utils/valueParser');

class VoltageSource extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.numericValue = parsearValorElectrico(this.value); // Sobrescribimos el 'value' del padre con el valor numérico calculado
        this.isActive = this.params.isActive ?? true;
        this.current = this.params.current;
        this.dcOrAc = this.params.dcOrAc;
    }
}

module.exports = VoltageSource;