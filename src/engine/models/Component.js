class Component {
    constructor(data) {
        this.id       = data.id;
        this.name     = data.name;
        this.type     = data.type;
        this.value    = data.value;
        this.nodes    = data.nodes;
        this.position = data.position;
        this.rotation = data.rotation;
        this.params   = data.params || {};

        // Si el dato de entrada define isLinear explícitamente, respetarlo.
        // Subclases no lineales (TransistorBJT, Diode, etc.) deben setear
        // this.isLinear = false DESPUÉS de super(data), lo que tiene prioridad.
        this.isLinear = data.isLinear !== undefined ? data.isLinear : true;
    }

    getImpedance(omega) {
        throw new Error(`getImpedance no implementado para ${this.type}`);
    }

    linearize(dcResult) {
        return this;
    }

    /**
     * Firma canónica: (Y, I, omega, activeNodes, groundNode, nodeIndex)
     * Sin contribución AC por defecto (cubre fuentes DC puras, etc.)
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {}

    /**
     * Firma canónica: (voltajes, omega)
     */
    calcularCorriente(voltajes, omega) {
        return require('mathjs').complex(0, 0);
    }

    /** Helper moderno O(1) */
    _idx(nodoId, nodeIndex) {
        return nodeIndex[nodoId] !== undefined ? nodeIndex[nodoId] : null;
    }

    /** Helper legacy para subclases que aún usan findIndex */
    _getIndiceNodo(nodoId, nodosActivos) {
        const idx = nodosActivos.findIndex(n => n.id === nodoId);
        return idx !== -1 ? idx : null;
    }

    obtenerInformacion() {
        return `[${this.type.toUpperCase()}] ${this.id} - Valor: ${this.value}`;
    }
}

module.exports = Component;