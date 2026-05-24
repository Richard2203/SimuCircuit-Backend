const express = require("express");
const router = express.Router();

const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");
const {
  register,
  login,
  logout,
  listarAdmins,
  editarAdmin,
  eliminarAdmin,
} = require("../controllers/authController");

const {
  crearCircuito,
  modificarCircuito,
  eliminarCircuito,
  listarCircuitos,
  listarComponentes
} = require("../controllers/circuitoAdminController");

// Autenticacion (publicas)
// POST /admin/login — Verificar idToken del cliente y confirmar rol admin
router.post("/login", login);


// --------------------------------------------------------------------------------
// Autenticacion (protegidas)
// POST /admin/register — Crear nuevo admin (solo admins pueden crear admins)
router.post("/register", verifyToken, verifyAdmin, register);

// POST /admin/logout — Revocar tokens
router.post("/logout", verifyToken, logout);


// --------------------------------------------------------------------------------
// Gestion de admins
// GET    /api/admin         — Listar todos los admins
router.get("/gestion-admin", verifyToken, verifyAdmin, listarAdmins);

// PUT    /api/admin/:uid    — Editar email o nombre de un admin
router.put("/gestion-admin/:uid", verifyToken, verifyAdmin, editarAdmin);

// DELETE /api/admin/:uid   — Eliminar un admin
router.delete("/gestion-admin/:uid", verifyToken, verifyAdmin, eliminarAdmin);


// ----------------------------------------------------------------------------------
// Circuitos CRUD
// POST /admin/crearCircuito
router.post("/crearCircuito", verifyToken, verifyAdmin, crearCircuito);

// PUT  /admin/modificarCircuito/:id
router.put("/modificarCircuito/:id", verifyToken, verifyAdmin, modificarCircuito);

// DELETE /admin/eliminarCircuito/:id
router.delete("/eliminarCircuito/:id", verifyToken, verifyAdmin, eliminarCircuito);

// ----------------------------------------------------------------------------------
// Circuitos - Listado y componentes
router.get("/circuitos-lista", verifyToken, verifyAdmin, listarCircuitos);
router.get("/circuitos-lista/componentes", verifyToken, verifyAdmin, listarComponentes);

module.exports = router;