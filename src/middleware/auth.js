// const { expressjwt: jwt } = require("express-jwt");
// const jwks = require("jwks-rsa");

import jwt from "jsonwebtoken";
import User from "../schemas/Users"; // ajusta ruta

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res
        .status(401)
        .json({ success: false, message: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
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
      const status = err.name === "TokenExpiredError" ? 401 : 403;
      return res.status(status).json({
        success: false,
        message:
          err.name === "TokenExpiredError" ? "Token expired" : "Token invalid",
      });
    }

    // Normaliza el id venga como id o userId
    const userId = payload.id || payload.userId || payload.sub;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    // (Recomendado) Verifica que el usuario siga activo (evita que un token viejo funcione si lo deshabilitas)
    const user = await User.findById(userId).select(
      "_id role disabled deleted",
    );
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
}; //end of function
