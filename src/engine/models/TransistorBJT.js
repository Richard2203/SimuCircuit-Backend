const Component = require('./Component');

class TransistorBJT extends Component {
    constructor(data) {
        super(data);
        this.isLinear = false;
        this.modelValue = data.modelValue;
        this.polarity = data.params?.polarity;
        this.configuration = data.params?.configuration;
        this.beta = data.params?.beta || 100;
        this.vbeSat = data.params?.vbeSat;
        this.vceSat = data.params?.vceSat;
        this.maxCurrentColector = data.params?.maxCurrentCollector;
        this.maxPower = data.params?.maxPower;
        this.transitionFrequency = data.params?.transitionFrequency;
        this.mode = data.params?.mode;
    }
}

module.exports = TransistorBJT;