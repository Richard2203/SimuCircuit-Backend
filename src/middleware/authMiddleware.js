const admin = require("../config/firebase");

/**
 * Middleware: verifica que el request tenga un Firebase ID Token valido.
 * El cliente debe enviar: Authorization: Bearer <idToken>
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "Token no proporcionado. Usa Authorization: Bearer <token>",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    // Firebase Admin verifica firma, expiracion y revocacion
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // uid, email, custom claims, etc.
    next();
  } catch (error) {
    const mensajes = {
      "auth/id-token-expired": "Token expirado. Vuelve a iniciar sesión.",
      "auth/id-token-revoked": "Token revocado. Vuelve a iniciar sesión.",
      "auth/argument-error": "Token inválido o malformado.",
    };

    return res.status(401).json({
      ok: false,
      error: mensajes[error.code] || "Token inválido.",
    });
  }
};

/**
 * Middleware: verifica que el usuario tenga el custom claim { admin: true }
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user?.admin) {
    return res.status(403).json({
      ok: false,
      error: "Acceso denegado. Se requieren permisos de administrador.",
    });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin };