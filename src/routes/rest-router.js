import { Router } from "express";
import { resError, db } from "modules";
import _ from "underscore";


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
          : null
      );

      res.status(200).json({
        data: instance,
      });
    } catch (err) {
      resError(res, err);
    }
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

  router.get("/:id?", handlerGet);

  router.patch("/:id", handlerPatch);
  router.put("/:id", handlerPatch);
  router.patch("", handlerPatchMany);
  router.put("", handlerPatchMany);

  router.delete("/:id?", handlerDelete);
  return router;
}

export default RestRouter;
