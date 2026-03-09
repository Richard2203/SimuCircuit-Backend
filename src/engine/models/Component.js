class Component {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.value = data.value;
        this.nodes = data.nodes; // [nodoPositivo, nodoNegativo]
        this.position = data.position;
        this.rotation = data.rotation;
        this.params = data.params || {};
    }

    getImpedance(freq) {
        throw new Error(`getImpedance no implementado para ${this.type}`);
    }

    linearize(dcResult) {
        return this;
    }

    aportarAC(Y, I, freq, nodosActivos, nodoTierra) {
        throw new Error(`aportarAC no implementado para ${this.type}`);
    }

    calcularCorriente(voltajes, freq) {
        throw new Error(`calcularCorriente no implementado para ${this.type}`);
    }

    /**
     * Retorna el índice del nodo en nodosActivos.
     * nodosActivos ya excluye el nodo tierra, así que si nodoId es tierra,
     * findIndex retorna -1 → null. La exclusión es implícita y correcta.
     */
    _getIndiceNodo(nodoId, nodosActivos) {
        const idx = nodosActivos.findIndex(n => n.id === nodoId);
        return idx !== -1 ? idx : null;
    }

    obtenerInformacion() {
        return `[${this.type.toUpperCase()}] ${this.id} - Valor: ${this.value}`;
    }
}

module.exports = Component;