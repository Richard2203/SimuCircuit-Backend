const Component = require('./Component');

class TransistorBJT extends Component {
    constructor(data) {
        super(data); // Llama al constructor del padre
        this.modelValue = this.value ? this.value.toString().toUpperCase().trim() : 'GENERIC_FET'; // Estandarizamos el modelo
        this.type = this.params.type; // 'JFET' o 'MOSFET canal N o P'
        this.idss = this.params.idss; // Corriente de drenaje máxima (IDSS)
        this.vp = this.params.vp; // Tensión de pinch-off (Vp)
        this.gm = this.params.gm; // Transconductancia máxima (gm0)
        this.rd = this.params.rd; // Resistencia de drenaje (Rd)
        this.configuration = this.params.configuration; // 'common-source', 'common-gate', 'common-drain'
        this.mode = this.params.mode; // 'cutoff', 'ohmic', 'saturation'
    }
}

module.exports = TransistorBJT;