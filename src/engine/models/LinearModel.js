class LinearModel {
    constructor(nodes) {
        this.nodes = nodes; // Array of node IDs (order depends on model)
    }

    /**
     * Contributes to Y matrix and I vector for AC analysis.
     * @param {math.Matrix} Y - Admittance matrix
     * @param {math.Matrix} I - Current vector
     * @param {number} omega - Angular frequency (rad/s)
     * @param {Array} activeNodes - List of active node objects (with id)
     * @param {number|string} groundNodeId - ID of ground node
     * @param {Object} nodeIndex - Mapping node id -> index in Y/I
     */
    contributeAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex) {
        throw new Error('contributeAC must be implemented');
    }

    /**
     * Computes the phasor current through the model.
     * @param {Object} voltages - Map node id -> complex number
     * @param {number} omega - Angular frequency
     * @returns {math.Complex} Phasor current
     */
    computeCurrent(voltages, omega) {
        throw new Error('computeCurrent must be implemented');
    }

    // Helper to get index of a node (returns null if not active)
    _getNodeIndex(nodeId, nodeIndex) {
        return nodeIndex[nodeId] !== undefined ? nodeIndex[nodeId] : null;
    }
}

module.exports = LinearModel;