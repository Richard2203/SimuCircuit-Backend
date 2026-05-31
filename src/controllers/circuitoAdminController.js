let circuitos = [];
let nextId = 1;
const db = require('../config/db');

/**
 * POST /admin/crearCircuito
 * Requiere: verifyToken + verifyAdmin
 */
// Tipos que requieren registro en tabla de detalles
const TIPOS_CON_DETALLE = new Set([
    'resistencia', 'capacitor', 'bobina',
    'fuente_voltaje', 'fuente_corriente', 'diodo'
]);

// Tipos que llegan con componente_id existente (no se crea componente nuevo)
const TIPOS_PREEXISTENTES = new Set([
    'diodo', 'regulador_voltaje', 'transistor_bjt', 'transistor_fet'
]);

const DICCIONARIO_TIPOS = {
    resistencia: 'Resistencia',
    resistencia_variable: 'Resistencia Variable',
    capacitor: 'Capacitor',
    bobina: 'Bobina',
    diodo: 'Diodo',
    transistor_bjt: 'Transistor BJT',
    transistor_fet: 'Transistor FET',
    regulador_voltaje: 'Regulador de Voltaje',
    vreg: 'Regulador de Voltaje',
    fuente_voltaje: 'Fuente de Voltaje',
    fuente_corriente: 'Fuente de Corriente'
};

