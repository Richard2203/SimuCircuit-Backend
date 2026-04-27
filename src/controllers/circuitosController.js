const pool = require('../config/db');


// Funcion auxiliar para saber que tabla hija consultar segun el tipo de componente 
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

const obtenerFiltrosDisponibles = async (req, res) => {
    try {
        // 1. Consultar Temas (Categorias) dinamicamente
        const [categoriasRows] = await pool.query(
            'SELECT nombre FROM categoria ORDER BY nombre ASC'
        );

        // 2. Consultar Componentes dinamicamente
        const [componentesRows] = await pool.query(
            'SELECT DISTINCT tipo FROM componente WHERE tipo IS NOT NULL AND tipo <> \'\' ORDER BY tipo ASC'
        );

        // 3. Definir los catalogos fijos
        const dificultadesFijas = ['Basico', 'Intermedio', 'Avanzado'];
        const materiasFijas = ['Circuitos Electricos', 'Electronica Analogica'];

        // 4. Formateo de respuesta
        res.status(200).json({
            exito: true,
            data: {
                temas: categoriasRows.map(row => row.nombre),
                componentes: componentesRows.map(row => row.tipo),
                dificultades: dificultadesFijas,
                materias: materiasFijas
            }
        });

    } catch (error) {
        console.error('Error al obtener los filtros:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener los catalogos de filtros.' });
    }
};

const obtenerResumenCircuitos = async (req, res) => {
    try {
        // 1. Recibimos los filtros de la UI desde req.query
        const { nombreBusqueda, dificultad, materia, tema, componentes } = req.query;

        // 2. Query base no requiere parametros de busqueda
        let baseQuery = `
            SELECT 
                c.id, 
                c.nombre, 
                c.descripcion, 
                c.dificultad,
                c.unidad_tematica, 
                c.materia,
                c.miniatura_svg,
                (
                    SELECT GROUP_CONCAT(cat.nombre SEPARATOR ', ')
                    FROM circuito_categoria cc
                    JOIN categoria cat ON cc.categoria_id = cat.id
                    WHERE cc.circuito_id = c.id
                ) AS categorias
            FROM circuito c
            WHERE c.activo = TRUE
        `;

        const queryParams = [];

        // 3. Construccion dinamica de filtros
        if (nombreBusqueda) {
            baseQuery += ` AND c.nombre LIKE ?`;
            queryParams.push(`%${nombreBusqueda}%`);
        }

        if (dificultad && dificultad !== 'Todos') {
            baseQuery += ` AND c.dificultad = ?`;
            queryParams.push(dificultad);
        }

        if (materia && materia !== 'Todos') {
            baseQuery += ` AND c.materia = ?`;
            queryParams.push(materia);
        }

        if (tema && tema !== 'Todos') {
            baseQuery += ` AND EXISTS (
                SELECT 1 FROM circuito_categoria cc2
                JOIN categoria cat2 ON cc2.categoria_id = cat2.id
                WHERE cc2.circuito_id = c.id AND cat2.nombre = ?
            )`;
            queryParams.push(tema);
        }

        const compArray = componentes ? [].concat(componentes) : [];
        
        // Filtro por checkboxes de componentes
        if (compArray.length > 0) {
            const placeholders = compArray.map(() => '?').join(',');
            baseQuery += ` AND EXISTS (
                SELECT 1 FROM instancia_componente ic
                JOIN componente comp ON ic.componente_id = comp.id
                WHERE ic.circuito_id = c.id AND comp.tipo IN (${placeholders})
            )`;
            queryParams.push(...compArray);
        }

        baseQuery += ` ORDER BY c.id ASC`;

        const [circuitos] = await pool.query(baseQuery, queryParams);

        const circuitosFormateados = circuitos.map(c => ({
            ...c,
            categorias: c.categorias ? c.categorias.split(', ') : []
        }));

        res.status(200).json({
            exito: true,
            data: circuitosFormateados
        });

    } catch (error) {
        console.error('Error al obtener el catalogo de circuitos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener el catalogo de circuitos.' });
    }
};

