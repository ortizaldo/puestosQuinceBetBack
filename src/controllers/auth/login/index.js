import { resError, db } from "modules";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "schemas/Users";
import AccessToken from "schemas/AccessToken";
import TokenEmail from "schemas/TokenEmail";
import _ from "underscore";
import ObjectID from "bson-objectid";
import crypto from "crypto";

exports.login = async (req, res) => {
  const password = req.body.password;
  let err = {
    code: 422,
    title: "Login",
    message: "Esté email no se encuentra registrado",
  };
  try {
    req.query.filters = JSON.stringify({
      email: req.body.email,
      deleted: false,
    });

    const { data } = await db.get(req, null, User);
    const user = data[0];

    if (!user) throw err;

    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Credenciales inválidas" });
    if (user.disabled)
      return res
        .status(403)
        .json({ success: false, message: "Usuario deshabilitado" });

    const ok = await bcrypt.compare(password, user.hashedPassword);
    if (!ok)
      return res
        .status(401)
        .json({ success: false, message: "Credenciales inválidas" });

    const payload = {
      userId: user._id.toString(),
      user: req.body.email,
      role: user.typeUser,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    req.body = {
      user: user._id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };

    //guardamos el token en la bd
    await db.create(req, null, AccessToken);

    res.json({ user, accessToken: accessToken, refreshToken: refreshToken });
  } catch (error) {
    resError(res, error);
  }
};

exports.refreshToken = async (req, res) => {
  try {
    if (!req.body.token) throw Error("Empty token");

    req.query.filters = JSON.stringify({
      refreshToken: req.body.token,
      deleted: false,
    });

    const { data } = await db.get(req, null, AccessToken);

    refreshTokens = data;

    //remove the old refreshToken from the refreshTokens list
    const tokensId = [],
      tokenRefreshLst = [];

    _.each(refreshTokens, function (token, idx) {
      tokensId.push(ObjectID(token._id));
      tokenRefreshLst.push(token.refreshToken);
    });

    if (!tokenRefreshLst.includes(req.body.token))
      throw Error("Refresh Token Invalid");

    //generate new accessToken and refreshTokens
    const accessToken = generateAccessToken({ user: req.body.email });
    const refreshToken = generateRefreshToken({ user: req.body.email });

    req.query.filters = JSON.stringify({ hardDelete: true });

    req.query.items = tokensId;

    await db.delete(req, null, AccessToken);

    req.query.items = null;
    req.query.filters = JSON.stringify({
      email: req.body.email,
    });

    const userData = await db.get(req, null, User);
    const user = userData?.data[0];

    req.body = {
      user: user._id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };

    //guardamos el token en la bd
    await db.create(req, null, AccessToken);

    res.json({ accessToken: accessToken, refreshToken: refreshToken });
  } catch (error) {
    res.status(400).json({ message: error.message, success: false });
  }
};

exports.getAccessToken = async (req, res) => {
  try {
    const query = JSON.parse(req.query.filters);
    if (!query.email) throw Error("Empty email");

    req.query.filters = JSON.stringify({
      email: req.body.email,
      deleted: false,
    });

    const { data } = await db.get(req, null, User);
    const user = data[0];

    req.query.filtersId = JSON.stringify({
      user: { value: user._id },
    });

    const token = await db.get(req, null, AccessToken);

    const tokens = token.data;

    res.json({
      isAuthenticated: tokens.length > 0 ? true : false,
    });
  } catch (error) {
    res.status(400).json({ message: error.message, success: false });
  }
};

exports.logout = async (req, res) => {
  try {
    req.query.filtersId = JSON.stringify({
      user: req.body.user,
    });

    const { data } = await db.get(req, null, AccessToken);
    const tokens = data;

    if (tokens.length === 0) throw Error("Tokens does not exist!");

    const tokensId = [];
    _.each(tokens, function (token, idx) {
      tokensId.push(ObjectID(token._id));
    });

    req.query.filters = JSON.stringify({ hardDelete: true });

    req.query.items = tokensId;

    await db.delete(req, null, AccessToken);

    res.json({ message: "Logged out!" });
  } catch (error) {
    res.status(400).json({ message: error.message, success: false });
  }
};

// emailTokens
exports.handlerActivateEmail = async (req, res) => {
  try {
    const { id } = req.params;

    // const user = await User.findById(id);
    const user = await db.get(
      req,
      {
        filters: {
          _id: ObjectID(id),
          deleted: false,
        },
        select: ["_id"],
      },
      User,
    );

    const userData = user.data;

    if (!userData) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    if (userData.status === "ACTIVE") {
      return res.status(400).json({
        message: "El usuario ya se encuentra activo",
      });
    }

    await db.updateMany(
      req,
      {
        userId: userData._id,
        usedAt: null,
      },
      TokenEmail,
    );

    // Token que viajará en la URL
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Guardar solamente el hash en BD
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await TokenEmail.create({
      userId: userData._id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });

    const activationUrl = `${process.env.FRONTEND_URL}#/auth/activate-account?token=${rawToken}`;

    await sendActivationEmail({
      email: userData.email,
      name: userData.firstName + " " + userData.lastName,
      activationUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Correo de activación enviado correctamente",
    });
  } catch (error) {
    console.error(error);
    resError(res, error);
  }
};

exports.activation = async (req, res) => {
  try {
    const { token } = req.params;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const activationToken = await TokenEmail.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (!activationToken) {
      return res.status(400).json({
        valid: false,
        message: "El enlace de activación no es válido o ha expirado",
      });
    }

    const user = await User.findById(activationToken.userId);

    if (!user) {
      return res.status(404).json({
        valid: false,
        message: "Usuario no encontrado",
      });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({
        valid: false,
        message: "La cuenta ya se encuentra activa",
      });
    }

    return res.status(200).json({
      valid: true,
      message: "Token válido",
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Error validando token:", error);

    return res.status(500).json({
      valid: false,
      message: "Error al validar el enlace de activación",
    });
  }
};

exports.activateAccount = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: "Token",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const activationToken = await TokenEmail.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    });

    if (!activationToken) {
      return res.status(400).json({
        message: "El enlace de activación no es válido o ha expirado",
      });
    }

    const user = await User.findById(activationToken.userId);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado",
      });
    }

    if (user.status === "ACTIVE") {
      return res.status(400).json({
        message: "La cuenta ya se encuentra activa",
      });
    }

    user.status = "ACTIVE";
    user.activatedAt = new Date();

    await user.save();

    activationToken.usedAt = new Date();

    await activationToken.save();

    return res.status(200).json({
      message: "Cuenta activada correctamente",
    });
  } catch (error) {
    console.error("Error activando cuenta:", error);

    return res.status(500).json({
      message: "Error al activar la cuenta",
    });
  }
};

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "2h",
  });
}

// refreshTokens
let refreshTokens = [];
function generateRefreshToken(payload) {
  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "20m",
  });
  refreshTokens.push(refreshToken);
  return refreshToken;
}

async function sendActivationEmail({ email, name, activationUrl }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"Sociedad Gallistica La Angostura" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: "Activación de cuenta",
    html: `
      <h2>Bienvenido, ${name}</h2>

      <p>
        Tu cuenta ha sido registrada.
        Para completar tu registro debes crear tu contraseña.
      </p>

      <p>
        <a href="${activationUrl}">
          Activar cuenta
        </a>
      </p>

      <p>
        Este enlace tiene una vigencia de 24 horas.
      </p>

      <p>
        Si no solicitaste esta cuenta, puedes ignorar este correo.
      </p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
