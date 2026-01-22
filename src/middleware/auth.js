// const { expressjwt: jwt } = require("express-jwt");
// const jwks = require("jwks-rsa");

import jwt from "jsonwebtoken";
import { db } from "modules";
import User from "schemas/Users";

async function auth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res
        .status(401)
        .json({ success: false, message: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const scheme = authHeader.split(" ")[0];
    console.log("🚀 ~ auth ~ scheme:", scheme);
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Invalid Authorization format. Use: Bearer <token>",
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      console.log("🚀 ~ auth ~ err:", err);
      const status = err.name === "TokenExpiredError" ? 401 : 403;
      return res.status(status).json({
        success: false,
        message:
          err.name === "TokenExpiredError" ? "Token expired" : "Token invalid",
      });
    }
    // Normaliza el id venga como id o userId
    const userId = payload.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    // (Recomendado) Verifica que el usuario siga activo (evita que un token viejo funcione si lo deshabilitas)
    const { data } = await db.get({ params: { id: userId } }, null, User);
    const user = data;
    if (!user || user.deleted) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }
    if (user.disabled) {
      return res.status(403).json({ success: false, message: "User disabled" });
    }

    // Carga lo mínimo necesario al request
    req.user = {
      id: user._id.toString(),
      role: user.role || payload.role, // prioridad a BD
    };

    return next();
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Auth error", detail: error.message });
  }
  //get token from request header
} //end of function

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!req.user?.role) {
      return res.status(403).json({ success: false, message: "Role missing" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

module.exports = { auth, requireRole };
