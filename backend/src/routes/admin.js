import express from "express";
import bcrypt from "bcryptjs";
import { getPool, mssql } from "../db.js";
import validator from "validator";
import dns from "dns/promises"; // opcional para MX

const router = express.Router();

// Validación de nombre y apellido (solo letras, tildes, ñ, espacios, guion)
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s-]+$/;

// Longitud típica de DNI Perú = 8 (cámbialo si lo necesitas)
const DNI_LENGTH = 8;

// Dominios permitidos (vacío = permitir cualquiera válido)
const ALLOWED_DOMAINS = ['gmail.com', 'hotmail.com', 'empresa.com']; 

// Forzar verificación MX del dominio del email
const CHECK_MX = true;

// Password mínima 
const MIN_PASSWORD_LEN = 6;

// Estados permitidos
const ESTADOS_PERMITIDOS = ["activo", "inactivo"];

function toTitle(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Obtener roles disponibles
router.get('/usuarios', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id_usuario, nombre, apellido, correo, estado, id_rol, dni
      FROM Usuario
    `);
    res.status(200).json(result.recordset); // Asegúrate de enviar JSON aquí
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});
// Obtener roles disponibles
router.get('/roles', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id_rol, nombre_rol
      FROM Rol
    `);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener roles:", error);
    res.status(500).json({ message: 'Error al obtener roles' });
  }
});


// Acepta letras con tildes/ñ, espacios y guion medio. Rechaza números y símbolos.
async function validarEmailFuerte(correo) {
  const email = String(correo || "").trim().toLowerCase();

  // Formato
  if (!validator.isEmail(email, { require_tld: true, allow_utf8_local_part: true })) {
    return { ok: false, message: "Formato de email inválido." };
  }

  // Dominio permitido
  if (ALLOWED_DOMAINS.length > 0) {
    const domain = email.split("@")[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return { ok: false, message: `Dominio no permitido (${domain}).` };
    }
  }

  // MX del dominio
  if (CHECK_MX) {
    try {
      const domain = email.split("@")[1];
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        return { ok: false, message: "El dominio de email no tiene registros MX válidos." };
      }
    } catch {
      return { ok: false, message: "El dominio de email no es resolvible." };
    }
  }

  return { ok: true, email };
}

