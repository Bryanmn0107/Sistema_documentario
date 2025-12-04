import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, mssql } from '../db.js';

const router = express.Router();

async function registrarLog(pool, idUsuario, req, resultado, razon) {
  try {
    // Captura la IP real del usuario
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '0.0.0.0';

    await pool.request()
      .input('id_usuario', mssql.Int, idUsuario)
      .input('ip_origen', mssql.VarChar, ip)
      .input('resultado', mssql.VarChar, resultado)
      .input('razon', mssql.VarChar, razon)
      .query(`
        INSERT INTO Log_acceso (id_usuario, fecha, ip_origen, resultado, razon)
        VALUES (@id_usuario, GETDATE(), @ip_origen, @resultado, @razon)
      `);
  } catch (error) {
    console.error("Error guardando log:", error);
  }
}

// --- LOGIN PRINCIPAL ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email y contraseña son necesarios" });
  }

  try {
    const pool = await getPool();

    // 1. Buscar al usuario por correo
    const result = await pool.request()
      .input("correo", mssql.VarChar, email)
      .query(`
        SELECT TOP 1 id_usuario, nombre, apellido, correo, password_hash, id_rol, estado
        FROM Usuario
        WHERE LOWER(correo) = LOWER(@correo)
      `);

    // ESCENARIO 1: El usuario NO existe
    if (!result.recordset.length) {
      await registrarLog(pool, null, req, 'ALERTA', `Intento de acceso con correo no registrado: "${email}"`);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const user = result.recordset[0];

    // ESCENARIO 2: El usuario existe pero está INACTIVO (BLOQUEO)
    if (user.estado === 'inactivo') {
      await registrarLog(pool, user.id_usuario, req, 'BLOQUEADO', `El usuario ${user.nombre} ${user.apellido} intentó acceder pero su cuenta está INACTIVA.`);
      
      // Retornamos 403 Forbidden para indicar que no tiene permiso
      return res.status(403).json({ message: "Su cuenta está desactivada. Contacte al administrador." });
    }

    // ESCENARIO 3: Verificar contraseña (solo si está activo)
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      await registrarLog(pool, user.id_usuario, req, 'FALLIDO', `El usuario ${user.nombre} ingresó una contraseña incorrecta.`);
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // ESCENARIO 4: Acceso Exitoso
    const payload = { 
      id: user.id_usuario, 
      nombre: user.nombre, 
      correo: user.correo, 
      id_rol: user.id_rol, 
      rol: user.id_rol    
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secreto', { expiresIn: "2h" });

    await registrarLog(pool, user.id_usuario, req, 'EXITOSO', `${user.nombre} ${user.apellido} inició sesión correctamente.`);

    res.json({ token, user: payload });

  } catch (error) {
    console.error("Error en el login:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
});

export default router;