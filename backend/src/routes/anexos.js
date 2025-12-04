import express from 'express';
import multer from 'multer';
import { getPool, mssql } from '../db.js';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads');
const TEMP_DIR = path.join(UPLOADS_ROOT, 'temporal');
const PERMANENT_DIR = path.join(UPLOADS_ROOT, 'permanente');
const FIRMADOS_DIR = path.join(UPLOADS_ROOT, 'firmados');

// Asegurar existencia de carpetas
[TEMP_DIR, PERMANENT_DIR, FIRMADOS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  }
});


const getSystemPath = (dbPath) => {
  if (!dbPath) return null;
  let cleanPath = dbPath.trim().replace(/\\/g, '/');
  if (cleanPath.includes('uploads/')) {
    cleanPath = cleanPath.substring(cleanPath.indexOf('uploads/'));
  }
  cleanPath = cleanPath.replace(/^\//, '');
  return path.join(PROJECT_ROOT, cleanPath);
};

const calculateFileHash = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
};
router.get('/tipos', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT id_tipo, nombre, siglas FROM Tipo_Documento WHERE estado = 'activo'");
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al cargar tipos" });
    }
});


router.get('/correlativo', async (req, res) => {
    const { id_usuario, id_tipo } = req.query;
    if (!id_usuario || !id_tipo) return res.status(400).json({ next: '' });

    try {
        const pool = await getPool();
        // Contamos docs de este tipo subidos por el usuario este año (usando el usuario del Anexo)
        const result = await pool.request()
            .input('uid', mssql.Int, id_usuario)
            .input('tid', mssql.Int, id_tipo)
            .query(`
                SELECT COUNT(*) as total 
                FROM Documento d
                LEFT JOIN Anexo a ON d.id_anexo = a.id_anexo
                WHERE a.id_usuario = @uid 
                AND d.id_tipo = @tid
                AND YEAR(d.fecha_subida) = YEAR(GETDATE())
            `);

        const siguiente = result.recordset[0].total + 1;
        const anio = new Date().getFullYear();
        const numeroFormateado = String(siguiente).padStart(3, '0');
        
        res.json({ next: `${numeroFormateado}-${anio}` });
    } catch (error) {
        console.error("Error correlativo:", error);
        res.status(500).json({ next: '' });
    }
});