const insertarDetalle = async (conn, tipo, componenteId, detalles) => {
    switch (tipo) {
        case 'resistencia':
            await conn.query(
                `INSERT INTO resistencia
                    (banda_uno, banda_dos, banda_tres, banda_tolerancia,
                     potencia_nominal, componente_id, isResistenciaVariable)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    detalles.banda_uno, detalles.banda_dos,
                    detalles.banda_tres, detalles.banda_tolerancia,
                    detalles.potencia_nominal, componenteId,
                    detalles.isResistenciaVariable ?? 0
                ]
            );
            break;

        case 'capacitor':
            await conn.query(
                `INSERT INTO capacitor
                    (tipo_dioelectrico, voltaje, polaridad, componente_id)
                 VALUES (?, ?, ?, ?)`,
                [
                    detalles.tipo_dioelectrico, detalles.voltaje,
                    detalles.polaridad ?? null, componenteId
                ]
            );
            break;

        case 'bobina':
            await conn.query(
                `INSERT INTO bobina
                    (corriente_max, resistencia_dc, componente_id)
                 VALUES (?, ?, ?)`,
                [detalles.corriente_max, detalles.resistencia_dc, componenteId]
            );
            break;

        case 'fuente_voltaje':
            await conn.query(
                `INSERT INTO fuente_voltaje
                    (tipo_senial, frecuencia, fase, activo, corriente_max, componente_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    detalles.tipo_senial ?? 'DC', detalles.frecuencia ?? 0,
                    detalles.fase ?? 0, detalles.activo ?? null,
                    detalles.corriente_max, componenteId
                ]
            );
            break;

        case 'fuente_corriente':
            await conn.query(
                `INSERT INTO fuente_corriente
                    (tipo_senial, frecuencia, fase, activo, voltaje_max, componente_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    detalles.tipo_senial ?? 'DC', detalles.frecuencia ?? 0,
                    detalles.fase ?? 0, detalles.activo ?? 0,
                    detalles.voltaje_max, componenteId
                ]
            );
            break;

        default:
            // Tipos sin tabla de detalles propia (transistores, reguladores, etc.)
            break;
    }
};


const crearCircuito = async (req, res) => {
    const { circuito, componentes, nodos } = req.body;

    // Validación minima de presencia de campos
    if (!circuito?.nombre || !circuito?.tema || !circuito?.unidad_tematica || !circuito?.materia) {
        return res.status(400).json({ ok: false, error: "Faltan campos obligatorios del circuito." });
    }
    if (!Array.isArray(componentes) || componentes.length === 0) {
        return res.status(400).json({ ok: false, error: "Se requiere al menos un componente." });
    }
    if (!Array.isArray(nodos)) {
        return res.status(400).json({ ok: false, error: "El campo nodos debe ser un arreglo." });
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Insertar circuito
        const [resCircuito] = await conn.query(
            `INSERT INTO circuito
                (nombre, descripcion, miniatura_svg, activo,
                 dificultad, tema, unidad_tematica, materia, tipo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                circuito.nombre,
                circuito.descripcion ?? null,
                circuito.miniatura_svg ?? null,
                circuito.activo ?? 0,
                circuito.dificultad ?? 'Básico',
                circuito.tema,
                circuito.unidad_tematica,
                circuito.materia,
                circuito.tipo ?? 'Serie'
            ]
        );
        const circuitoId = resCircuito.insertId;

        // 2. Categorias del circuito
        if (Array.isArray(circuito.categorias) && circuito.categorias.length > 0) {
            const valoresCategorias = circuito.categorias.map(catId => [circuitoId, catId]);
            await conn.query(
                `INSERT INTO circuito_categoria (circuito_id, categoria_id) VALUES ?`,
                [valoresCategorias]
            );
        }

        // 3. Componentes e instancias
        // Mapa designador -> instancia_componente_id (para resolver nodos despues)
        const mapaDesignador = {};

        for (const comp of componentes) {
            let componenteId;

            if (TIPOS_PREEXISTENTES.has(comp.tipo)) {
                // Componente ya existe en BD, usar su ID directamente
                if (!comp.componente_id) {
                    throw new Error(`El componente preexistente '${comp.designador}' no tiene componente_id.`);
                }
                componenteId = comp.componente_id;

            } else {
                // Formateamos el nombre solo para guardarlo en la tabla base
                const tipoFormateado = DICCIONARIO_TIPOS[comp.tipo] || comp.tipo;

                // Crear registro en componente
                const [resComp] = await conn.query(
                    `INSERT INTO componente
                        (nombre, tipo, valor, unidad_medida_id, componente_grafico_id)
                     VALUES (?, ?, ?, ?, ?)`,
                    [comp.nombre, tipoFormateado, comp.valor, comp.unidad_medida_id ?? null, 1]
                );
                componenteId = resComp.insertId;

                // Insertar detalles si el tipo los requiere
                if (TIPOS_CON_DETALLE.has(comp.tipo) && comp.detalles) {
                    await insertarDetalle(conn, comp.tipo, componenteId, comp.detalles);
                }
            }

            // Crear instancia_componente
            const [resInstancia] = await conn.query(
                `INSERT INTO instancia_componente
                    (circuito_id, componente_id, designador, posicion_x, posicion_y, rotacion)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    circuitoId, componenteId,
                    comp.designador, comp.posicion_x, comp.posicion_y,
                    comp.rotacion ?? 0
                ]
            );

            mapaDesignador[comp.designador] = resInstancia.insertId;
        }

        // 4. Nodos
        if (nodos.length > 0) {
            for (const nodo of nodos) {
                const instanciaId = mapaDesignador[nodo.designador];
                if (!instanciaId) {
                    throw new Error(`El nodo referencia un designador inexistente: '${nodo.designador}'.`);
                }

                await conn.query(
                    `INSERT INTO nodo
                        (numero_nodo, circuito_id, instancia_componente_id,
                         pin_terminal, posicion_x, posicion_y)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        nodo.numero_nodo ?? null, circuitoId, instanciaId,
                        nodo.pin_terminal ?? null, nodo.posicion_x, nodo.posicion_y
                    ]
                );
            }
        }

        await conn.commit();
        return res.status(201).json({
            ok: true,
            mensaje: "Circuito creado con éxito.",
            circuito_id: circuitoId
        });

    } catch (error) {
        if (conn) await conn.rollback();
        console.error("Error al crear el circuito:", error);

        // Distinguir errores de validacion interna vs errores de BD
        const esErrorDeNegocio = error.message.includes("designador") ||
                                 error.message.includes("componente_id");
        return res.status(esErrorDeNegocio ? 400 : 500).json({
            ok: false,
            error: esErrorDeNegocio ? error.message : "Error interno del servidor."
        });

    } finally {
        if (conn) conn.release();
    }
};

// ----------------------------------------------------------------------------------------// ----------------------------------------------------------------------------------------

/**
 * PUT /admin/modificarCircuito/:id
 * Requiere: verifyToken + verifyAdmin
 */
