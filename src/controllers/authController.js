const admin = require("../config/firebase");

/**
 * POST /admin/register
 * Crea un nuevo usuario admin en Firebase Auth y le asigna custom claim { admin: true }
 * Body: { email, password, nombre }
 * Requiere: verifyToken + verifyAdmin
 */
const register = async (req, res) => {
  const { email, password, nombre } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({
      ok: false,
      error: "email, password y nombre son requeridos.",
    });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    return res.status(201).json({
      ok: true,
      mensaje: "Administrador registrado exitosamente.",
      usuario: {
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName,
      },
    });
  } catch (error) {
    const mensajes = {
      "auth/email-already-exists": "El correo ya está registrado.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    };
    return res.status(400).json({
      ok: false,
      error: mensajes[error.code] || error.message,
    });
  }
};

/**
 * POST /admin/login
 * Verifica el ID Token del cliente y confirma que tiene claim admin:true.
 * Body: { idToken }
 */
const login = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      ok: false,
      error: "idToken es requerido. Autentícate primero desde el cliente.",
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.admin) {
      return res.status(403).json({
        ok: false,
        error: "El usuario no tiene permisos de administrador.",
      });
    }

    return res.status(200).json({
      ok: true,
      mensaje: "Login exitoso.",
      usuario: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        nombre: decodedToken.name,
        admin: decodedToken.admin,
      },
    });
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Token inválido o expirado.",
    });
  }
};

/**
 * POST /admin/logout
 * Revoca todos los refresh tokens del usuario (invalida sesiones activas).
 * Requiere: verifyToken
 */
const logout = async (req, res) => {
  try {
    await admin.auth().revokeRefreshTokens(req.user.uid);
    return res.status(200).json({
      ok: true,
      mensaje: "Sesión cerrada. Todos los tokens han sido revocados.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Error al cerrar sesión.",
    });
  }
};

/**
 * GET /api/admin
 * Lista todos los usuarios con claim admin:true.
 * Requiere: verifyToken + verifyAdmin
 */
const listarAdmins = async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers(1000);
    const admins = listUsers.users
      .filter((u) => u.customClaims?.admin === true)
      .map((u) => ({
        uid: u.uid,
        email: u.email,
        nombre: u.displayName,
        creadoEn: u.metadata.creationTime,
        ultimoLogin: u.metadata.lastSignInTime,
      }));

    return res.status(200).json({ ok: true, total: admins.length, admins });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Error al listar admins." });
  }
};

/**
 * PUT /api/admin/:uid
 * Edita el email y/o nombre de un admin existente.
 * Body: { email?, nombre? }
 * Requiere: verifyToken + verifyAdmin
 */
const editarAdmin = async (req, res) => {
  const { uid } = req.params;
  const { email, nombre } = req.body;

  if (!email && !nombre) {
    return res.status(400).json({
      ok: false,
      error: "Debes enviar al menos un campo a modificar: email o nombre.",
    });
  }

  try {
    // Verificar que el usuario a editar exista y sea admin
    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.customClaims?.admin) {
      return res.status(403).json({
        ok: false,
        error: "El usuario indicado no es administrador.",
      });
    }

    const cambios = {};
    if (email)  cambios.email       = email;
    if (nombre) cambios.displayName = nombre;

    const updatedUser = await admin.auth().updateUser(uid, cambios);

    return res.status(200).json({
      ok: true,
      mensaje: "Administrador actualizado correctamente.",
      usuario: {
        uid: updatedUser.uid,
        email: updatedUser.email,
        nombre: updatedUser.displayName,
      },
    });
  } catch (error) {
    const mensajes = {
      "auth/user-not-found":       "Administrador no encontrado.",
      "auth/email-already-exists": "El correo ya está en uso por otra cuenta.",
      "auth/invalid-email":        "El correo no es válido.",
    };
    return res.status(400).json({
      ok: false,
      error: mensajes[error.code] || error.message,
    });
  }
};

/**
 * DELETE /api/admin/:uid
 * Elimina un admin de Firebase Auth.
 * Requiere: verifyToken + verifyAdmin
 */
const eliminarAdmin = async (req, res) => {
  const { uid } = req.params;

  // Evitar que un admin se elimine a si mismo
  if (uid === req.user.uid) {
    return res.status(400).json({
      ok: false,
      error: "No puedes eliminarte a ti mismo.",
    });
  }

  try {
    // Verificar que el usuario a eliminar exista y sea admin
    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.customClaims?.admin) {
      return res.status(403).json({
        ok: false,
        error: "El usuario indicado no es administrador.",
      });
    }

    // Revocar tokens antes de eliminar (cierra sus sesiones activas)
    await admin.auth().revokeRefreshTokens(uid);
    await admin.auth().deleteUser(uid);

    return res.status(200).json({
      ok: true,
      mensaje: "Administrador eliminado correctamente.",
    });
  } catch (error) {
    const mensajes = {
      "auth/user-not-found": "Administrador no encontrado.",
    };
    return res.status(400).json({
      ok: false,
      error: mensajes[error.code] || error.message,
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  listarAdmins,
  editarAdmin,
  eliminarAdmin,
};