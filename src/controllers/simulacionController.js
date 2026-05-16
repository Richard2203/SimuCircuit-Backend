const { concat } = require('mathjs');
const MotorCalculos = require('../engine/MotorCalculos');
const { armarObjetoCircuito } = require('../utils/ConstructorCircuitos');
const ProcedureManager = require('../utils/ProcedureManager');

const analisisAC = async (req, res) => {
    try
    {
        // 1. Atrapamos la netlist y la configuración AC del cuerpo de la solicitud
        const { netlist, nombre_circuito, id, configuracion_ac } = req.body;

        const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
        // const idCircuito = `circuito_ac_${nombreSeguro}_${Date.now()}`;
        const id_procedure = `ID_${String(id).trim()}`; //Generamos la llave del diccionario
        
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

        // 3. Construimos el objeto de Circuito, acá se mapean los nodos, componentes y se valida que exista el nodo tierra.
        const circuitoAC = armarObjetoCircuito(netlist, Number(id));

        const nodosArray = circuitoAC.nodos;

        // Momento de validar el nodo tierra explícitamente
        if (!nodosArray.find(n => String(n.id) === '0')) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0").'
            });
        }

        // 4. Ejecutar simulación AC (Los parametros se mandan directamente en configuracion_ac)
        const motor = new MotorCalculos(circuitoAC);
        const resultado = await motor.ejecutarAnalisisAC(configuracion_ac);
        let pasosProcedimiento = null;

        // Verificamos si existe una plantilla redactada para este circuito específico
        if (ProcedureManager[id_procedure]) {
            // Le pasamos la netlist para que extraiga los valores y adjunte los cálculos
            pasosProcedimiento = ProcedureManager[id_procedure](netlist, resultado); 
        }

        res.json({
            exito: true,
            tipo_analisis: 'AC',
            data: resultado,
            procedimiento : pasosProcedimiento
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
    const { netlist, id, nombre_circuito } = req.body;

    const nombreSeguro = nombre_circuito ? nombre_circuito.replace(/\s+/g, '_') : 'sin_nombre';
    // const idCircuito = `circuito_dc_${nombreSeguro}_${Date.now()}`;
    const id_procedure = `ID_${String(id).trim()}`; //Generamos la llave del diccionario

    // 2. Validamos que la netlist tenga el formato esperado o no esté vacía
    if (!netlist || !Array.isArray(netlist) || netlist.length === 0) {
        return res.status(400).json({ 
            exito: false, 
            mensaje: 'No se recibió una Netlist válida para simular.' 
        });
    }

    console.log(`Iniciando Análisis DC del circuito ${id} con nombre: ${nombreSeguro} para una netlist con ${netlist.length} componentes...`);

    // 3. Construimos el objeto de Circuito, acá se mapean los nodos, componentes y se valida que exista el nodo tierra.
    const circuitoDC = armarObjetoCircuito(netlist, Number(id));

    const nodosArray = circuitoDC.nodos;

    // Momento de validar el nodo tierra explícitamente
    if (!nodosArray.find(n => String(n.id) === '0')) {
        return res.status(400).json({
            exito: false,
            mensaje: 'El circuito no tiene conexión a tierra. Por favor, conecta un nodo de GND (nodo "0").'
        });
    }

    // 4. Ejecutar simulación
    const motor = new MotorCalculos(circuitoDC);
    const resultado = await motor.ejecutarAnalisisDC();
    let pasosProcedimiento = null;

    // Verificamos si existe una plantilla redactada para este circuito específico
        if (ProcedureManager[id_procedure]) {
            // Le pasamos la netlist para que extraiga los valores y adjunte los cálculos (VR1, IR1, Itotal, etc.)
            pasosProcedimiento = ProcedureManager[id_procedure](netlist, resultado); 
        }

    res.json({
        exito: true,
        tipo_analisis: 'DC',
        data: resultado,
        procedimiento : pasosProcedimiento
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