router.post("/usuarios", async (req, res) => {
  let { nombre, apellido, correo, password, id_rol, estado, dni } = req.body || {};

  // Normalizaciones básicas
  nombre = typeof nombre === "string" ? nombre.trim() : "";
  apellido = typeof apellido === "string" ? apellido.trim() : "";
  correo = typeof correo === "string" ? correo.trim() : "";
  estado = typeof estado === "string" ? estado.trim().toLowerCase() : "";
  dni = typeof dni === "string" ? dni.trim() : String(dni || "").trim();

  // 1) Campos obligatorios
  if (!nombre || !apellido || !correo || !password || !dni) {
    return res.status(400).json({ message: "Faltan campos obligatorios (nombre, apellido, correo, password, dni)." });
  }

  // 2) Validación de nombre y apellido (solo letras, tildes, ñ, espacios, guion)
  if (!NAME_REGEX.test(nombre)) {
    return res.status(400).json({ message: "Nombre inválido: solo letras, espacios y guion (se admite ñ y tildes)." });
  }
  if (!NAME_REGEX.test(apellido)) {
    return res.status(400).json({ message: "Apellido inválido: solo letras, espacios y guion (se admite ñ y tildes)." });
  }

  // 3) Limpieza: Title Case
  nombre = toTitle(nombre);
  apellido = toTitle(apellido);

  // 4) Validación de correo robusta
  const v = await validarEmailFuerte(correo);
  if (!v.ok) return res.status(400).json({ message: v.message });
  const email = v.email;

  // 5) Estado permitido
  if (!ESTADOS_PERMITIDOS.includes(estado)) {
    return res.status(400).json({ message: "Estado inválido (activo | inactivo)." });
  }

  // 6) DNI: solo dígitos y longitud
  if (!/^\d+$/.test(dni) || dni.length !== DNI_LENGTH) {
    return res.status(400).json({ message: `DNI inválido: debe contener ${DNI_LENGTH} dígitos.` });
  }

  // 7) Password (mínimo; si quieres complejidad, agrega más reglas)
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.` });
  }

  try {
    const pool = await getPool();

    // 8) Chequear duplicados (correo y dni)
    const dupCorreo = await pool.request()
      .input("correo", mssql.NVarChar, email)
      .query(`SELECT 1 FROM Usuario WHERE LOWER(correo) = LOWER(@correo)`);

    const dupDni = await pool.request()
      .input("dni", mssql.NVarChar, dni)
      .query(`SELECT 1 FROM Usuario WHERE dni = @dni`);

    if (dupCorreo.recordset.length > 0) {
      return res.status(409).json({ message: "El correo ya está registrado." });
    }

    if (dupDni.recordset.length > 0) {
      return res.status(409).json({ message: "El DNI ya está registrado." });
    }

    // 9) Resolver rol → id numérico
    let roleId = null;

    if (typeof id_rol === "number" || (typeof id_rol === "string" && /^\d+$/.test(id_rol))) {
      roleId = parseInt(id_rol, 10);
      const rolChk = await pool.request()
        .input("id_rol", mssql.Int, roleId)
        .query(`SELECT 1 FROM Rol WHERE id_rol = @id_rol`);
      if (rolChk.recordset.length === 0) {
        return res.status(400).json({ message: "Rol no válido (id inexistente)." });
      }
    } else if (typeof id_rol === "string" && id_rol.trim()) {
      const rolByName = await pool.request()
        .input("nombre_rol", mssql.NVarChar, id_rol.trim())
        .query(`
          SELECT TOP 1 id_rol
          FROM Rol
          WHERE LOWER(nombre_rol) = LOWER(@nombre_rol)
        `);
      if (!rolByName.recordset.length) {
        return res.status(400).json({ message: "Rol no válido (nombre desconocido)." });
      }
      roleId = rolByName.recordset[0].id_rol;
    } else {
      return res.status(400).json({ message: "id_rol es requerido (id o nombre)." });
    }

    // 10) Hash de password
    const password_hash = await bcrypt.hash(password, 10);

    // 11) Insert
    await pool.request()
      .input("nombre",        mssql.NVarChar, nombre)
      .input("apellido",      mssql.NVarChar, apellido)
      .input("correo",        mssql.NVarChar, email)
      .input("password_hash", mssql.NVarChar, password_hash)
      .input("id_rol",        mssql.Int,      roleId)
      .input("estado",        mssql.NVarChar, estado)
      .input("dni",           mssql.NVarChar, dni)
      .query(`
        INSERT INTO Usuario (nombre, apellido, correo, password_hash, id_rol, estado, dni)
        VALUES (@nombre, @apellido, @correo, @password_hash, @id_rol, @estado, @dni)
      `);

    return res.status(201).json({ message: "Usuario creado con éxito" });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({ message: "Correo o DNI ya existe." });
    }
    console.error("Error al crear usuario:", error);
    return res.status(500).json({ message: "Error al crear el usuario" });
  }
});
// Eliminar usuario por id con condiciones inversas
router.delete('/usuarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getPool();

    // Verificar si el usuario tiene datos completos
    const usuario = await pool.request()
      .input("id_usuario", mssql.Int, id)
      .query(`SELECT nombre, apellido, correo, dni FROM Usuario WHERE id_usuario = @id_usuario`);

    if (usuario.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = usuario.recordset[0];

    // Verificar si el usuario tiene datos incompletos (si falta algún campo)
    if (!user.nombre || !user.apellido || !user.correo || !user.dni) {
      // Si el usuario tiene datos incompletos, permitir la eliminación
      await pool.request()
        .input("id_usuario", mssql.Int, id)
        .query(`DELETE FROM Usuario WHERE id_usuario = @id_usuario`);

      return res.status(200).json({ message: 'Usuario eliminado con éxito' });
    }

    // Verificar si el usuario tiene un anexo asociado
    const anexo = await pool.request()
      .input("id_usuario", mssql.Int, id)
      .query(`SELECT 1 FROM Anexo WHERE id_usuario = @id_usuario`);

    // Si tiene un anexo asociado, no se puede eliminar
    if (anexo.recordset.length > 0) {
      return res.status(400).json({ message: 'El usuario tiene un anexo creado y no puede ser eliminado' });
    }

    // Si el usuario tiene datos completos y NO tiene anexo, eliminarlo
    await pool.request()
      .input("id_usuario", mssql.Int, id)
      .query(`DELETE FROM Usuario WHERE id_usuario = @id_usuario`);

    res.status(200).json({ message: 'Usuario eliminado con éxito' });

  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ message: 'Error al eliminar el usuario' });
  }
});


router.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  let { nombre, apellido, correo, password, estado, dni, id_rol } = req.body || {};

  try {
    const pool = await getPool();
    
    // 1) Verificar si el usuario existe
    const usuarioExistente = await pool.request()
      .input("id_usuario", mssql.Int, id)
      .query(`SELECT * FROM Usuario WHERE id_usuario = @id_usuario`);
    
    if (usuarioExistente.recordset.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    // 2) Verificar si el correo ya existe (excepto para el usuario actual)
    if (correo) {
      const correoExistente = await pool.request()
        .input("correo", mssql.NVarChar, correo)
        .input("id_usuario", mssql.Int, id)  // Excluir el correo del usuario que estamos actualizando
        .query(`SELECT 1 FROM Usuario WHERE LOWER(correo) = LOWER(@correo) AND id_usuario != @id_usuario`);

      if (correoExistente.recordset.length > 0) {
        return res.status(409).json({ message: "El correo ya está registrado." });
      }
    }

    // 3) Validar si se reciben datos
    const updatedFields = {};
    const params = [];

    // 4) Verificar los campos y asignar valores de manera segura
    if (nombre) {
      updatedFields.nombre = nombre.trim();
      params.push({ name: 'nombre', value: updatedFields.nombre });
    }
    if (apellido) {
      updatedFields.apellido = apellido.trim();
      params.push({ name: 'apellido', value: updatedFields.apellido });
    }
    if (correo) {
      updatedFields.correo = correo.trim();
      params.push({ name: 'correo', value: updatedFields.correo });
    }
    if (estado) {
      updatedFields.estado = estado.trim().toLowerCase();
      params.push({ name: 'estado', value: updatedFields.estado });
    }
    if (dni) {
      updatedFields.dni = dni.trim();
      params.push({ name: 'dni', value: updatedFields.dni });
    }
    if (id_rol) {
      updatedFields.id_rol = parseInt(id_rol);  // Asegurarse que id_rol sea un número
      params.push({ name: 'id_rol', value: updatedFields.id_rol });
    }

    // 5) Validar si hay cambios en los campos
    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).json({ message: "No se proporcionaron campos para actualizar." });
    }

    // 6) Validar correo si se actualiza
    if (updatedFields.correo) {
      const v = await validarEmailFuerte(updatedFields.correo);
      if (!v.ok) return res.status(400).json({ message: v.message });
      updatedFields.correo = v.email;
    }

    // 7) Validar DNI si se actualiza
    if (updatedFields.dni && (!/^\d+$/.test(updatedFields.dni) || updatedFields.dni.length !== DNI_LENGTH)) {
      return res.status(400).json({ message: `DNI inválido: debe contener ${DNI_LENGTH} dígitos.` });
    }

    // 8) Construir consulta de actualización dinámicamente
    let updateQuery = "UPDATE Usuario SET ";
    Object.keys(updatedFields).forEach((field, index) => {
      updateQuery += `${field} = @${field}, `;
    });
    // Remover la coma final de la consulta
    updateQuery = updateQuery.slice(0, -2);

    updateQuery += " WHERE id_usuario = @id_usuario";

    const request = pool.request();
    // Añadir los parámetros a la solicitud
    params.forEach(param => {
      if (typeof param.value === 'string') {
        request.input(param.name, mssql.NVarChar, param.value);  // Para cadenas de texto
      } else if (typeof param.value === 'number') {
        request.input(param.name, mssql.Int, param.value);  // Para números
      }
    });

    request.input("id_usuario", mssql.Int, id);

    await request.query(updateQuery);

    res.status(200).json({ message: "Usuario actualizado con éxito" });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error al actualizar el usuario" });
  }
});


export default router;