router.post('/smart-upload', upload.single('archivo'), async (req, res) => {
    const { id_usuario, id_tipo, numero_doc } = req.body;
    let { id_anexo } = req.body;
    const file = req.file;

    // 1. VALIDACIÓN DE ARCHIVO FÍSICO
    if (!file) return res.status(400).json({ message: "No hay archivo." });
    if (file.size === 0) return res.status(400).json({ message: "El archivo está vacío (0 bytes)." });

    try {
        // 2. CALCULAR HASH Y MOSTRARLO EN CONSOLA (DEPURACIÓN)
        const fileHash = await calculateFileHash(file.path);
        console.log(`🔍 HASH GENERADO para ${file.originalname}: [${fileHash}]`);

        const pool = await getPool();

        // 3. VERIFICAR DUPLICADOS (Ignorando Nulos y el mismo archivo si se subió incompleto)
        const duplicadoContenido = await pool.request()
            .input('hash', mssql.VarChar, fileHash)
            .query(`
                SELECT TOP 1 d.nombre_archivo, a.codigo_anexo 
                FROM Documento d
                JOIN Anexo a ON d.id_anexo = a.id_anexo
                WHERE d.hash_contenido = @hash 
                AND d.hash_contenido IS NOT NULL 
                AND LEN(d.hash_contenido) > 0
            `);

        if (duplicadoContenido.recordset.length > 0) {
            const docExistente = duplicadoContenido.recordset[0];
            console.log(" ALERTA: Duplicado encontrado en:", docExistente.codigo_anexo);
            
            // Borrar temporal inmediatamente
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path); 
            
            return res.status(409).json({ 
                message: "Contenido Duplicado", 
                detalle: `Este archivo es IDÉNTICO (en contenido) al documento "${docExistente.nombre_archivo}".`,
                ubicacion: `Ya existe en el Expediente: ${docExistente.codigo_anexo}`
            });
        }

        // 4. OBTENER DATOS NOMENCLATURA
        const datos = await pool.request()
            .input('uid', mssql.Int, id_usuario)
            .input('tid', mssql.Int, id_tipo)
            .query(`
                SELECT u.apellido, t.siglas 
                FROM Usuario u, Tipo_Documento t 
                WHERE u.id_usuario = @uid AND t.id_tipo = @tid
            `);
        
        if (datos.recordset.length === 0) throw new Error("Usuario o Tipo inválido");
        
        const { apellido, siglas } = datos.recordset[0];
        const ext = path.extname(file.originalname);
        const apellidoLimpio = apellido.trim().toUpperCase().replace(/\s+/g, '_');
        
        // Nombre final: Ej. INF_001-2025_PEREZ.pdf
        const nuevoNombre = `${siglas}_${numero_doc}_${apellidoLimpio}${ext}`;

        // 5. VERIFICAR DUPLICADO DE NOMBRE (Opcional: permitir mismo nombre si contenido es diferente?)
        // Por seguridad administrativa, bloqueamos nombres idénticos también
        const duplicadoNombre = await pool.request()
            .input('nombre', mssql.NVarChar, nuevoNombre)
            .query(`SELECT a.codigo_anexo FROM Documento d JOIN Anexo a ON d.id_anexo = a.id_anexo WHERE d.nombre_archivo = @nombre`);

        if (duplicadoNombre.recordset.length > 0) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(409).json({ 
                message: "Nomenclatura Duplicada", 
                detalle: `Ya existe un documento registrado con el código oficial "${nuevoNombre}".`,
                ubicacion: `Verifique el Expediente: ${duplicadoNombre.recordset[0].codigo_anexo}`
            });
        }

        // 6. CREAR ANEXO SI NO EXISTE
        if (!id_anexo || id_anexo === 'null' || id_anexo === 'undefined' || id_anexo === "") {
            const codigoAuto = `EXP-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`;
            const resultAnexo = await pool.request()
                .input('codigo', mssql.NVarChar, codigoAuto)
                .input('desc', mssql.NVarChar, `Generado por: ${nuevoNombre}`)
                .input('id_user', mssql.Int, id_usuario)
                .query(`
                    INSERT INTO Anexo (codigo_anexo, descripcion, estado, id_usuario, fecha_creacion)
                    OUTPUT INSERTED.id_anexo
                    VALUES (@codigo, @desc, 'pendiente', @id_user, GETDATE())
                `);
            id_anexo = resultAnexo.recordset[0].id_anexo;
        }

        // 7. MOVER ARCHIVO
        const rutaRelativaDB = `uploads/permanente/${nuevoNombre}`;
        const rutaFinalAbsoluta = path.join(PERMANENT_DIR, nuevoNombre);
        
        await fsPromises.rename(file.path, rutaFinalAbsoluta);

        // 8. GUARDAR
        const docResult = await pool.request()
            .input('id_anexo', mssql.Int, id_anexo)
            .input('nombre', mssql.NVarChar, nuevoNombre)
            .input('ruta', mssql.NVarChar, rutaRelativaDB)
            .input('tipo', mssql.NVarChar, file.mimetype)
            .input('id_doc_tipo', mssql.Int, id_tipo)
            .input('num_ref', mssql.NVarChar, numero_doc)
            .input('hash', mssql.VarChar, fileHash) // <--- HASH
            .query(`
                INSERT INTO Documento (id_anexo, nombre_archivo, ruta_archivo, tipo_archivo, fecha_subida, id_tipo, numero_referencia, estado_firma, hash_contenido)
                OUTPUT INSERTED.id_documento
                VALUES (@id_anexo, @nombre, @ruta, @tipo, GETDATE(), @id_doc_tipo, @num_ref, 'pendiente', @hash)
            `);

        // 9. RESPONDER CON CÓDIGO DE ANEXO
        const anexoInfo = await pool.request()
            .input('ida', mssql.Int, id_anexo)
            .query("SELECT codigo_anexo FROM Anexo WHERE id_anexo = @ida");
        
        const codigoFinal = anexoInfo.recordset[0]?.codigo_anexo;

        res.json({ 
            success: true, 
            message: "Documento registrado.", 
            anexo: id_anexo,
            codigo_anexo: codigoFinal,
            documento: {
                id: docResult.recordset[0].id_documento,
                url: rutaRelativaDB,
                nombre: nuevoNombre
            }
        });

    } catch (error) {
        console.error("Error smart-upload:", error);
        if (file && fs.existsSync(file.path)) {
             try { fs.unlinkSync(file.path); } catch(e){} 
        }
        if (!res.headersSent) res.status(500).json({ message: "Error interno: " + error.message });
    }
});

 //Subida Temporal
