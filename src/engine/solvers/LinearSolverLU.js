const math = require('mathjs');

class LinearSolverLU {
    static solve(A, b) {
        const n = A.size()[0];
        if (n !== b.size()[0]) throw new Error('Incompatible dimensions');

        // Work copies
        let U = math.matrix(A.toArray());
        let b_perm = math.matrix(b.toArray());
        let perm = Array.from({ length: n }, (_, i) => i);

        // LU factorization with partial pivoting
        for (let k = 0; k < n - 1; k++) {
            // Find pivot in column k
            let maxMag = 0;
            let pivotRow = k;
            for (let i = k; i < n; i++) {
                const mag = math.abs(U.get([i, k]));
                if (mag > maxMag) {
                    maxMag = mag;
                    pivotRow = i;
                }
            }
            if (maxMag < 1e-12) throw new Error('Singular matrix');

            if (pivotRow !== k) {
                // Swap rows in U
                for (let j = 0; j < n; j++) {
                    const temp = U.get([k, j]);
                    U.set([k, j], U.get([pivotRow, j]));
                    U.set([pivotRow, j], temp);
                }
                // Swap in b_perm
                const tempB = b_perm.get([k, 0]);
                b_perm.set([k, 0], b_perm.get([pivotRow, 0]));
                b_perm.set([pivotRow, 0], tempB);
                // Swap in perm
                [perm[k], perm[pivotRow]] = [perm[pivotRow], perm[k]];
            }

            const pivot = U.get([k, k]);

            // Elimination
            for (let i = k + 1; i < n; i++) {
                const factor = math.divide(U.get([i, k]), pivot);
                U.set([i, k], factor); // store L
                for (let j = k + 1; j < n; j++) {
                    const newVal = math.subtract(
                        U.get([i, j]),
                        math.multiply(factor, U.get([k, j]))
                    );
                    U.set([i, j], newVal);
                }
            }
        }

        // Forward substitution: L y = b_perm
        let y = new Array(n);
        for (let i = 0; i < n; i++) {
            let sum = math.complex(0, 0);
            for (let j = 0; j < i; j++) {
                sum = math.add(sum, math.multiply(U.get([i, j]), y[j]));
            }
            y[i] = math.subtract(b_perm.get([i, 0]), sum);
        }

        // Back substitution: U x = y
        let x = new Array(n);
        for (let i = n - 1; i >= 0; i--) {
            let sum = math.complex(0, 0);
            for (let j = i + 1; j < n; j++) {
                sum = math.add(sum, math.multiply(U.get([i, j]), x[j]));
            }
            x[i] = math.divide(math.subtract(y[i], sum), U.get([i, i]));
        }

        return x;
    }
}

module.exports = LinearSolverLU;