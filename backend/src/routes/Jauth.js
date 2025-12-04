import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';
// Nota: En Node.js v18+ fetch es nativo. Si usas una versión anterior, descomenta la siguiente línea:
// import fetch from 'node-fetch'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta al archivo fwAuthorization.json (Asumiendo que está en la raíz del proyecto)
const CONFIG_PATH = path.join(__dirname, '..', '..', 'fwAuthorization.json');

function getCredentialsFromFile() {
  try {
    // Intentar leer desde la raíz del proyecto
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
    
    // Intentar leer desde la ruta de ejecución (fallback)
    const localPath = path.resolve('fwAuthorization.json');
    if (fs.existsSync(localPath)) {
      const data = fs.readFileSync(localPath, 'utf8');
      return JSON.parse(data);
    }

    throw new Error(`No se encontró el archivo de credenciales en: ${CONFIG_PATH}`);
  } catch (err) {
    console.error("Error crítico leyendo fwAuthorization.json:", err);
    throw err; // Re-lanzamos para que lo capture getToken
  }
}

export async function getToken() {
  try {
    // 1. Obtener credenciales del archivo JSON
    const credentials = getCredentialsFromFile();
    
    // Validar campos requeridos
    if (!credentials.client_id || !credentials.client_secret || !credentials.token_url) {
      throw new Error("El archivo fwAuthorization.json no tiene el formato correcto (client_id, client_secret, token_url).");
    }

    // 2. Codificar credenciales en Base64 (Estándar Basic Auth)
    const base64Credentials = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');

    // 3. Solicitar Token al servicio (RENIEC/IOFE)
    const response = await fetch(credentials.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${base64Credentials}`
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servicio de autenticación (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;

  } catch (error) {
    // --- [INICIO] BLOQUE TEMPORAL DE PRUEBAS (BORRAR EN PRODUCCIÓN) ---
    console.warn("⚠️ [MODO PRUEBAS] Error en Auth real. Usando Token Simulado 'TOKEN_DE_PRUEBA_12345'.");
    console.warn(">>> DETALLE DEL ERROR REAL:", error.message);
    return "TOKEN_DE_PRUEBA_12345";
    // --- [FIN] BLOQUE TEMPORAL DE PRUEBAS ---
  }
}