router.post('/staging', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send("No se subió ningún archivo");
  const tempWebPath = `uploads/temporal/${req.file.filename}`;
  res.json({
    success: true,
    tempUrl: tempWebPath,
    originalName: req.file.originalname
  });
});

// 2. UNIFICACIÓN DE EXPEDIENTES
router.post('/unificar', upload.none(), async (req, res) => {
  let { idsDocumentos, tituloExpediente } = req.body;

  if (typeof idsDocumentos === 'string') {
    try { idsDocumentos = JSON.parse(idsDocumentos); } catch (e) { idsDocumentos = []; }
  }

  if (!idsDocumentos || idsDocumentos.length === 0) {
    return res.status(400).json({ success: false, message: "No se seleccionaron documentos." });
  }

  try {
    const pool = await getPool();
    const filesToAttach = [];

    const request = pool.request();
    const paramNames = idsDocumentos.map((_, i) => `@idDoc${i}`);
    const query = `SELECT id_documento, nombre_archivo, ruta_archivo FROM Documento WHERE id_documento IN (${paramNames.join(',')})`;
    
    idsDocumentos.forEach((id, i) => request.input(`idDoc${i}`, mssql.Int, id));
    const result = await request.query(query);

    for (const doc of result.recordset) {
      try {
        const sysPath = getSystemPath(doc.ruta_archivo);
        if (sysPath) {
            await fsPromises.access(sysPath);
            const buffer = await fsPromises.readFile(sysPath);
            const safeName = `${doc.id_documento}_${doc.nombre_archivo.trim().replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            filesToAttach.push({ 
                buffer, 
                name: safeName, 
                description: doc.nombre_archivo.trim() 
            });
        }
      } catch (err) { 
          console.warn(`Archivo no encontrado para Doc ID ${doc.id_documento}: ${err.message}`); 
      }
    }

    if (filesToAttach.length === 0) {
        return res.status(400).json({ success: false, message: "No se encontraron los archivos físicos." });
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(tituloExpediente || 'Expediente Unificado');
    
    const page = pdfDoc.addPage([595.28, 841.89]); 
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();

    page.drawText('EXPEDIENTE DIGITAL UNIFICADO', { x: 50, y: height - 80, size: 18, font });
    page.drawText('Copia Visual + Adjuntos Originales (PAdES)', { x: 50, y: height - 105, size: 10, font });
    page.drawText('Los documentos firmados digitalmente se encuentran ADJUNTOS a este PDF.', { x: 50, y: height - 130, size: 12 });
    page.drawText(`Generado el: ${new Date().toLocaleString()}`, { x: 50, y: height - 170, size: 10 });

    for (const item of filesToAttach) {
      await pdfDoc.attach(item.buffer, item.name, {
        mimeType: 'application/pdf',
        description: item.description,
        creationDate: new Date(),
        modificationDate: new Date()
      });

      try {
          const srcPdf = await PDFDocument.load(item.buffer);
          const copiedPages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
          copiedPages.forEach((page) => pdfDoc.addPage(page));
      } catch (err) {
          const errPage = pdfDoc.addPage([595.28, 200]);
          errPage.drawText(`[No se pudo previsualizar: ${item.name}. Ver adjuntos.]`, { x: 50, y: 100, size: 10 });
      }
    }

    const filename = `Unificado_Hibrido_${Date.now()}.pdf`;
    const savePath = path.join(FIRMADOS_DIR, filename);
    const pdfBytes = await pdfDoc.save();
    
    await fsPromises.writeFile(savePath, pdfBytes);

    res.json({
      success: true,
      documentUrl: `uploads/firmados/${filename}`
    });

  } catch (error) {
    console.error("Error unificando:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// 3. GESTIÓN DE ANEXOS Y DOCUMENTOS (MANUAL)
router.post('/anexos', async (req, res) => {
  const { codigo_anexo, descripcion, estado, id_usuario } = req.body;
  if (!id_usuario) return res.status(400).json({ message: 'Usuario requerido.' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('codigo_anexo', mssql.NVarChar, codigo_anexo)
      .input('descripcion', mssql.NVarChar, descripcion)
      .input('estado', mssql.NVarChar, estado || 'pendiente')
      .input('id_usuario', mssql.Int, id_usuario)
      .input('fecha_creacion', mssql.DateTime, new Date())
      .query(`INSERT INTO Anexo (codigo_anexo, descripcion, estado, id_usuario, fecha_creacion) VALUES (@codigo_anexo, @descripcion, @estado, @id_usuario, @fecha_creacion)`);
    res.status(201).json({ message: 'Anexo creado' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno' });
  }
});

router.get('/anexos/:codigo_anexo', async (req, res) => {
  const { codigo_anexo } = req.params;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('codigo', mssql.NVarChar, codigo_anexo)
      .query(`SELECT id_anexo, codigo_anexo, descripcion, estado, ruta_pdf FROM Anexo WHERE codigo_anexo = @codigo`);

    if (result.recordset.length === 0) return res.status(404).json({ message: 'No encontrado' });
    
    const data = result.recordset[0];
    if (data.ruta_pdf) data.ruta_pdf = data.ruta_pdf.trim();

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error servidor' });
  }
});

router.get('/anexos/:id_anexo/documentos', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', mssql.Int, req.params.id_anexo)
      .query(`SELECT id_documento, nombre_archivo, ruta_archivo, fecha_subida, estado_firma FROM Documento WHERE id_anexo = @id ORDER BY fecha_subida DESC`);
    
    const docs = result.recordset.map(doc => ({
      ...doc,
      ruta_archivo: `/api/anexos/documentos/${doc.id_documento}/descargar`
    }));

    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Error listando documentos' });
  }
});

router.get('/documentos/:id_documento/descargar', async (req, res) => {
  const { id_documento } = req.params;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', mssql.Int, id_documento)
      .query("SELECT ruta_archivo, nombre_archivo FROM Documento WHERE id_documento = @id");

    if (result.recordset.length === 0) return res.status(404).send("Documento no encontrado.");

    const sysPath = getSystemPath(result.recordset[0].ruta_archivo);
    
    if (fs.existsSync(sysPath)) {
        res.setHeader('Content-Disposition', `inline; filename="${result.recordset[0].nombre_archivo.trim()}"`);
        res.sendFile(sysPath);
    } else {
        res.status(404).send("Archivo físico no disponible.");
    }
  } catch (error) {
    res.status(500).send("Error de descarga.");
  }
});

router.get('/anexos/:id_anexo/descargar', async (req, res) => {
  const { id_anexo } = req.params;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', mssql.Int, id_anexo)
      .query("SELECT ruta_pdf FROM Anexo WHERE id_anexo = @id");

    if (result.recordset.length === 0 || !result.recordset[0].ruta_pdf) {
      return res.status(404).send("Expediente no unificado aún.");
    }

    const sysPath = getSystemPath(result.recordset[0].ruta_pdf);
    
    if (fs.existsSync(sysPath)) {
        res.setHeader('Content-Disposition', `inline; filename="Expediente_${id_anexo}.pdf"`);
        res.sendFile(sysPath);
    } else {
        res.status(404).send("Archivo de expediente no encontrado.");
    }
  } catch (error) {
    res.status(500).send("Error de descarga.");
  }
});

export default router;