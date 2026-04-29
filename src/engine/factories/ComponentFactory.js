const Resistor = require('../models/Resistor');
const VoltageSource = require('../models/VoltageSource');
const CurrentSource = require('../models/CurrentSource');
const Capacitor = require('../models/Capacitor');
const Coil = require('../models/Coil');
const { Diode } = require('../models/Diode');
const TransistorBJT = require('../models/TransistorBJT');
const TransistorFET = require('../models/TransistorFET');
const VoltageRegulator = require('../models/VoltageRegulator');

/**
 * Helper: extrae el id de nodo a partir de cualquier formato soportado.
 *  - 'string'                                          → 'string'
 *  - { nodo: '0', x: ..., y: ... }                     → '0'
 *  - undefined / null                                  → null
 *
 * El frontend envia cada terminal como objeto { nodo, x, y } para mantener
 * la informacion de posicion visual, pero el motor de simulacion solo
 * necesita el id del nodo.
 */
function nodoIdOf(n) {
    if (n === null || n === undefined) return null;
    if (typeof n === 'object') {
        if ('nodo' in n) return String(n.nodo);
        if ('id'   in n) return String(n.id);
        return null;
    }
    return String(n);
}

class ComponentFactory {
    static crearComponente(data) {

        // 1. TRADUCCION DE NODOS (De Objeto Semantico a Arreglo Estricto)
        if (data.nodes && !Array.isArray(data.nodes) && typeof data.nodes === 'object') {
            const n = data.nodes;
            const type = data.type.toLowerCase();

            switch (type) {
                case 'transistor_bjt':
                    data.nodes = [nodoIdOf(n.nB), nodoIdOf(n.nC), nodoIdOf(n.nE)];
                    break;
                case 'transistor_fet':
                    data.nodes = [nodoIdOf(n.nG), nodoIdOf(n.nD), nodoIdOf(n.nS)];
                    break;
                case 'regulador_voltaje':
                    data.nodes = [nodoIdOf(n.nIn), nodoIdOf(n.nOut), nodoIdOf(n.nGnd)];
                    break;
                case 'fuente_voltaje':
                case 'voltage_source':
                case 'fuente_corriente':
                case 'current_source':
                    data.nodes = [nodoIdOf(n.pos), nodoIdOf(n.neg)];
                    break;
                case 'resistencia_variable':
                    // Potenciometro: 3 patas — A (Pin1), W (Pin2/wiper) y B (Pin3).
                    // Aqui lo modelamos como un resistor entre A y B; la division
                    // correcta (A-W y W-B) se realiza en ConstructorCircuitos
                    // mediante la expansion a dos resistores en serie.
                    data.nodes = [
                        nodoIdOf(n.n1 ?? n.a ?? n.izquierda),
                        nodoIdOf(n.n3 ?? n.b ?? n.derecha ?? n.n2 ?? n.w)
                    ];
                    break;
                default:
                    data.nodes = [nodoIdOf(n.n1), nodoIdOf(n.n2)];
                    break;
            }
        } else if (Array.isArray(data.nodes)) {
            // Si ya viene como array, mapear por si trae objetos
            data.nodes = data.nodes.map(nodoIdOf);
        }

        // 2. CREACION DE LA INSTANCIA
        const type = data.type.toLowerCase();
        switch (type) {
            case 'resistencia':
            case 'resistencia_variable':
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
module.exports.nodoIdOf = nodoIdOf;
