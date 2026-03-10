class Component {
    constructor(data) {
        this.id       = data.id;
        this.name     = data.name;
        this.type     = data.type;
        this.value    = data.value;
        this.nodes    = data.nodes; // [nodoPositivo, nodoNegativo, ...]
        this.position = data.position;
        this.rotation = data.rotation;
        this.params   = data.params || {};
        this.isLinear = true;
    }

    getImpedance(omega) {
        throw new Error(`getImpedance no implementado para ${this.type}`);
    }

    linearize(dcResult) {
        return this;
    }

    /**
     * Firma canónica usada en todo el motor:
     * (Y, I, omega, activeNodes, groundNode, nodeIndex)
     *
     * No lanza error — los componentes que no tienen contribución AC
     * (p.ej. fuentes DC puras) simplemente no hacen nada.
     */
    aportarAC(Y, I, omega, activeNodes, groundNode, nodeIndex) {
        // Implementación por defecto: sin contribución AC
    }

    /**
     * Firma canónica: (voltajes, omega)
     * Devuelve 0+0j por defecto para componentes sin corriente AC relevante.
     */
    calcularCorriente(voltajes, omega) {
        return require('mathjs').complex(0, 0);
    }

    /**
     * Helper legacy — mantener por compatibilidad con cualquier subclase
     * que aún no haya migrado a nodeIndex.
     * Preferir nodeIndex[nodoId] directamente en subclases nuevas.
     */
    _getIndiceNodo(nodoId, nodosActivos) {
        const idx = nodosActivos.findIndex(n => n.id === nodoId);
        return idx !== -1 ? idx : null;
    }

    /**
     * Helper moderno — recibe el mapa nodeIndex directamente.
     */
    _idx(nodoId, nodeIndex) {
        return nodeIndex[nodoId] !== undefined ? nodeIndex[nodoId] : null;
    }

    obtenerInformacion() {
        return `[${this.type.toUpperCase()}] ${this.id} - Valor: ${this.value}`;
    }
}

module.exports = Component;