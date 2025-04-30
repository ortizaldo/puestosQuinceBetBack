// const { expressjwt: jwt } = require("express-jwt");
// const jwks = require("jwks-rsa");

import jwt from "jsonwebtoken";

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) throw Error("Empty header");

    const token = authHeader.split(" ")[1];
    if (token == null) throw Error("Token not present");

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        res.status(403).send("Token invalid");
      } else {
        req.user = user;
        next(); //proceed to the next action in the calling function
      }
    }); //end of jwt.verify()
  } catch (error) {
    res.status(400).json({ message: error.message, success: false });
  }
  //get token from request header
}; //end of function
