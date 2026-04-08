const pool = require('../config/db'); // Importamos la conexión a la base de datos

/**
 * Función auxiliar para saber qué tabla hija consultar según el tipo de componente
 */
function obtenerNombreTablaHija(tipo) {
    const tipoNormalizado = tipo.toLowerCase().trim();
    switch (tipoNormalizado) {
        case 'resistencia': return 'resistencia';
        case 'fuente de voltaje': return 'fuente_voltaje';
        case 'fuente de corriente': return 'fuente_corriente';
        case 'capacitor': return 'capacitor';
        case 'bobina': return 'bobina';
        case 'diodo': return 'diodo';
        case 'transistor bjt': return 'transistor_bjt';
        case 'transistor fet': return 'transistor_fet';
        case 'regulador de voltaje': return 'regulador_voltaje';
        default: return null;
    }
}

const obtenerCircuitoCompleto = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener la metadata general del circuito
        const [circuitoRows] = await pool.query('SELECT * FROM circuito WHERE id = ?', [id]);
        
        //Error 404
        if (circuitoRows.length === 0) {
            return res.status(404).json({ 
                exito: false, 
                mensaje: 'Circuito no encontrado en la base de datos.' 
            });
        }
        const circuito = circuitoRows[0];

        // 2. Obtener TODAS las instancias de componentes para este circuito
        const [instancias] = await pool.query(`
            SELECT ic.id AS 'instancia_id', ic.designador, ic.posicion_x, ic.posicion_y, ic.rotacion,
                   c.id AS 'componente_id', c.nombre, c.tipo, c.valor
            FROM instancia_componente ic
            JOIN componente c ON ic.componente_id = c.id
            WHERE ic.circuito_id = ?
        `, [id]);

        // 3. Obtener TODOS los nodos de conexión
        const [nodos] = await pool.query(`
            SELECT numero_nodo, instancia_componente_id, pin_terminal, posicion_x, posicion_y
            FROM nodo
            WHERE circuito_id = ?
        `, [id]);

        // 4. Diccionario traductor (BD -> JSON)
        // Convierte los nombres limpios de la base de datos a las llaves correspondientes del Component Factory
        const mapeoTerminales = {
            'positivo': 'pos',
            'negativo': 'neg',
            'pin 1': 'n1',
            'pin 2': 'n2',
            'base': 'base',
            'colector': 'colector',
            'emisor': 'emisor',
            'in': 'in',
            'out': 'out',
            'gnd': 'gnd' 
        };

        const netlist = [];

        // 5. Construir cada objeto componente del JSON
        for (let inst of instancias) {
            
            // A. Filtrar y armar el objeto "nodes" para esta instancia específica
            const nodosInstancia = nodos.filter(n => n.instancia_componente_id === inst.instancia_id);
            const nodesObj = {};
            
            nodosInstancia.forEach(n => {
                const terminal = n.pin_terminal.toLowerCase();
                // Si está en el diccionario usa el alias corto, si no, quita los espacios
                const llaveNetlist = mapeoTerminales[terminal] || terminal.replace(/\s+/g, '');
                nodesObj[llaveNetlist] = String(n.numero_nodo); 
            });

            // console.log(`Procesando componente ${inst.designador} (${inst.tipo}) con nodos:`, nodesObj);

            // B. Obtener parámetros físicos consultando la tabla hija correspondiente
            let params = {};
            let tablaHija = obtenerNombreTablaHija(inst.tipo);

            if (tablaHija) {
                const [parametrosHija] = await pool.query(`SELECT * FROM ${tablaHija} WHERE componente_id = ?`, [inst.componente_id]);
                if (parametrosHija.length > 0) {
                    params = { ...parametrosHija[0] };
                    // Limpiar los IDs internos de la BD porque el Front End no los necesita
                    delete params.id;
                    delete params.componente_id;
                }
            }

            // C. Reglas inyectadas para las fuentes de voltaje y corriente
            if (inst.tipo.toLowerCase().includes('fuente')) {
                params.phase = 0; 
                params.dcOrAc = 'dc';
            }

            console.log(`Parámetros obtenidos para componente ${inst.designador} (${inst.tipo}):`, params);

            // D. Armar el empaquetado final
            netlist.push({
                id: inst.designador,        // Ej. "R1", "V1"
                type: obtenerNombreTablaHija(inst.tipo) || inst.tipo.toLowerCase().replace(/\s+/g, '_'), // Ej. "Fuente de Voltaje" -> "Fuente_voltaje"
                value: inst.valor, // Valor o modelo del componente
                nodes: nodesObj,
                position: { x: inst.posicion_x, y: inst.posicion_y }, // Estas son las posiciones del componente, NO de los nodos
                rotation: inst.rotacion,
                params: params
            });
        }

        //console.log(`Comprobar netlist final construida para circuito ${circuito.nombre}:`, netlist);

        // 6. Lanzar la netlist al Frontend
        res.status(200).json({
            exito: true,
            data: {
                circuito: {
                    id: circuito.id,
                    nombreCircuito: circuito.nombre,
                    descripcion: circuito.descripcion,
                    dificultad: circuito.dificultad,
                    tema: circuito.tema,
                    unidad_tematica: circuito.unidad_tematica,
                    materia: circuito.materia
                },
                netlist: netlist
            }
        });

    } catch (error) {
        console.error('Error al armar el circuito:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno al generar el JSON del circuito.' });
    }
};

module.exports = {
    obtenerCircuitoCompleto
};