import { resError, db } from "modules";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "schemas/Users";
import AccessToken from "schemas/AccessToken";
import _ from "underscore";
import ObjectID from "bson-objectid";

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

    console.log("User logged in:", user);
    const payload = {
      userId: user._id.toString(),
      user: req.body.email,
      role: user.role,
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

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
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
