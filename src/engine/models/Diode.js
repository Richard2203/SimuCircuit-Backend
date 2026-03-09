const Component = require('./Component');
const math = require('mathjs');

// Modelo lineal auxiliar: resistencia
class LinearizedResistor {
    constructor(resistance, nodes) {
        this.resistance = resistance;
        this.nodes = nodes;
        this.id = 'linearized_' + nodes.join('_'); // opcional
    }

    aportarAC(Y, I, freq, nodosActivos, nodoTierra) {
        const g = 1 / this.resistance;
        const Yval = math.complex(g, 0);
        const [n1, n2] = this.nodes;
        const i1 = this._getIndiceNodo(n1, nodosActivos);
        const i2 = this._getIndiceNodo(n2, nodosActivos);
        if (i1 !== null && i2 !== null) {
            Y.set([i1, i1], math.add(Y.get([i1, i1]), Yval));
            Y.set([i2, i2], math.add(Y.get([i2, i2]), Yval));
            Y.set([i1, i2], math.subtract(Y.get([i1, i2]), Yval));
            Y.set([i2, i1], math.subtract(Y.get([i2, i1]), Yval));
        } else if (i1 !== null) {
            Y.set([i1, i1], math.add(Y.get([i1, i1]), Yval));
        } else if (i2 !== null) {
            Y.set([i2, i2], math.add(Y.get([i2, i2]), Yval));
        }
    }

    calcularCorriente(voltajes, freq) {
        const [n1, n2] = this.nodes;
        const V1 = voltajes[n1] || math.complex(0, 0);
        const V2 = voltajes[n2] || math.complex(0, 0);
        const Z = math.complex(this.resistance, 0);
        return math.divide(math.subtract(V1, V2), Z);
    }

    _getIndiceNodo(nodoId, nodosActivos) {
        const idx = nodosActivos.findIndex(n => n.id === nodoId);
        return idx !== -1 ? idx : null;
    }
}

// Modelo lineal: circuito abierto
class LinearizedOpenCircuit {
    constructor(nodes) {
        this.nodes = nodes;
    }
    aportarAC() {}
    calcularCorriente() { return math.complex(0, 0); }
}

class Diode extends Component {
    constructor(data) {
        super(data);
        this.modelValue = data.modelValue;
        this.technology = this.params?.technology;
        this.forwardDrop = this.params?.forwardDrop; // Vf
        this.maxCurrent = this.params?.maxCurrent;
        this.breakdownVoltage = this.params?.breakdownVoltage;
        this.VT = 0.026; // tensión térmica
        this.n = 1.0; // factor de idealidad
    }

    linearize(dcResult) {
        // Obtener corriente DC (por ejemplo, de dcResult.corrientes[this.id])
        const ID = dcResult.corrientes?.[this.id] || 0.001; // valor por defecto
        if (ID <= 0) {
            return new LinearizedOpenCircuit(this.nodes);
        }
        const rd = (this.n * this.VT) / ID;
        return new LinearizedResistor(rd, this.nodes);
    }
}

module.exports = Diode;