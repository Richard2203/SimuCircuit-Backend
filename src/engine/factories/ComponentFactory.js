const Resistor = require('../models/Resistor');
const VoltageSource = require('../models/VoltageSource');
const CurrentSource = require('../models/CurrentSource');
const Capacitor = require('../models/Capacitor');
const Coil = require('../models/Coil');
const { Diode } = require('../models/Diode');
const TransistorBJT = require('../models/TransistorBJT');
const TransistorFET = require('../models/TransistorFET');
const VoltageRegulator = require('../models/VoltageRegulator');

class ComponentFactory {
    static crearComponente(data) {

        // 1. TRADUCCIÓN DE NODOS (De Objeto Semántico a Arreglo Estricto)
        // Verificamos si data.nodes es un objeto literal (y no un arreglo ya formateado)
        if (data.nodes && !Array.isArray(data.nodes) && typeof data.nodes === 'object') {
                const n = data.nodes;
                const type = data.type.toLowerCase();
                
                switch (type) {
                    case 'transistor_bjt':
                        // Orden matemático: [Base, Colector, Emisor]
                        data.nodes = [n.base, n.colector, n.emisor];
                        break;
                    case 'transistor_fet':
                        // Orden matemático: [Gate, Drain, Source]
                        data.nodes = [n.gate, n.drain, n.source];
                        break;
                    case 'diodo':
                        // Orden matemático: [Anodo, Catodo]
                        data.nodes = [n.anode, n.cathode];
                        break;
                    case 'regulador_voltaje':
                        // Orden matemático: [IN, OUT, GND]
                        data.nodes = [n.in, n.out, n.gnd];
                        break;
                    case 'fuente_voltaje':
                    case 'voltage_source':
                    case 'fuente_corriente':
                    case 'current_source':
                        // Orden matemático: [Positivo, Negativo]
                        data.nodes = [n.pos, n.neg];
                        break;
                    default:
                        // Resistor, Capacitor, Bobina: [n1, n2]
                        data.nodes = [n.n1, n.n2];
                        break;
                }
            }
            
        // 2. CREACIÓN DE LA INSTANCIA
        // Ahora data.nodes ya es un arreglo (Ej. ['2', '1', '0']) y no romperá el destructuring
        const type = data.type.toLowerCase();        
        switch (type) {
            case 'resistencia':
                return new Resistor(data);
            case 'fuente_voltaje':
                return new VoltageSource(data);
            case 'fuente_corriente':
                return new CurrentSource(data);
            case 'capacitor':
                return new Capacitor(data);
            case 'bobina':
                return new Coil(data);
            case 'diodo':
                return new Diode(data);
            case 'transistor_bjt':
                return new TransistorBJT(data);
            case 'transistor_fet':
                return new TransistorFET(data);
            case 'regulador_voltaje':
                return new VoltageRegulator(data);
            default:
                throw new Error(`Tipo de componente no identificado o no soportado ('${data.type}')`);
        }
    }
}

module.exports = ComponentFactory;