const modificarCircuito = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    const { circuito, componentes, nodos } = req.body;

    if (!circuito?.nombre || !circuito?.tema || !circuito?.unidad_tematica || !circuito?.materia) {
        return res.status(400).json({ ok: false, error: "Faltan campos obligatorios del circuito." });
    }
    if (!Array.isArray(componentes) || componentes.length === 0) {
        return res.status(400).json({ ok: false, error: "Se requiere al menos un componente." });
    }
    if (!Array.isArray(nodos)) {
        return res.status(400).json({ ok: false, error: "El campo nodos debe ser un arreglo." });
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        // 1. Verificar que el circuito exista
        const [[circuitoExistente]] = await conn.query(
            `SELECT id FROM circuito WHERE id = ?`, [id]
        );
        if (!circuitoExistente) {
            await conn.rollback();
            return res.status(404).json({ ok: false, error: "El circuito no existe." });
        }

        // 2. Actualizar datos del circuito
        await conn.query(
            `UPDATE circuito
             SET nombre = ?, descripcion = ?, miniatura_svg = ?, activo = ?,
                 dificultad = ?, tema = ?, unidad_tematica = ?, materia = ?, tipo = ?
             WHERE id = ?`,
            [
                circuito.nombre,
                circuito.descripcion ?? null,
                circuito.miniatura_svg ?? null,
                circuito.activo ?? 0,
                circuito.dificultad ?? 'Básico',
                circuito.tema,
                circuito.unidad_tematica,
                circuito.materia,
                circuito.tipo ?? 'Serie',
                id
            ]
        );

        // 3. Categorias: reemplazo total
        await conn.query(`DELETE FROM circuito_categoria WHERE circuito_id = ?`, [id]);
        if (Array.isArray(circuito.categorias) && circuito.categorias.length > 0) {
            const valoresCategorias = circuito.categorias.map(catId => [id, catId]);
            await conn.query(
                `INSERT INTO circuito_categoria (circuito_id, categoria_id) VALUES ?`,
                [valoresCategorias]
            );
        }

        // 4. Diff de instancias
        // Obtener designadores actualmente en BD para este circuito
        const [instanciasEnBD] = await conn.query(
            `SELECT id, designador FROM instancia_componente WHERE circuito_id = ?`, [id]
        );
        const mapaEnBD = {};
        for (const inst of instanciasEnBD) {
            mapaEnBD[inst.designador] = inst.id;
        }

        const designadoresEntrantes = new Set(componentes.map(c => c.designador));

        // Designadores que ya no llegan -> eliminar instancia y sus nodos (CASCADE los nodos)
        const designadoresAEliminar = Object.keys(mapaEnBD).filter(
            d => !designadoresEntrantes.has(d)
        );
        if (designadoresAEliminar.length > 0) {
            const idsAEliminar = designadoresAEliminar.map(d => mapaEnBD[d]);
            await conn.query(
                `DELETE FROM instancia_componente WHERE id IN (?)`, [idsAEliminar]
            );
        }

        // 5. Procesar cada componente entrante
        const mapaDesignador = {}; // designador -> instancia_componente_id (para nodos)

        for (const comp of componentes) {
            const instanciaExistenteId = mapaEnBD[comp.designador]; // undefined si es nuevo

            if (instanciaExistenteId) {
                //  Componente existente: actualizar
                const [[instancia]] = await conn.query(
                    `SELECT componente_id FROM instancia_componente WHERE id = ?`,
                    [instanciaExistenteId]
                );
                const componenteId = instancia.componente_id;

                if (!TIPOS_PREEXISTENTES.has(comp.tipo)) {
                    // Formateamos para actualizar
                    const tipoFormateado = DICCIONARIO_TIPOS[comp.tipo] || comp.tipo;

                    // Actualizar tabla componente
                    await conn.query(
                        `UPDATE componente
                         SET nombre = ?, tipo = ?, valor = ?, unidad_medida_id = ?
                         WHERE id = ?`,
                        [comp.nombre, tipoFormateado, comp.valor, comp.unidad_medida_id ?? null, componenteId]
                    );

                    // Actualizar tabla de detalles si aplica
                    if (TIPOS_CON_DETALLE.has(comp.tipo) && comp.detalles) {
                        await actualizarDetalle(conn, comp.tipo, componenteId, comp.detalles);
                    }
                }

                // Actualizar posicion/rotacion en instancia_componente
                await conn.query(
                    `UPDATE instancia_componente
                     SET posicion_x = ?, posicion_y = ?, rotacion = ?
                     WHERE id = ?`,
                    [comp.posicion_x, comp.posicion_y, comp.rotacion ?? 0, instanciaExistenteId]
                );

                mapaDesignador[comp.designador] = instanciaExistenteId;

            } else {
                // Componente nuevo: insertar (mismo flujo que crearCircuito)
                let componenteId;

                if (TIPOS_PREEXISTENTES.has(comp.tipo)) {
                    if (!comp.componente_id) {
                        throw new Error(`El componente preexistente '${comp.designador}' no tiene componente_id.`);
                    }
                    componenteId = comp.componente_id;
                } else {
                    // Formateamos para insertar
                    const tipoFormateado = DICCIONARIO_TIPOS[comp.tipo] || comp.tipo;

                    const [resComp] = await conn.query(
                        `INSERT INTO componente
                            (nombre, tipo, valor, unidad_medida_id, componente_grafico_id)
                         VALUES (?, ?, ?, ?, 0)`,
                        [comp.nombre, tipoFormateado, comp.valor, comp.unidad_medida_id ?? null, 1]
                    );
                    componenteId = resComp.insertId;

                    if (TIPOS_CON_DETALLE.has(comp.tipo) && comp.detalles) {
                        await insertarDetalle(conn, comp.tipo, componenteId, comp.detalles);
                    }
                }

                const [resInstancia] = await conn.query(
                    `INSERT INTO instancia_componente
                        (circuito_id, componente_id, designador, posicion_x, posicion_y, rotacion)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [id, componenteId, comp.designador, comp.posicion_x, comp.posicion_y, comp.rotacion ?? 0]
                );

                mapaDesignador[comp.designador] = resInstancia.insertId;
            }
        }

        // 6. Nodos: reemplazo total (mas simple y seguro que hacer diff de nodos)
        await conn.query(`DELETE FROM nodo WHERE circuito_id = ?`, [id]);
        for (const nodo of nodos) {
            const instanciaId = mapaDesignador[nodo.designador];
            if (!instanciaId) {
                throw new Error(`El nodo referencia un designador inexistente: '${nodo.designador}'.`);
            }
            await conn.query(
                `INSERT INTO nodo
                    (numero_nodo, circuito_id, instancia_componente_id,
                     pin_terminal, posicion_x, posicion_y)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    nodo.numero_nodo ?? null, id, instanciaId,
                    nodo.pin_terminal ?? null, nodo.posicion_x, nodo.posicion_y
                ]
            );
        }

        await conn.commit();
        return res.status(200).json({
            ok: true,
            mensaje: "Circuito actualizado con éxito.",
            circuito_id: id
        });

    } catch (error) {
        if (conn) await conn.rollback();
        console.error("Error al modificar el circuito:", error);

        const esErrorDeNegocio = error.message.includes("designador") ||
                                 error.message.includes("componente_id");
        return res.status(esErrorDeNegocio ? 400 : 500).json({
            ok: false,
            error: esErrorDeNegocio ? error.message : "Error interno del servidor."
        });

    } finally {
        if (conn) conn.release();
    }
};


