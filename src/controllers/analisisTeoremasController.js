const MotorCalculos = require('../engine/MotorCalculos');
const ComponentFactory = require('../engine/factories/ComponentFactory');

const ejecutarTheveninNorton = async (req, res) => {
    try {
        const { netlist, componenteCargaId, nombre_circuito } = req.body;

        // Validamos que la netlist tenga el formato esperado o no esté vacía
        if (!netlist || !Array.isArray(netlist) || netlist.length === 0) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió una Netlist válida para realizar el análisis.' 
            });
        }

        // Validamos que el componente de carga haya sido especificado en el cuerpo de la solicitud
        if (!componenteCargaId) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió el ID del componente de carga. Por favor, especifica el ID del componente que deseas analizar.' 
            });
        }

        // --- SIMULACIÓN 1: Circuito Abierto (Voc) ---
        // 1. Encontrar la carga original para saber a qué nodos estaba conectada
        const cargaOriginal = netlist.find(c => c.id === componenteCargaId);

        // 2. Extraer los valores de sus nodos. 
        // Usamos Object.values() porque una resistencia usa {n1: "x", n2: "y"} 
        // pero otros componentes podrían usar {pos: "x", neg: "y"}
        const valoresNodos = Object.values(cargaOriginal.nodes);
        const nodoA = String(valoresNodos[0]); 
        const nodoB = String(valoresNodos[1]);

        // 3. Filtramos la netlist para quitar la resistencia de carga, esto para la simulación de circuito Abierto (OC)
        const netlistOC = netlist.filter(c => c.id !== componenteCargaId);

        //Identificamos el nombre del circuito para generar un ID único
        const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
        const idCircuito = `circuito_dc_${nombreSeguro}_${Date.now()}`;

        console.log(`Iniciando Análisis de Thévenin/Norton para una netlist con ${netlist.length} componentes...`);

        // Preparamos las estructuras para el motor MNA del OC
        // Se hace el mapeo del JSON recibido a las clases de componentes del motor de simulación
        const componentesOC = netlistOC.map(compData => {
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

        // Preparar el arreglo de nodos del circuito a partir de los componentes
        const nodosOC = new Set();

        componentesOC.forEach(comp => {
            // comp.nodes puede ser un arreglo ['1', '2'] o un objeto { in: '1', out: '2', gnd: '0' }
            // Object.values() extrae solo los valores ('1', '2', '0') sin importar las llaves
            if (comp.nodes) {
                Object.values(comp.nodes).forEach(nodoId => {
                    // Solo agregamos si el nodoId es válido (no nulo/indefinido)
                    if (nodoId !== null && nodoId !== undefined) {
                        nodosOC.add(String(nodoId)); // Lo forzamos a String por seguridad
                    }
                });
            }
        });

        // Convertimos el array de nodos ["0", "1", "2"] a un formato que el MotorCalculos espera, por ejemplo: [{ id: "0" }, { id: "1" }, { id: "2" }]
        const nodosArrayOC = Array.from(nodosOC).map(idStr => ({ id: idStr }));
        console.log(`Nodos: ${JSON.stringify(nodosArrayOC)}`);

        // Crear el objeto circuito que el MotorCalculos espera
        const circuitoOC = {
            id: idCircuito,
            componentes: componentesOC,
            nodos: nodosArrayOC,
            obtenerNodoTierra: function() {
                const nodoTierra = this.nodos.find(n => String(n.id) === '0');
                return nodoTierra ? nodoTierra.id : null;
            }
        };

        const motorOC = new MotorCalculos(circuitoOC);
        const resOC = await motorOC.ejecutarAnalisisDC();

        // 5. Calcular el voltaje de Thévenin con los nodos identificados
        const vA = resOC.voltages[nodoA] !== undefined ? resOC.voltages[nodoA] : 0;
        const vB = resOC.voltages[nodoB] !== undefined ? resOC.voltages[nodoB] : 0;
        const Vth = vA - vB;

        // --- SIMULACIÓN 2: Cortocircuito (Isc) ---
        // 5. Inyectar la fuente de 0V exactamente en los mismos nodos
        const fuenteCorto = {
            id: 'V_SHORT',
            type: 'fuente_voltaje',
            value: '0',
            nodes: { pos: nodoA, neg: nodoB },
            params: { dcOrAc: 'dc' }
        };
        const netlistSC = [...netlistOC, fuenteCorto];

        // Preparamos las estructuras para el motor MNA del ISC
        // Se hace el mapeo del JSON recibido a las clases de componentes del motor de simulación
        const componentesSC = netlistSC.map(compData => {
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

        // Preparar el arreglo de nodos del circuito a partir de los componentes
        const nodosSC = new Set();

        componentesSC.forEach(comp => {
            // comp.nodes puede ser un arreglo ['1', '2'] o un objeto { in: '1', out: '2', gnd: '0' }
            // Object.values() extrae solo los valores ('1', '2', '0') sin importar las llaves
            if (comp.nodes) {
                Object.values(comp.nodes).forEach(nodoId => {
                    // Solo agregamos si el nodoId es válido (no nulo/indefinido)
                    if (nodoId !== null && nodoId !== undefined) {
                        nodosSC.add(String(nodoId)); // Lo forzamos a String por seguridad
                    }
                });
            }
        });

        // Convertimos el array de nodos ["0", "1", "2"] a un formato que el MotorCalculos espera, por ejemplo: [{ id: "0" }, { id: "1" }, { id: "2" }]
        const nodosArraySC = Array.from(nodosSC).map(idStr => ({ id: idStr }));
        console.log(`Nodos: ${JSON.stringify(nodosArraySC)}`);

        // Crear el objeto circuito que el MotorCalculos espera
        const circuitoSC = {
            id: idCircuito,
            componentes: componentesSC,
            nodos: nodosArraySC,
            obtenerNodoTierra: function() {
                const nodoTierra = this.nodos.find(n => String(n.id) === '0');
                return nodoTierra ? nodoTierra.id : null;
            }
        };

        const motorSC = new MotorCalculos(circuitoSC);
        const resSC = await motorSC.ejecutarAnalisisDC();

        // La corriente de Norton es la corriente que pasa por nuestra fuente de 0V
        const In = resSC.voltageSourceCurrents['V_SHORT'];

        //NOTA: recordemos que Rth es igual a Rn si el circuito es lineal.
        const Rth = Math.abs(Vth / In);

        // --- CÁLCULO DE POTENCIA MÁXIMA ---
        const Pmax = Math.pow(Vth, 2) / (4 * Rth);

        res.json({
            exito: true,
            teorema: 'Thévenin / Norton',
            data: {
                thevenin: { Vth, Rth, unidadV: 'V', unidadR: 'Ω' },
                norton: { In, Rn: Rth, unidadI: 'A', unidadR: 'Ω' },
                maximaPotencia: { valor: Pmax, unidad: 'W' },
                procedimiento: [
                    { paso: 1, eq: `V_{th} = ${Vth.toFixed(3)}V` },
                    { paso: 2, eq: `I_{n} = ${In.toFixed(3)}A` },
                    { paso: 3, eq: `R_{th} = \\frac{${Vth.toFixed(2)}}{${In.toFixed(2)}} = ${Rth.toFixed(2)}\\Omega` }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

module.exports = {
    ejecutarTheveninNorton
};