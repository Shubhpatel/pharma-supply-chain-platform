const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  // Generate a secure random secret if not provided in environment
  process.env.JWT_SECRET = require("crypto").randomBytes(64).toString("hex");
  console.warn("🛡️ Security Warning: JWT_SECRET is not set. A random secret has been generated for this session. Please set JWT_SECRET in your .env file.");
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, name, role, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requirePermission(...allowedPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role === "ADMIN") {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = allowedPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }

    next();
  };
}

module.exports = { requireAuth, requirePermission };
