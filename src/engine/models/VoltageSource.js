const Component = require('./Component');
const math = require('mathjs');
const parsearValorElectrico = require('../utils/valueParser');

class VoltageSource extends Component {
    constructor(data) {
        super(data);
        this.numericValue = parsearValorElectrico(this.value);
        this.isActive = this.params?.isActive ?? true;
        this.current = this.params?.current;
        this.dcOrAc = this.params?.dcOrAc || 'dc';
        this.phase = this.params?.phase || 0;
    }

    /**
     * Aporta al sistema AC:
     * - Si es DC: se modela como un cortocircuito (admitancia muy grande).
     * - Si es AC: (pendiente de implementar con MNA).
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        const Gbig = math.complex(1e6, 0); // Conductancia enorme para simular corto
        const [nPos, nNeg] = this.nodes;
        const iPos = nodeIndex[nPos] !== undefined ? nodeIndex[nPos] : null;
        const iNeg = nodeIndex[nNeg] !== undefined ? nodeIndex[nNeg] : null;

        // 1. Estampar la conductancia enorme en la matriz Y
        const addToMatrix = (row, col, val) => {
            if (row === null || col === null) return;
            const current = Y.get([row, col]);
            Y.set([row, col], math.add(current, val));
        };

        if (iPos !== null && iNeg !== null) {
            addToMatrix(iPos, iPos, Gbig);
            addToMatrix(iNeg, iNeg, Gbig);
            addToMatrix(iPos, iNeg, math.multiply(-1, Gbig));
            addToMatrix(iNeg, iPos, math.multiply(-1, Gbig));
        } else if (iPos !== null) {
            addToMatrix(iPos, iPos, Gbig);
        } else if (iNeg !== null) {
            addToMatrix(iNeg, iNeg, Gbig);
        }

        // 2. Si es AC, inyectamos la corriente equivalente de Norton en el vector I 
        if(this.dcOrAc === 'ac') {
            // mathjs requiere la fase en radianes
            const phaseRad = this.phase * (Math.PI / 180);

            // Fasor V = Amplitud * e^(j*fase)
            const Vfasor = math.complex({
                r: this.numericValue,
                phi: phaseRad
            });

            // I_norton = V * Gbig (donde Gbig es la conductancia enorme del modelo DC)
            const Inorton = math.multiply(Vfasor, Gbig);

            // La corriente entra al nodo positivo (+) y sale del nodo negativo (-)
            if(iPos !== null) {
                const currentI = I.get([iPos, 0]);
                I.set([iPos, 0], math.add(currentI, Inorton));
            }
            if(iNeg !== null) {
                const currentI = I.get([iNeg, 0]);
                I.set([iNeg, 0], math.subtract(currentI, Inorton));
            }
        }
    //     else {
    //         // Por implementar: fuentes de tensión AC (requieren MNA)
    //         throw new Error('AC voltage sources not yet implemented');
    //     }
    }

    calcularCorriente(voltajes, omega) {
        // Para fuentes DC, la corriente no es relevante en AC
        return math.complex(0, 0);
    }

    aportarDC(A, Z, activeNodes, groundNode, nodeIndex, vsIndex, N) {
        // En DC, una fuente puramente AC actúa como un cortocircuito a Tierra, por lo que no aporta nada a la matriz A ni al vector Z.

        // if (this.dcOrAc === 'ac') return;
        const Vval = this.numericValue;
        const [nPos, nNeg] = this.nodes;
        
        const iPos = this._idx ? this._idx(nPos, nodeIndex) : (nodeIndex[nPos] !== undefined ? nodeIndex[nPos] : null);
        const iNeg = this._idx ? this._idx(nNeg, nodeIndex) : (nodeIndex[nNeg] !== undefined ? nodeIndex[nNeg] : null);
        
        // Identificamos en qué fila/columna extra le toca estamparse a esta fuente
        const vIdx = vsIndex[this.id];
        if (vIdx === undefined) return; 
        
        const rowIndex = N + vIdx; // Desplazamiento mágico del MNA

        // 1. Estampar Matriz B y C
        if (iPos !== null) {
            // Matriz B (Columna extra: la corriente sale del polo positivo)
            A.set([iPos, rowIndex], A.get([iPos, rowIndex]) + 1);
            // Matriz C (Fila extra: ecuación del voltaje positivo)
            A.set([rowIndex, iPos], A.get([rowIndex, iPos]) + 1);
        }

        if (iNeg !== null) {
            // Matriz B (Columna extra: la corriente entra al polo negativo)
            A.set([iNeg, rowIndex], A.get([iNeg, rowIndex]) - 1);
            // Matriz C (Fila extra: ecuación del voltaje negativo)
            A.set([rowIndex, iNeg], A.get([rowIndex, iNeg]) - 1);
        }

        // 2. Estampar Vector Z (El valor de la fuente de voltaje va en la parte inferior)
        Z.set([rowIndex, 0], Vval);
    }

    calcularCorrienteDC(voltajes) {
        // En MNA, la corriente de la fuente de voltaje es una incógnita que resuelve la matriz.
        // El solver (DCAnalysis.js) ya la extrae y la guarda en "voltageSourceCurrents".
        // Por lo tanto, aquí retornamos null para no duplicar datos.
        return null; 
    }
}

module.exports = VoltageSource;