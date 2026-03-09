const math = require('mathjs');

function complexFromPolar(mag, phase) {
    return math.complex({ r: mag, phi: phase });
}

function polarToRect(fasor) {
    return math.complex({ r: fasor.mag, phi: fasor.phase });
}

function rectToPolar(c) {
    return { mag: math.abs(c), phase: math.arg(c) };
}

function resolverSistemaLineal(A, b) {
    try {
        const result = math.lusolve(A, b);
        const arr = result.toArray();
        return arr.map(row => row[0]);
    } catch (error) {
        throw new Error(`Error al resolver sistema lineal: ${error.message}`);
    }
}

/**
 * Reconstruye el mapa de voltajes para todos los nodos.
 * El nodo tierra siempre vale 0+0j.
 * Los nodos activos toman el valor del vector solución V.
 */
function reconstruirVoltajes(V, nodoTierra, circuito, nodosActivos, indiceNodo) {
    const voltajes = {};

    // Inicializar todos los nodos con 0
    circuito.nodos.forEach(nodo => {
        voltajes[nodo.id] = math.complex(0, 0);
    });

    // Asignar los valores de V a los nodos activos
    nodosActivos.forEach(nodo => {
        const idx = indiceNodo[nodo.id];
        if (idx !== undefined && idx < V.length) {
            voltajes[nodo.id] = V[idx];
        } else {
            console.warn(`Índice no válido para nodo ${nodo.id}`);
        }
    });

    return voltajes;
}

module.exports = {
    complexFromPolar,
    polarToRect,
    rectToPolar,
    resolverSistemaLineal,
    reconstruirVoltajes
};