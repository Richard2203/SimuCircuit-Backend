let circuitos = [];
let nextId = 1;
const db = require('../config/db');

/**
 * POST /admin/crearCircuito
 * Crea un nuevo circuito.
 * Body: { nombre, descripcion, nivel, activo }
 * Requiere: verifyToken + verifyAdmin
 */
const crearCircuito = async (req, res) => {
  const { nombre, descripcion, nivel, activo = true } = req.body;

  if (!nombre || !descripcion || !nivel) {
    return res.status(400).json({
      ok: false,
      error: "nombre, descripcion y nivel son requeridos.",
    });
  }

  try {
    const circuito = {
      id: nextId++,
      nombre,
      descripcion,
      nivel,
      activo,
      creadoPor: req.user.uid,   // uid del admin autenticado
      creadoEn: new Date().toISOString(),
      modificadoEn: null,
    };

    // TODO: reemplazar con -> await db.collection("circuitos").add(circuito)
    circuitos.push(circuito);

    return res.status(201).json({
      ok: true,
      mensaje: "Circuito creado exitosamente.",
      circuito,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Error al crear circuito." });
  }
};

/**
 * PUT /admin/modificarCircuito/:id
 * Modifica un circuito existente.
 * Body: campos a actualizar (nombre, descripcion, nivel, activo)
 * Requiere: verifyToken + verifyAdmin
 */
const modificarCircuito = async (req, res) => {
  const { id } = req.params;
  const cambios = req.body;

  if (!id) {
    return res.status(400).json({ ok: false, error: "ID de circuito requerido." });
  }

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ ok: false, error: "No se enviaron campos a modificar." });
  }

  try {
    // TODO: reemplazar con -> await db.collection("circuitos").doc(id).update(cambios)
    const index = circuitos.findIndex((c) => c.id === parseInt(id));

    if (index === -1) {
      return res.status(404).json({ ok: false, error: "Circuito no encontrado." });
    }

    circuitos[index] = {
      ...circuitos[index],
      ...cambios,
      modificadoPor: req.user.uid,
      modificadoEn: new Date().toISOString(),
    };

    return res.status(200).json({
      ok: true,
      mensaje: "Circuito actualizado exitosamente.",
      circuito: circuitos[index],
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Error al modificar circuito." });
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