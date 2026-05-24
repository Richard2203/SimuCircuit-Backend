require("dotenv").config();
const admin = require("../config/firebase");

const PRIMER_ADMIN = {
  email: "",
  password: "",
  displayName: "",
};

async function crearPrimerAdmin() {
  console.log("Iniciando creación del primer administrador...\n");

  // Verificar que las variables de entorno esten configuradas
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("❌ Error: Faltan variables de entorno en .env");
    console.error("   Asegúrate de tener FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY");
    process.exit(1);
  }

  try {
    // Verificar si el usuario ya existe
    try {
      const usuarioExistente = await admin.auth().getUserByEmail(PRIMER_ADMIN.email);
      console.log(`El usuario ${PRIMER_ADMIN.email} ya existe (uid: ${usuarioExistente.uid})`);

      // Si existe pero no tiene claim admin, se lo asignamos
      if (!usuarioExistente.customClaims?.admin) {
        await admin.auth().setCustomUserClaims(usuarioExistente.uid, { admin: true });
        console.log("✅ Claim { admin: true } asignado al usuario existente.");
      } else {
        console.log("✅ El usuario ya tiene el claim de admin. No se requiere ningún cambio.");
      }

      process.exit(0);
    } catch (e) {
      // Si el error es "user not found", continuamos con la creacion
      if (e.code !== "auth/user-not-found") throw e;
    }

    // Crear el usuario en Firebase Auth
    console.log(`📧 Creando usuario: ${PRIMER_ADMIN.email}`);
    const userRecord = await admin.auth().createUser({
      email: PRIMER_ADMIN.email,
      password: PRIMER_ADMIN.password,
      displayName: PRIMER_ADMIN.displayName,
      emailVerified: true, // Lo marcamos como verificado directamente
    });

    console.log(`✅ Usuario creado con UID: ${userRecord.uid}`);

    // Asignar custom claim { admin: true }
    console.log("Asignando claim { admin: true }...");
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    console.log("\n────────────────────────────────────────────");
    console.log("Primer administrador creado exitosamente");
    console.log("────────────────────────────────────────────");
    console.log(`   UID:    ${userRecord.uid}`);
    console.log(`   Email:  ${PRIMER_ADMIN.email}`);
    console.log(`   Nombre: ${PRIMER_ADMIN.displayName}`);
    console.log(`   Claim:  { admin: true }`);
    console.log("────────────────────────────────────────────");
    console.log("\nGuarda estas credenciales en un lugar seguro.");
    console.log("Cambia la contraseña después del primer login.\n");

    process.exit(0);
  } catch (error) {
    const mensajes = {
      "auth/email-already-exists": "El correo ya está registrado en Firebase.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    };

    console.error("\nError al crear el admin:");
    console.error("  ", mensajes[error.code] || error.message);
    process.exit(1);
  }
}

crearPrimerAdmin();