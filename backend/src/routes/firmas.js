
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPool, mssql } from '../db.js';
import cors from 'cors';
import { getToken } from './Jauth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..'); 
const UPLOADS_FIRMADOS = path.join(PROJECT_ROOT, 'uploads', 'firmados');

if (!fs.existsSync(UPLOADS_FIRMADOS)) fs.mkdirSync(UPLOADS_FIRMADOS, { recursive: true });

// Configuración Multer (Solo para recibir firmados de ReFirma)
const storageFirmados = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_FIRMADOS),
  filename: (req, file, cb) => {
    const uniqueName = `firmado-${Date.now()}-${Math.round(Math.random()*1000)}.pdf`;
    cb(null, uniqueName);
  }
});
const uploadFirmados = multer({ storage: storageFirmados, limits: { fileSize: 100 * 1024 * 1024 } });

// =============================================================================
// 1. INICIAR TRÁMITE (Protocolo ReFirma)
// =============================================================================
router.post('/iniciar', async (req, res) => {
  const { idAnexo, idUsuario, documentUrl, action, filename } = req.body;

  if (!idAnexo || !idUsuario || !documentUrl) {
    return res.status(400).json({ success: false, message: "Datos incompletos." });
  }

  // Generación de token estándar
  let token = `TOKEN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
  // Forzamos un token de prueba para que el frontend active el modo simulación
  token = `TOKEN_DE_PRUEBA_${Date.now()}`;
  console.warn(`⚠️ [MODO DEMO] Generando token de simulación: ${token}`);
  // ================== FIN BLOQUE DEMO ==================

  try {
    const pool = await getPool();
    
    // Limpieza de ruta para uso interno (Trim para seguridad)
    let cleanPath = documentUrl.trim();
    if (cleanPath.includes('/uploads/')) {
       cleanPath = cleanPath.substring(cleanPath.indexOf('uploads/'));
    }

    const metadata = JSON.stringify({ 
      action: action || 'ALTA_DOCUMENTO', 
      originalName: filename || 'Documento.pdf',
      // Guardamos la ruta original para usarla en la simulación
      tempPath: cleanPath 
    });

    // Si es cierre, vinculamos provisionalmente al anexo
    if (action === 'CIERRE_EXPEDIENTE') {
       await pool.request()
        .input('ruta', mssql.NVarChar, cleanPath)
        .input('id', mssql.Int, idAnexo)
        .query("UPDATE Anexo SET ruta_pdf = @ruta WHERE id_anexo = @id");
    }

    await pool.request()
      .input('id_anexo', mssql.Int, idAnexo)
      .input('id_usuario', mssql.Int, idUsuario)
      .input('token_seguridad', mssql.VarChar, token)
      .input('pagina_firma', mssql.Int, 1)
      .input('posicion_x', mssql.Int, 100)
      .input('posicion_y', mssql.Int, 100)
      .input('motivo_firma', mssql.VarChar, "Soy el autor del documento")
      .input('cargo_firmante', mssql.VarChar, metadata) 
      .input('estilo_firma', mssql.Int, 1)
      .input('nivel_firma', mssql.VarChar, "B") 
      .input('tipo_firma', mssql.VarChar, 'PAdES') 
      .query(`
        INSERT INTO Firma (
          id_anexo, id_usuario, token_seguridad, 
          pagina_firma, posicion_x, posicion_y, 
          motivo_firma, cargo_firmante, estilo_firma, nivel_firma, tipo_firma,
          estado_firma, fecha_firma
        ) VALUES (
          @id_anexo, @id_usuario, @token_seguridad, 
          @pagina_firma, @posicion_x, @posicion_y, 
          @motivo_firma, @cargo_firmante, @estilo_firma, @nivel_firma, @tipo_firma,
          'PENDIENTE', GETDATE()
        )
      `);

    const protocol = req.protocol;
    const host = req.get('host'); 
    const paramUrl = `${protocol}://${host}/api/firmas/parametros?token=${token}&tempPath=${encodeURIComponent(cleanPath)}`;

    res.json({ success: true, token, paramUrl });

  } catch (error) {
    console.error("Error iniciar:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================================================
// 2. OBTENER PARÁMETROS (ReFirma)
// =============================================================================
router.get('/parametros', cors(), async (req, res) => {
  const { token, tempPath } = req.query;
  if (!token) return res.status(400).send("Token requerido");

  try {
    const serviceToken = await getToken();
    const pool = await getPool();
    
    let data;
    
    // ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
    if (token.includes("TOKEN_DE_PRUEBA")) {
        // Mock data para simulación
        data = {
            nivel_firma: "B", motivo_firma: "Firma de Prueba", estilo_firma: 1, pagina_firma: 1,
            posicion_x: 100, posicion_y: 100, id_anexo: 0,
            cargo_firmante: JSON.stringify({ action: 'ALTA_DOCUMENTO', originalName: 'Mock.pdf' })
        };
    } 
    // ================== FIN BLOQUE DEMO ==================
    else {
        const result = await pool.request()
        .input('token', mssql.VarChar, token)
        .query(`SELECT * FROM Firma WHERE token_seguridad = @token AND estado_firma = 'PENDIENTE'`);
        if (result.recordset.length === 0) return res.status(404).send("Token inválido");
        data = result.recordset[0];
    }

    let action = 'ALTA_DOCUMENTO';
    try { action = JSON.parse(data.cargo_firmante).action; } catch(e) {}

    // Determinamos ruta física a descargar
    let pathToSend = tempPath;
    if (!pathToSend && action === 'CIERRE_EXPEDIENTE') {
       const resAnexo = await pool.request().input('id', mssql.Int, data.id_anexo).query("SELECT ruta_pdf FROM Anexo WHERE id_anexo = @id");
       if (resAnexo.recordset.length > 0) {
           // TRIM CRÍTICO AQUÍ
           pathToSend = resAnexo.recordset[0].ruta_pdf ? resAnexo.recordset[0].ruta_pdf.trim() : null;
       }
    }

    // ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
    // Si estamos en demo y no hay path, usamos un mock o el path que venga
    if (token.includes("TOKEN_DE_PRUEBA") && !pathToSend) {
        pathToSend = "uploads/temporal/mock.pdf"; // Fallback
    }
    // ================== FIN BLOQUE DEMO ==================

    if (!pathToSend) return res.status(404).send("Documento no encontrado");

    const protocol = req.protocol;
    const host = req.get('host');
    const normalizedPath = pathToSend.replace(/\\/g, '/');
    const downloadUrl = `${protocol}://${host}/${normalizedPath}`; 
    const uploadUrl = `${protocol}://${host}/api/firmas/upload?token=${token}`;
    
    const params = {
      signatureFormat: "PAdES", signatureLevel: "B", signaturePackaging: "enveloped",
      documentToSign: downloadUrl, certificateFilter: ".*", 
      webTsa: "", userTsa: "", passwordTsa: "", theme: "claro",
      visiblePosition: false, signatureReason: data.motivo_firma,
      bachtOperation: false, oneByOne: true, signatureStyle: data.estilo_firma,
      imageToStamp: "https://apps.firmaperu.gob.pe/web/images/escudo.png",
      stampTextSize: 14, stampWordWrap: 37, role: "Firmante",
      stampPage: data.pagina_firma, positionx: data.posicion_x, positiony: data.posicion_y,
      uploadDocumentSigned: uploadUrl, certificationSignature: false,
      token: serviceToken 
    };

    res.json(params);

  } catch (error) {
    console.error("Error parametros:", error);
    res.status(500).send("Error interno");
  }
});

// =============================================================================
// 3. RECEPCIÓN CALLBACK (ReFirma -> BD)
// =============================================================================
router.post('/upload', uploadFirmados.any(), async (req, res) => {
  const { token } = req.query;
  const file = (req.files && req.files.length > 0) ? req.files[0] : req.file;

  if (!file || !token) return res.status(400).send("Error: Datos incompletos");

  try {
    const pool = await getPool();
    let check;
    
    // ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
    if (token.includes("TOKEN_DE_PRUEBA")) {
         // Mock check
         check = { recordset: [{ id_firma: 0, id_anexo: 0, cargo_firmante: JSON.stringify({ action: 'ALTA_DOCUMENTO' }) }] };
    } 
    // ================== FIN BLOQUE DEMO ==================
    else {
        check = await pool.request().input('token', mssql.VarChar, token).query("SELECT id_firma, id_anexo, cargo_firmante FROM Firma WHERE token_seguridad = @token AND estado_firma = 'PENDIENTE'");
    }

    if (check.recordset.length === 0) {
      try { fs.unlinkSync(file.path); } catch(e){}
      return res.status(403).send("Token inválido");
    }

    const { id_firma, id_anexo, cargo_firmante } = check.recordset[0];
    const publicPath = `uploads/firmados/${file.filename}`;
    let action = 'ALTA_DOCUMENTO';
    let originalName = file.originalname;
    try {
       const meta = JSON.parse(cargo_firmante);
       if (meta.action) action = meta.action;
       if (meta.originalName) originalName = meta.originalName;
    } catch(e) {}

    const transaction = pool.transaction();
    await transaction.begin();
    try {
      const request = transaction.request();
      
      if (!token.includes("TOKEN_DE_PRUEBA")) {
          await request.input('token', mssql.VarChar, token).input('ruta', mssql.VarChar, publicPath).query(`UPDATE Firma SET estado_firma = 'COMPLETADO', fecha_subida_firmado = GETDATE(), cargo_firmante = 'Firmante Autorizado' WHERE token_seguridad = @token`);
      }

      if (action === 'ALTA_DOCUMENTO') {
        await request.input('id_anexo', mssql.Int, id_anexo).input('nombre_archivo', mssql.NVarChar, originalName).input('ruta_archivo', mssql.NVarChar, publicPath).input('tipo_archivo', mssql.NVarChar, 'application/pdf').input('estado_firma', mssql.NVarChar, 'COMPLETADO')
          .query(`INSERT INTO Documento (id_anexo, nombre_archivo, ruta_archivo, tipo_archivo, version, fecha_subida, estado_firma) VALUES (@id_anexo, @nombre_archivo, @ruta_archivo, @tipo_archivo, 1, GETDATE(), @estado_firma)`);
          
        if (!token.includes("TOKEN_DE_PRUEBA")) {
             await request.query(`UPDATE Firma SET id_documento = (SELECT MAX(id_documento) FROM Documento WHERE id_anexo = ${id_anexo}) WHERE id_firma = ${id_firma}`);
        }
      } else if (action === 'CIERRE_EXPEDIENTE') {
        await request.input('ruta', mssql.NVarChar, publicPath).input('id_anexo', mssql.Int, id_anexo)
          .query(`UPDATE Anexo SET ruta_pdf = @ruta, estado = 'aprobado', fecha_firma = GETDATE() WHERE id_anexo = @id_anexo`);
      }

      await transaction.commit();
      res.status(200).send("OK");
    } catch (err) {
      await transaction.rollback();
      res.status(500).send("Error BD");
    }
  } catch (error) {
    res.status(500).send("Error servidor");
  }
});


// ================== INICIO BLOQUE DEMO (BORRAR EN PRODUCCIÓN) ==================
router.post('/simular-firma', async (req, res) => {
  const { token } = req.body;
  
  console.log(`[DEMO] Simulando firma para token: ${token}`);

  if (!token || !token.includes("TOKEN_DE_PRUEBA")) {
    return res.status(400).json({ success: false, message: "Token de simulación inválido" });
  }

  try {
    const pool = await getPool();
    
    // 1. Obtener datos de la firma pendiente
    const check = await pool.request()
       .input('token', mssql.VarChar, token)
       .query("SELECT id_firma, id_anexo, cargo_firmante FROM Firma WHERE token_seguridad = @token");
    
    if (check.recordset.length === 0) return res.status(404).json({success: false, message: "Transacción no encontrada"});

    const { id_firma, id_anexo, cargo_firmante } = check.recordset[0];
    
    let meta = {};
    try { meta = JSON.parse(cargo_firmante); } catch(e) {}
    const action = meta.action || 'ALTA_DOCUMENTO';
    // TRIM IMPORTANTE AQUÍ
    const simulatedPath = meta.tempPath ? meta.tempPath.trim() : "uploads/temporal/simulado.pdf"; 

    // 2. Ejecutar cambios en BD
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        const request = transaction.request();

        // Marcar firma
        await request.input('token', mssql.VarChar, token)
           .query("UPDATE Firma SET estado_firma = 'COMPLETADO', fecha_subida_firmado = GETDATE(), cargo_firmante = 'Firmante DEMO' WHERE token_seguridad = @token");

        if (action === 'ALTA_DOCUMENTO') {
            // Insertar Documento
            await request.input('id_anexo', mssql.Int, id_anexo)
               .input('nombre_archivo', mssql.NVarChar, meta.originalName || 'Demo.pdf')
               .input('ruta_archivo', mssql.NVarChar, simulatedPath) // Usamos el path temporal como definitivo para la demo
               .input('estado_firma', mssql.NVarChar, 'COMPLETADO')
               .query(`INSERT INTO Documento (id_anexo, nombre_archivo, ruta_archivo, tipo_archivo, version, fecha_subida, estado_firma) VALUES (@id_anexo, @nombre_archivo, @ruta_archivo, 'application/pdf', 1, GETDATE(), @estado_firma)`);
            
            // Vincular documento a firma
            await request.query(`UPDATE Firma SET id_documento = (SELECT MAX(id_documento) FROM Documento WHERE id_anexo = ${id_anexo}) WHERE id_firma = ${id_firma}`);

        } else if (action === 'CIERRE_EXPEDIENTE') {
            // Cerrar Anexo
            await request.input('ruta', mssql.NVarChar, simulatedPath)
               .input('id_anexo', mssql.Int, id_anexo)
               .query(`UPDATE Anexo SET ruta_pdf = @ruta, estado = 'aprobado', fecha_firma = GETDATE() WHERE id_anexo = @id_anexo`);
        }

        await transaction.commit();
        console.log(`[DEMO] Firma simulada exitosamente. Acción: ${action}`);
        res.json({ success: true });

    } catch (err) {
        await transaction.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: "Error SQL Demo" });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error servidor Demo" });
  }
});
// ================== FIN BLOQUE DEMO ==================

export default router;