const actualizarDetalle = async (conn, tipo, componenteId, detalles) => {
    switch (tipo) {
        case 'resistencia':
            await conn.query(
                `UPDATE resistencia
                 SET banda_uno = ?, banda_dos = ?, banda_tres = ?, banda_tolerancia = ?,
                     potencia_nominal = ?, isResistenciaVariable = ?
                 WHERE componente_id = ?`,
                [
                    detalles.banda_uno, detalles.banda_dos,
                    detalles.banda_tres, detalles.banda_tolerancia,
                    detalles.potencia_nominal, detalles.isResistenciaVariable ?? 0,
                    componenteId
                ]
            );
            break;

        case 'capacitor':
            await conn.query(
                `UPDATE capacitor
                 SET tipo_dioelectrico = ?, voltaje = ?, polaridad = ?
                 WHERE componente_id = ?`,
                [detalles.tipo_dioelectrico, detalles.voltaje, detalles.polaridad ?? null, componenteId]
            );
            break;

        case 'bobina':
            await conn.query(
                `UPDATE bobina
                 SET corriente_max = ?, resistencia_dc = ?
                 WHERE componente_id = ?`,
                [detalles.corriente_max, detalles.resistencia_dc, componenteId]
            );
            break;

        case 'fuente_voltaje':
            await conn.query(
                `UPDATE fuente_voltaje
                 SET tipo_senial = ?, frecuencia = ?, fase = ?, activo = ?, corriente_max = ?
                 WHERE componente_id = ?`,
                [
                    detalles.tipo_senial ?? 'DC', detalles.frecuencia ?? 0,
                    detalles.fase ?? 0, detalles.activo ?? null,
                    detalles.corriente_max, componenteId
                ]
            );
            break;

        case 'fuente_corriente':
            await conn.query(
                `UPDATE fuente_corriente
                 SET tipo_senial = ?, frecuencia = ?, fase = ?, activo = ?, voltaje_max = ?
                 WHERE componente_id = ?`,
                [
                    detalles.tipo_senial ?? 'DC', detalles.frecuencia ?? 0,
                    detalles.fase ?? 0, detalles.activo ?? 0,
                    detalles.voltaje_max, componenteId
                ]
            );
            break;

        default:
            break;
    }
};

