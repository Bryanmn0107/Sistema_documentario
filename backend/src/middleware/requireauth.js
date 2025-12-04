// middleware/requireAuth.js (Backend)
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Obtener el token del encabezado

  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guardar los datos decodificados del usuario en `req.user`
    next(); // Continúa con la solicitud
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}
