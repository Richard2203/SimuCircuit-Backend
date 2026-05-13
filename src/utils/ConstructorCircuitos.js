const ComponentFactory = require('../engine/factories/ComponentFactory');
const parsearValorElectrico = require('../engine/utils/valueParser');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el id de nodo a partir del formato moderno ({nodo,x,y}) o legacy (string).
 */
function nodoIdOf(n) {
    if (n === null || n === undefined) return null;
    if (typeof n === 'object') {
        if ('nodo' in n) return String(n.nodo);
        if ('id'   in n) return String(n.id);
        return null;
    }
    return String(n);
}

/**
 * Pre-procesa la netlist para expandir potenciómetros (resistencia_variable)
 * con sus 3 terminales (A, W, B) en dos resistores en serie:
 *   R_AW de A a W, valor = R_total * 0.5
 *   R_WB de W a B, valor = R_total * 0.5
 *
 * Esto permite que el motor MNA, que sólo entiende componentes lineales de
 * 2 terminales, simule correctamente un divisor de tensión con potenciómetro.
 *
 * Si el potenciómetro sólo tiene 2 nodos conectados (A-B sin W), se trata
 * como un resistor único — tal como hace ComponentFactory por defecto.
 */
function expandirPotenciometros(netlist) {
    const expandido = [];
    netlist.forEach(comp => {
        const tipo = (comp.type || '').toLowerCase();

        if (tipo !== 'resistencia_variable') {
            expandido.push(comp);
            return;
        }

        // Sólo expandimos cuando viene como objeto con los tres terminales
        if (!comp.nodes || Array.isArray(comp.nodes) || typeof comp.nodes !== 'object') {
            expandido.push(comp);
            return;
        }

        const nA = nodoIdOf(comp.nodes.n1 ?? comp.nodes.a  ?? comp.nodes.izquierda);
        const nW = nodoIdOf(comp.nodes.n2 ?? comp.nodes.w  ?? comp.nodes.wiper ?? comp.nodes.centro);
        const nB = nodoIdOf(comp.nodes.n3 ?? comp.nodes.b  ?? comp.nodes.derecha);

        // Si falta cualquier terminal, dejamos pasar el componente original
        // (el factory lo manejará como resistor entre los dos primeros)
        if (!nA || !nW || !nB) {
            expandido.push(comp);
            return;
        }

        // Wiper al 50% por defecto. Si el componente trae params.wiper en (0..1)
        // lo respetamos.
        let alpha = 0.5;
        if (comp.params && typeof comp.params.wiper === 'number') {
            alpha = Math.min(0.999, Math.max(0.001, comp.params.wiper));
        }

        const totalR = parsearValorElectrico(comp.value);
        const Raw = Math.max(1e-3, totalR * alpha);
        const Rwb = Math.max(1e-3, totalR * (1 - alpha));

        expandido.push({
            ...comp,
            id: `${comp.id}_AW`,
            type: 'resistencia',
            value: String(Raw),
            nodes: { n1: nA, n2: nW },
        });
        expandido.push({
            ...comp,
            id: `${comp.id}_WB`,
            type: 'resistencia',
            value: String(Rwb),
            nodes: { n1: nW, n2: nB },
        });
    });
    return expandido;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor de circuitos para simular AC O DC
// Esta función centraliza la lógica de cómo se construyen los objetos
// circuito a partir de la netlist recibida.
// ─────────────────────────────────────────────────────────────────────────────

const armarObjetoCircuito = (netlist, idCircuito) => {
    // 0. Pre-proceso: expandir potenciómetros a 2 resistores en serie
    const netlistExpandida = expandirPotenciometros(netlist);

    // 1. Mapeo del JSON recibido a las clases de componentes del motor
    const componentes = netlistExpandida.map(compData => {
        try {
            const instancia = ComponentFactory.crearComponente(compData);
            // Preservar isLinear sólo si el compData lo define explícitamente
            if (compData.isLinear !== undefined) {
                instancia.isLinear = compData.isLinear;
            }
            return instancia;
        } catch (error) {
            console.error(`Error al crear componente con ID ${compData.id}:`, error);
            throw new Error(`Componente con ID ${compData.id} tiene datos inválidos.`);
        }
    });

    // 2. Preparar el arreglo de nodos del circuito a partir de los componentes
    const nodos = new Set();
    componentes.forEach(comp => {
        if (comp.nodes) {
            comp.nodes.forEach(nodoId => {
                if (nodoId !== null && nodoId !== undefined) {
                    nodos.add(String(nodoId));
                }
            });
        }
    });

    // Convertimos a [{ id: "0" }, { id: "1" }, ...]
    const nodosArray = Array.from(nodos).map(idStr => ({ id: idStr }));

    // 3. Devolver el objeto circuito esperado por MotorCalculos
    const circuito = {
        id: idCircuito,
        componentes: componentes,
        nodos: nodosArray,
        obtenerNodoTierra: function() {
            const nodoTierra = this.nodos.find(n => String(n.id) === '0');
            return nodoTierra ? nodoTierra.id : null;
        }
    };

    return circuito;
};

module.exports = {
    armarObjetoCircuito,
    expandirPotenciometros,
    nodoIdOf,
};
