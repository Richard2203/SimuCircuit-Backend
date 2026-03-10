class LinearModel {
    constructor(nodes) {
        this.nodes = nodes; // Array of node IDs (order depends on model)
    }

    /**
     * Contributes to Y matrix and I vector for AC analysis.
     * Nombre canónico usado en todo el motor: aportarAC
     * @param {math.Matrix} Y - Admittance matrix
     * @param {math.Matrix} I - Current vector
     * @param {number} omega - Angular frequency (rad/s)
     * @param {Array} activeNodes - List of active node objects (with id)
     * @param {number|string} groundNodeId - ID of ground node
     * @param {Object} nodeIndex - Mapping node id -> index in Y/I
     */
    aportarAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        throw new Error('aportarAC must be implemented by subclass');
    }

    /**
     * Computes the phasor current through the model.
     * Nombre canónico usado en todo el motor: calcularCorriente
     * @param {Object} voltages - Map node id -> complex number
     * @param {number} omega - Angular frequency
     * @returns {math.Complex} Phasor current
     */
    calcularCorriente(voltages, omega) {
        throw new Error('calcularCorriente must be implemented by subclass');
    }

    // Helper to get index of a node (returns null if not active / is ground)
    _getNodeIndex(nodeId, nodeIndex) {
        return nodeIndex[nodeId] !== undefined ? nodeIndex[nodeId] : null;
    }
}

module.exports = LinearModel;
