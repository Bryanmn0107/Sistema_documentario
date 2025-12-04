import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { getPool, mssql } from "../src/db.js";
dotenv.config();

const password = "12345678";
const hash = await bcrypt.hash(password, 10);

const pool = await getPool();
await pool.request()
  .input("nombre", mssql.NVarChar, "Admin")
  .input("apellido", mssql.NVarChar, "Root")
  .input("correo", mssql.NVarChar, "admin@example.com")
  .input("hash", mssql.NVarChar, hash)
  .input("rol", mssql.NVarChar, "administrador")
  .query(`
    IF NOT EXISTS (SELECT 1 FROM Usuario WHERE correo = @correo)
    INSERT INTO Usuario (nombre, apellido, correo, password_hash, rol, estado)
    VALUES (@nombre, @apellido, @correo, @hash, @rol, 1);
  `);

await pool.request()
  .input("nombre", mssql.NVarChar, "Usuario")
  .input("apellido", mssql.NVarChar, "Demo")
  .input("correo", mssql.NVarChar, "user@example.com")
  .input("hash", mssql.NVarChar, hash)
  .input("rol", mssql.NVarChar, "usuario")
  .query(`
    IF NOT EXISTS (SELECT 1 FROM Usuario WHERE correo = @correo)
    INSERT INTO Usuario (nombre, apellido, correo, password_hash, rol, estado)
    VALUES (@nombre, @apellido, @correo, @hash, @rol, 1);
  `);

console.log("Seed completed.");
process.exit(0);
