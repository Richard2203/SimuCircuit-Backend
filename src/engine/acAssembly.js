const math = require('mathjs');

/**
 * Prepares the list of active nodes and the index map.
 * @param {Array} nodes - List of all nodes (with id)
 * @param {number|string} groundNodeId - ID of the ground node
 * @returns {Object} { activeNodes, nodeIndex }
 */
function prepareNodes(nodes, groundNodeId) {
    const activeNodes = nodes.filter(n => n.id !== groundNodeId);
    const nodeIndex = {};
    activeNodes.forEach((node, idx) => { nodeIndex[node.id] = idx; });
    return { activeNodes, nodeIndex };
}

/**
 * Assembles the Y matrix and I vector for a given frequency.
 * @param {Array} components - List of components (linear or linearized models)
 * @param {number} f - Frequency in Hz
 * @param {number|string} groundNodeId - ID of the ground node
 * @param {Array} activeNodes - List of active nodes (with id)
 * @param {Object} nodeIndex - Mapping node id -> index
 * @returns {Object} { Y, I } math.js matrices
 */
function assembleAC(components, f, groundNodeId, activeNodes, nodeIndex) {
    const n = activeNodes.length;
    let Y = math.matrix(math.zeros([n, n]));
    let I = math.matrix(math.zeros([n, 1]));
    const omega = 2 * Math.PI * f;

    for (const comp of components) {
        if (typeof comp.contributeAC === 'function') {
            comp.contributeAC(Y, I, omega, activeNodes, groundNodeId, nodeIndex);
        }
        // If no method, ignore (component may not contribute in AC)
    }

    return { Y, I };
}

module.exports = {
    prepareNodes,
    assembleAC
};