const obtenerCircuitoCompleto = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtencion de metadatos del circuito
        const [circuitoRows] = await pool.query('SELECT * FROM circuito WHERE id = ?', [id]);
        
        if (circuitoRows.length === 0) {
            return res.status(404).json({ 
                exito: false, 
                mensaje: 'Circuito no encontrado en la base de datos.' 
            });
        }
        const circuito = circuitoRows[0];

        // 2. Obtencion de instancias de componentes para este circuito.
        const [instancias] = await pool.query(`
            SELECT ic.id AS 'instancia_id', ic.designador, ic.posicion_x, ic.posicion_y, ic.rotacion,
                   c.id AS 'componente_id', c.nombre, c.tipo, c.valor
            FROM instancia_componente ic
            JOIN componente c ON ic.componente_id = c.id
            WHERE ic.circuito_id = ?
        `, [id]);

        // 3. Obtencion de nodos de conexion
        const [nodos] = await pool.query(`
            SELECT numero_nodo, instancia_componente_id, pin_terminal, posicion_x, posicion_y
            FROM nodo
            WHERE circuito_id = ?
        `, [id]);

        // 4. Diccionario traductor (BD -> JSON)
        const mapeoTerminales = {
            'positivo': 'pos', // Fuentes de corriente y Voltaje
            'negativo': 'neg',
            'pin 1': 'n1', // Resistencias, Capacitores, Bobinas y Diodos
            'pin 2': 'n2',
            'base': 'nB', // Transistores BJT
            'colector': 'nC',
            'emisor': 'nE',
            'gate': 'nG', // Transistores FET
            'drain': 'nD',
            'source': 'nS',
            'in': 'nIn', // Reguladores de Voltaje
            'out': 'nOut',
            'gnd': 'nGnd' 
        };

        const netlist = [];

        // 5. Construir cada objeto componente del JSON
        for (let inst of instancias) {
            
            const nodosInstancia = nodos.filter(n => n.instancia_componente_id === inst.instancia_id);
            const nodesObj = {};
            
            nodosInstancia.forEach(n => {
                const terminal = n.pin_terminal.toLowerCase();
                const llaveNetlist = mapeoTerminales[terminal] || terminal.replace(/\s+/g, '');
                nodesObj[llaveNetlist] = {
                    nodo: String(n.numero_nodo),
                    x: parseFloat(n.posicion_x),
                    y: parseFloat(n.posicion_y)
                };
            });

            
            let params = {};
            let tablaHija = obtenerNombreTablaHija(inst.tipo);

            console.log(`Obteniendo parametros para componente ${inst.designador} (${inst.tipo}) desde la tabla hija: ${tablaHija}`);

            if (tablaHija) {
                const [parametrosHija] = await pool.query(`SELECT * FROM ${tablaHija} WHERE componente_id = ?`, [inst.componente_id]);
                if (parametrosHija.length > 0) {
                    params = { ...parametrosHija[0] };
                    delete params.id;
                    delete params.componente_id;

                    if (tablaHija.includes('fuente'))
                    {
                        // si es DC pasa "dc", si es "AC_SENOIDAL" o "AC_CUADRADA" pasa "ac"
                        params.dcOrAc = params.tipo_senial === "DC" ? 'dc' : 'ac'; 
                        delete params.tipo_senial;

                        // Si no tiene fase, asumimos que es 0
                        params.phase = params.fase || "0"; 
                        delete params.fase;

                        // Si no tiene frecuencia, asumimos que es 0
                        params.frequency = params.frecuencia || "0"; 
                        delete params.frecuencia;
                    }
                }
            }

            console.log(`Parametros obtenidos para componente ${inst.designador} (${inst.tipo}):`, params);

            // D. Armar el empaquetado final
            netlist.push({
                id: inst.designador,      
                type: obtenerNombreTablaHija(inst.tipo) || inst.tipo.toLowerCase().replace(/\s+/g, '_'), 
                value: inst.valor,
                nodes: nodesObj,
                position: { x: inst.posicion_x, y: inst.posicion_y }, 
                rotation: inst.rotacion,
                params: params
            });
        }

        // 6. Lanzar la netlist al Frontend
        res.status(200).json({
            exito: true,
            data: {
                circuito: {
                    id: circuito.id,
                    nombre_circuito: circuito.nombre,
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
    obtenerFiltrosDisponibles,
    obtenerResumenCircuitos,
    obtenerCircuitoCompleto
};