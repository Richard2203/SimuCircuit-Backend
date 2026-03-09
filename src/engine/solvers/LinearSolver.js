const { resolverSistemaLineal } = require('../utils/mathUtils');

class LinearSolver {
    static resolver(A, b) {
        return resolverSistemaLineal(A, b);
    }
}

module.exports = LinearSolver;