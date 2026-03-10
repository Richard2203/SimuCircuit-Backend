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
        if (this.dcOrAc === 'dc') {
            const [nPos, nNeg] = this.nodes;
            const iPos = nodeIndex[nPos] !== undefined ? nodeIndex[nPos] : null;
            const iNeg = nodeIndex[nNeg] !== undefined ? nodeIndex[nNeg] : null;
            const Gbig = math.complex(1e12, 0); // Conductancia enorme para simular corto

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
        } else {
            // Por implementar: fuentes de tensión AC (requieren MNA)
            throw new Error('AC voltage sources not yet implemented');
        }
    }

    calcularCorriente(voltajes, omega) {
        // Para fuentes DC, la corriente no es relevante en AC
        return math.complex(0, 0);
    }
}

module.exports = VoltageSource;