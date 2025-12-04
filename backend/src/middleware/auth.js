import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  const token = header?.startsWith("Bearer") ? header.slice(7) : cookieToken;

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.id_rol)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
