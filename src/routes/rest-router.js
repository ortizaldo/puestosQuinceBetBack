import { Router } from "express";
import { resError, db } from "modules";
import crypto from "crypto";
import bcrypt from "bcrypt";
import _ from "underscore";
import nodemailer from "nodemailer";
import TokenEmail from "schemas/TokenEmail";

// interface ActivationEmail {
//   email: string;
//   name: string;
//   activationUrl: string;
// }

function RestRouter(modelClassname, options = null, hashPassword = false) {
  const router = Router();
  async function handlerGet(req, res) {
    try {
      const response = await db.get(req, options, modelClassname);

      res.status(200).json(response);
    } catch (err) {
      resError(res, err);
    }
  }

  async function handlerPost(req, res) {
    try {
      req.hashPassword = hashPassword;
      const instance = await db.create(
        req,
        options,
        modelClassname,
        req.body.filterOptions
          ? {
              populate: req.body.populateFields,
            }
          : null,
      );

      res.status(200).json({
        data: instance,
      });
    } catch (err) {
      resError(res, err);
    }
  }

  async function handlerActivateEmail(req, res) {
    try {
      const { id } = req.params;

      // const user = await User.findById(id);
      const user = await db.get(
        req,
        {
          filters: {
            deleted: false,
          },
          select: ["_id"],
        },
        modelClassname,
      );

      // console.log(
      //   "%cpuestosQuinceBetBack/src/routes/rest-router.js:57 user",
      //   "color: #007acc;",
      //   user.data,
      // );

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

      const activationUrl = `${process.env.FRONTEND_URL}/auth/activate-account?token=${rawToken}`;

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

  async function handlerPostMany(req, res) {
    try {
      const result = await db.createMany(req, options, modelClassname);
      res.status(200).json({
        data: result,
      });
    } catch (err) {
      resError(res, err);
    }
  }

  async function handlerPatch(req, res) {
    try {
      const instance = await db.edit(req, options, modelClassname);

      res.status(200).json({
        data: instance,
      });
    } catch (err) {
      resError(res, err);
    }
  }

  async function handlerPatchMany(req, res) {
    try {
      const updatedResult = await db.updateMany(req, options, modelClassname);
      res.status(200).json({
        data: updatedResult,
      });
    } catch (err) {
      resError(res, err);
    }
  }

  async function handlerDelete(req, res) {
    try {
      const instance = await db.delete(req, options, modelClassname);
      res.status(200).json({
        data: instance,
      });
    } catch (err) {
      resError(res, err);
    }
  }

  router.post("", handlerPostMany);
  router.post("/new", handlerPost);
  router.post("/:id/send-activation-email", handlerActivateEmail);

  router.get("/:id?", handlerGet);

  router.patch("/:id", handlerPatch);
  router.put("/:id", handlerPatch);
  router.patch("", handlerPatchMany);
  router.put("", handlerPatchMany);

  router.delete("/:id?", handlerDelete);
  return router;
}

export default RestRouter;
