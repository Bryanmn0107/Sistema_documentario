import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'; 
import rateLimit from 'express-rate-limit'; 
import { fileURLToPath } from 'url';
import multer from 'multer';

// Importación de rutas
import authRoutes from './src/routes/auth.js';
import searchRoutes from './src/routes/search.js'; 
import adminRoutes from './src/routes/admin.js';
import anexosRoutes from './src/routes/anexos.js';
import logoutRoutes from './src/routes/logout.js';
import firmasRoutes from './src/routes/firmas.js';

dotenv.config(); 

const app = express();
const port = process.env.PORT || 3004;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



app.use(
  helmet({
    // Permite cargar imágenes/PDFs desde otros dominios/puertos
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // CONFIGURACIÓN CRÍTICA PARA EL VISOR PDF
    contentSecurityPolicy: {
      directives: {
        // Configuración por defecto (permite scripts/imágenes locales)
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        
        // ¡ESTA ES LA CLAVE!
        // Le decimos: "Acepta iframes si vienen de mí mismo ('self') O de localhost:3000"
        "frame-ancestors": ["'self'", "http://localhost:3000"],
      },
    },
  })
);


// Solo permite peticiones desde tu Frontend, bloqueando a todos los demás.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Tu frontend Next.js
  credentials: true, // Permitir cookies/tokens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Evita ataques de fuerza bruta y DDoS básicos.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Límite de 300 peticiones por IP por ventana
  message: "Demasiadas peticiones desde esta IP, por favor intenta más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar el limitador general a todas las rutas que empiecen con /api
app.use('/api/', generalLimiter);


// Limitar el tamaño del cuerpo para evitar ataques de desbordamiento de búfer
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


// OJO: Asegúrate de que en 'uploads' no se puedan subir scripts ejecutables (.js, .php, etc)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- RUTAS API ---
app.get('/', (req, res) => {
  res.send('¡API Segura de Firma Digital Activa!');
});

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes); 
app.use('/api/admin', adminRoutes);
app.use('/api/anexos', anexosRoutes); 
app.use('/api/logout', logoutRoutes);
app.use('/api/firmas', firmasRoutes);

// --- INICIAR SERVIDOR ---
app.listen(port, () => {
  console.log(`El servidor esta corriendo en http://localhost:${port}`);
});