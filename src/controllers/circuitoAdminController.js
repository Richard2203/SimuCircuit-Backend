let circuitos = [];
let nextId = 1;

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
  console.log("Intentando eliminar circuito con ID: ", req.params.id);
};

module.exports = { crearCircuito, modificarCircuito, eliminarCircuito };