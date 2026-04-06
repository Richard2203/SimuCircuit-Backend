const { re } = require('mathjs');
const pool = require('../config/db');
const ComponentFactory = require('../engine/factories/ComponentFactory');
const MotorCalculos = require('../engine/MotorCalculos');

const analisisAC = async (req, res) => {
    try
    {
        // 1. Atrapamos la netlist y la configuración AC del cuerpo de la solicitud
        const { netlist, nombre_circuito, configuracion_ac } = req.body;

        const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
        const idCircuito = `circuito_ac_${nombreSeguro}_${Date.now()}`;
        
        // 2. Validaciones de la netlist y la configuración AC
        if (!netlist || !Array.isArray(netlist) || netlist.length === 0) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió una Netlist válida para simular.' 
            });
        }
        if (!configuracion_ac || configuracion_ac.f_inicial === undefined || configuracion_ac.f_final === undefined) {
            return res.status(400).json({ 
                exito: false, 
                mensaje: 'No se recibió una configuración AC válida para simular. \nPara el análisis AC se requiere el objeto "configuracion_ac" (f_inicial, f_final, puntos, barrido).' 
            });
        }

        console.log(`Iniciando Análisis AC: ${configuracion_ac.f_inicial} Hz a ${configuracion_ac.f_final} Hz con ${configuracion_ac.puntos || 'N/A'} puntos...`);

        // 3. Mapeo de componentes de la netlist
        const componentesAC = netlist.map(compData => {
            try {
                const instancia = ComponentFactory.crearComponente(compData);
                if (compData.isLinear !== undefined) {
                    instancia.isLinear = compData.isLinear;
                }
                return instancia;
            } catch (error) {
                console.error(`Error al crear componente con ID ${compData.id}:`, error);
                throw new Error(`Componente con ID ${compData.id} tiene datos inválidos.`);
            }
        });

        // 4. Extracción de nodos
        const nodos = new Set();
        componentesAC.forEach(comp => {
            if (comp.nodes) {
                Object.values(comp.nodes).forEach(nodoId => {
                    if (nodoId !== null && nodoId !== undefined) {
                        nodos.add(String(nodoId));
                    }
                });
            }
        });

        const nodosArray = Array.from(nodos).map(idStr => ({ id: idStr }));

        // Momento de validar el nodo tierra explícitamente
        if (!nodosArray.find(n => String(n.id) === '0')) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0").'
            });
        }

        // 5. Crear el objeto circuito para el MotorCalculos
        const circuitoAC = {
            id: idCircuito,
            componentes: componentesAC,
            nodos: nodosArray,
            obtenerNodoTierra: function() {
                const nodoTierra = this.nodos.find(n => String(n.id) === '0');
                return nodoTierra ? nodoTierra.id : null;
            }
        };

        // 6. Ejecutar simulación AC (Los parametros se mandan directamente en configuracion_ac)
        const motor = new MotorCalculos(circuitoAC);
        const resultado = await motor.ejecutarAnalisisAC(configuracion_ac);

        res.json({
            exito: true,
            tipo_analisis: 'AC',
            data: resultado
        });

    } catch (error) {
        console.error('Error en simulación AC: ', error);
        res.status(500).json({ 
            exito: false,
            error: error.message 
        });
    }
};

const analisisDC = async (req, res) => {
    try {
    // 1. Atrapamos la netlist del cuerpo de la solicitud
    const { netlist, nombre_circuito } = req.body;

    const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
    const idCircuito = `circuito_dc_${nombreSeguro}_${Date.now()}`;

    // 2. Validamos que la netlist tenga el formato esperado o no esté vacía
    if (!netlist || !Array.isArray(netlist) || netlist.length === 0) {
        return res.status(400).json({ 
            exito: false, 
            mensaje: 'No se recibió una Netlist válida para simular.' 
        });
    }

    console.log(`Iniciando Análisis DC para una netlist con ${netlist.length} componentes...`);

    // 3. Preparamos las estructuras para el motor MNA
    // Se hace el mapeo del JSON recibido a las clases de componentes del motor de simulación
    const componentesDC = netlist.map(compData => {
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

    componentesDC.forEach(comp => {
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
    console.log(`Nodos: ${JSON.stringify(nodosArray)}`);

    // 5. Crear el objeto circuito que el MotorCalculos espera
    const circuitoDC = {
        // El ID del circuito se genera aquí, solo obtenemos el nombre del circuito de la netlist si viene incluido, o usamos un valor por defecto.
        id: idCircuito,
        componentes: componentesDC,
        nodos: nodosArray,
        obtenerNodoTierra: function() {
            // Ahora buscamos el objeto cuyo id sea '0'
            const nodoTierra = this.nodos.find(n => String(n.id) === '0');
            return nodoTierra ? nodoTierra.id : null;
        }
    };

//     if (!nodosArray.includes({ id: "0" })) {
//     return res.status(400).json({
//         exito: false,
//         mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0") para realizar la simulación.'
//     });
// }

    // 6. Ejecutar simulación
    const motor = new MotorCalculos(circuitoDC);
    const resultado = await motor.ejecutarAnalisisDC();

    res.json({
        exito: true,
        tipo_analisis: 'DC',
        data: resultado
    });
    } catch (error) {
        console.error('Error en simulación DC: ', error);
        res.status(500).json({ 
            exito: false,
            error: error.message 
        });
    }
};

module.exports = {
    analisisAC,
    analisisDC
};