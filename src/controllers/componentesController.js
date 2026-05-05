const pool = require('../config/db');

const obtenerCatalogo = async (req, res) => {
    try {
        // Consulta SQL, uzando un JOIN básico para traer el componente y su unidad de medida
        const [rows] = await pool.query(`
            SELECT DISTINCT tipo FROM componente;
        `);
        
        res.status(200).json({
            exito: true,
            total: rows.length,
            data: rows
        });
        console.log(`Se han obtenido un total de ${rows.length} componentes exitosamente.`);
    } catch (error) {
        console.error(error);
        res.status(500).json({ exito: false, mensaje: 'Error al obtener el catálogo.' });
    }
};

module.exports = {
    obtenerCatalogo
};