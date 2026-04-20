const ComponentFactory = require('../engine/factories/ComponentFactory');
// Constructor de circuitos para simular AC O DC
// Esta función existe para evitar repetir el mismo código de mapeo y construcción de circuitos en cada controlador, y centralizar la lógica de cómo se construyen los objetos circuito a partir de la netlist recibida.

const armarObjetoCircuito = (netlist, idCircuito) => {
    // 1. Preparamos las estructuras para el motor MNA
    // Se hace el mapeo del JSON recibido a las clases de componentes del motor de simulación
    const componentes = netlist.map(compData => {
        try {
            const instancia = ComponentFactory.crearComponente(compData);
            // Preservar isLinear solo si el compData lo define explícitamente
            if (compData.isLinear !== undefined) {
                instancia.isLinear = compData.isLinear;
            }
            return instancia;
        } catch (error) {
            console.error(`Error al crear componente con ID ${compData.id}:`, error);
            throw new Error(`Componente con ID ${compData.id} tiene datos inválidos.`);
        }
    });

    // 4. Preparar el arreglo de nodos del circuito a partir de los componentes
    const nodos = new Set();

    componentes.forEach(comp => {
        // comp.nodes puede ser un arreglo ['1', '2'] o un objeto { in: '1', out: '2', gnd: '0' }
        // Object.values() extrae solo los valores ('1', '2', '0') sin importar las llaves
        if (comp.nodes) {
            Object.values(comp.nodes).forEach(nodoId => {
                // Solo agregamos si el nodoId es válido (no nulo/indefinido)
                if (nodoId !== null && nodoId !== undefined) {
                    nodos.add(String(nodoId)); // Lo forzamos a String por seguridad
                }
            });
        }
    });

    // Convertimos el array de nodos ["0", "1", "2"] a un formato que el MotorCalculos espera, por ejemplo: [{ id: "0" }, { id: "1" }, { id: "2" }]
    const nodosArray = Array.from(nodos).map(idStr => ({ id: idStr }));

    // 5. Devolver el objeto circuito que el MotorCalculos espera
    const circuito = {
        // El ID del circuito se genera aquí, solo obtenemos el nombre del circuito de la netlist si viene incluido, o usamos un valor por defecto.
        id: idCircuito,
        componentes: componentes,
        nodos: nodosArray,
        obtenerNodoTierra: function() {
            // Ahora buscamos el objeto cuyo id sea '0'
            const nodoTierra = this.nodos.find(n => String(n.id) === '0');
            return nodoTierra ? nodoTierra.id : null;
        }
    };

    return circuito;
};

module.exports = {
    armarObjetoCircuito
};