const eliminarCircuito = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "ID inválido." });
    }

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        await conn.query('DELETE FROM instancia_componente WHERE circuito_id = ?', [id]);
        await conn.query('DELETE FROM nodo WHERE circuito_id = ?', [id]);

        const [resultado] = await conn.query('DELETE FROM circuito WHERE id = ?', [id]);

        if (resultado.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ ok: false, error: "El circuito no existe." });
        }

        await conn.commit();
        return res.status(200).json({
            ok: true,
            mensaje: "Circuito y dependencias eliminados con éxito."
        });

    } catch (error) {
        if (conn) await conn.rollback();
        console.error("Error al eliminar el circuito:", error);
        return res.status(500).json({ ok: false, error: "Error interno del servidor." });
    } finally {
        if (conn) conn.release();
    }
};

// ----------------------------------------------------------------------------------------
// INFORMACION CIRCUITOS
const listarCircuitos = async (req, res) => {
  try {
    const query = 'SELECT id, dificultad, miniatura_svg, nombre, descripcion FROM circuito;';
    
    const [rows ] = await db.query(query); 
    
    if(!rows || rows.length === 0) {
      return res.status(404).json({
        ok: false,
        msg: 'No se encontraron circuitos'
      });
    }

    return res.status(200).json({
      ok: true,
      data: rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      msg: 'Error al obtener la lista de circuitos'
    });
  }
}

const listarComponentes = async (req, res) => {
  try {
    // 1. Desestructuramos el primer elemento (las filas) de cada consulta de MySQL usando [ ]
    const [
      [diodos], 
      [reguladores], 
      [bjts], 
      [fets], 
      [categorias], 
      [unidades]
    ] = await Promise.all([
      db.query('SELECT d.*, c.nombre as componente_nombre FROM diodo d JOIN componente c ON d.componente_id = c.id'),
      db.query('SELECT r.*, c.nombre as componente_nombre FROM regulador_voltaje r JOIN componente c ON r.componente_id = c.id'),
      db.query('SELECT b.*, c.nombre as componente_nombre FROM transistor_bjt b JOIN componente c ON b.componente_id = c.id'),
      db.query('SELECT f.*, c.nombre as componente_nombre FROM transistor_fet f JOIN componente c ON f.componente_id = c.id'),
      db.query('SELECT * FROM categoria'),
      db.query('SELECT * FROM unidad_medida')
    ]);

    // 2. Ahora todas las variables son arrays puros de JavaScript con tus registros limpios
    const respuesta = {
      ok: true,
      total_categorias: categorias.length,
      catalogos: {
        categorias: categorias,
        unidades_medida: unidades
      },
      componentes: {
        semiconductores: {
          diodos: diodos,
          transistores_bjt: bjts,
          transistores_fet: fets
        },
        reguladores_voltaje: reguladores,
        fuentes: {
          fuente_corriente: [
            { tipo_senial: 'DC' },
            { tipo_senial: 'AC_SENOIDAL' }
          ],
          fuente_voltaje: [
            { tipo_senial: 'DC' },
            { tipo_senial: 'AC_SENOIDAL' }
          ]
        },
        unidad_tematica: [ 
          { nombre: '1. Fundamentos de Circuitos Eléctricos' },
          { nombre: '2. Análisis de Circuitos en Corriente Directa' },
          { nombre: '3. Análisis del Circuito en el Dominio de la Frecuencia' },
          { nombre: '1. Dispositivos Semiconductores' }
        ]
      }
    };

    return res.status(200).json(respuesta);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      msg: 'Error al obtener el inventario global de componentes'
    });
  }
};

module.exports = { crearCircuito, modificarCircuito, eliminarCircuito, listarCircuitos, listarComponentes };