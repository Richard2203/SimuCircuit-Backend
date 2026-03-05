class Component {
    constructor(data) {
        this.id = data.id;
        this.type = data.type;
        this.value = data.value;
        this.nodes = data.nodes;
        this.params = data.params || {};
    }

    // Método genérico que las clases hijas podrán sobrescribir si lo necesitan
    obtenerInformacion() {
        return `[${this.type.toUpperCase()}] ${this.id} - Valor: ${this.value}`;
    }
}

module.exports = Component;