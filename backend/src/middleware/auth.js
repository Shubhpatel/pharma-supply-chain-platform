const jwt = require("jsonwebtoken");

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
