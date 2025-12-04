import express from "express";
import { getPool, mssql } from "../db.js";

const router = express.Router();

// --- RUTA 1: BÚSQUEDA GENERAL (Usuarios y Documentos) ---
router.get("/busqueda", async (req, res) => {
  const { usuario, estado, documento } = req.query;

  let query = `
    SELECT 
      u.id_usuario, 
      u.nombre, 
      u.apellido, 
      u.correo, 
      u.estado,  
      a.id_anexo, 
      d.id_documento, 
      d.nombre_archivo, 
      d.fecha_subida
    FROM Usuario u
    LEFT JOIN Anexo a ON a.id_usuario = u.id_usuario
    LEFT JOIN Documento d ON d.id_anexo = a.id_anexo
    WHERE 1=1
  `;

  // Filtros dinámicos
  if (usuario && usuario.trim() !== '') {
    query += ` AND (u.nombre LIKE '%${usuario}%' OR u.apellido LIKE '%${usuario}%')`;
  }
  if (estado && estado.trim() !== '') {
    query += ` AND u.estado = '${estado}'`;
  }
  if (documento && documento.trim() !== '') {
    query += ` AND d.nombre_archivo LIKE '%${documento}%'`;
  }

  try {
    const pool = await getPool();
    const result = await pool.request().query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "No se encontraron resultados" });
    }

    return res.json(result.recordset);
  } catch (error) {
    console.error("Error en búsqueda:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
});

// --- RUTA 2: HISTORIAL DE ACCESOS (NUEVO) ---
// Esta ruta lee lo que auth.js escribió en la tabla Log_acceso
router.get("/historial/:id_usuario", async (req, res) => {
  const { id_usuario } = req.params;

  try {
    const pool = await getPool();
    
    // Consultamos la tabla compartida Log_acceso
    const result = await pool.request()
      .input('id', mssql.Int, id_usuario)
      .query(`
        SELECT TOP 50 
            fecha, 
            ip_origen, 
            resultado, 
            razon 
        FROM Log_acceso 
        WHERE id_usuario = @id
        ORDER BY fecha DESC
      `);

    // Devolvemos el array de logs (puede estar vacío si es nuevo)
    res.json(result.recordset);

  } catch (error) {
    console.error("Error obteniendo historial:", error);
    res.status(500).json({ message: "Error al cargar historial" });
  }
});

export default router;