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

const obtenerFiltrosDisponibles = async (req, res) => {
    try {
        // 1. Consultar Temas (Categorías) dinámicamente
        // Obtenemos solo el nombre y los ordenamos alfabéticamente para que el Select se vea ordenado
        const [categoriasRows] = await pool.query(
            'SELECT nombre FROM categoria ORDER BY nombre ASC'
        );

        // 2. Consultar Componentes dinámicamente
        // Usamos DISTINCT para que si hay 50 resistencias, solo nos devuelva la palabra "Resistencia" una vez
        const [componentesRows] = await pool.query(
            'SELECT DISTINCT tipo FROM componente WHERE tipo IS NOT NULL AND tipo <> \'\' ORDER BY tipo ASC'
        );

        // 3. Definir los catálogos fijos
        const dificultadesFijas = ['Básico', 'Intermedio', 'Avanzado'];
        const materiasFijas = ['Circuitos Eléctricos', 'Electrónica Analógica'];

        // 4. Formatear la respuesta
        // Mapeamos los resultados de SQL (que vienen como arreglo de objetos) a arreglos simples de strings
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
        res.status(500).json({ exito: false, mensaje: 'Error al obtener los catálogos de filtros.' });
    }
};

const obtenerResumenCircuitos = async (req, res) => {
    try {
        // 1. Recibimos los filtros de la UI desde req.query
        // Notas: 'tema' en la UI corresponde a 'categoria' en la BD
        // 'unidad de aprendizaje' en la UI corresponde a 'materia' en la BD
        const { nombreBusqueda, dificultad, materia, tema, componentes } = req.query;

        // 2. Query base optimizada para que funcione con o sin parámetros de búsqueda
        
        // Usamos GROUP_CONCAT para traernos las categorías en un solo string separado por comas
        // sin tener que hacer múltiples consultas o joins pesados que dupliquen filas.
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

        // 3. Construcción dinámica de filtros (Armando el WHERE)
        
        //En caso de haberse especificado un nombre de circuito 
        if (nombreBusqueda) {
            baseQuery += ` AND c.nombre LIKE ?`;
            queryParams.push(`%${nombreBusqueda}%`);
        }

        // En caso de haberse especificado una dificultad (y que no sea "Todos", que es la opción por defecto)
        if (dificultad && dificultad !== 'Todos') {
            baseQuery += ` AND c.dificultad = ?`;
            queryParams.push(dificultad);
        }

        // En caso de haberse especificado una materia (Unidad de Aprendizaje) y que no sea "Todos"
        if (materia && materia !== 'Todos') {
            baseQuery += ` AND c.materia = ?`;
            queryParams.push(materia);
        }

        // En caso de haberse especificado un tema (Categoría) y que no sea "Todos", hacemos un filtro adicional usando EXISTS para verificar que el circuito tenga esa categoría específica
        if (tema && tema !== 'Todos') {
            baseQuery += ` AND EXISTS (
                SELECT 1 FROM circuito_categoria cc2
                JOIN categoria cat2 ON cc2.categoria_id = cat2.id
                WHERE cc2.circuito_id = c.id AND cat2.nombre = ?
            )`;
            queryParams.push(tema);
        }

        //--- Antes de siquiera revisar los componentes, verifiquemos que
        // Si componentes no viene, es un arreglo vacío. Si es un solo componente (String), lo hace arreglo. Si es un arreglo, lo dejamos igual.
        const compArray = componentes ? [].concat(componentes) : [];
        
        // Filtro por checkboxes de componentes (Si el frontend manda un arreglo de tipos)
        if (compArray.length > 0) {
            // Buscamos que el circuito tenga AL MENOS UNO de los componentes seleccionados
            const placeholders = compArray.map(() => '?').join(',');
            baseQuery += ` AND EXISTS (
                SELECT 1 FROM instancia_componente ic
                JOIN componente comp ON ic.componente_id = comp.id
                WHERE ic.circuito_id = c.id AND comp.tipo IN (${placeholders})
            )`;
            queryParams.push(...compArray);
        }

        // Ordenamos del más antiguo al nuevo, porque con esto garantizamos que los primeros circuitos son de las primeras unidades de aprendizaje que el usuario debe consultar.
        baseQuery += ` ORDER BY c.id ASC`;

        // 4. Ejecutamos la consulta
        const [circuitos] = await pool.query(baseQuery, queryParams);

        // 5. Pequeño formateo para que el frontend reciba un arreglo limpio
        const circuitosFormateados = circuitos.map(c => ({
            ...c,
            categorias: c.categorias ? c.categorias.split(', ') : []
        }));

        res.status(200).json({
            exito: true,
            data: circuitosFormateados
        });

    } catch (error) {
        console.error('Error al obtener el catálogo de circuitos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener el catálogo de circuitos.' });
    }
};

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