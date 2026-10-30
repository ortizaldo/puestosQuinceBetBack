import { Router } from "express";
import Events from "schemas/Events";

const router = Router();

// Public calendar data is intentionally limited to published events and fields
// that are useful to visitors. Administrative and operational data stays private.
router.get("/", async (_req, res, next) => {
  try {
    const events = await Events.find({
      deleted: false,
      status: "PUBLISHED",
    })
      .select("nombre fechaEvento arma numGallos pesoMinimo pesoMaximo tolerancia creditos flyer status")
      .sort({ fechaEvento: 1 })
      .lean();

    res.status(200).json({ data: events });
  } catch (error) {
    next(error);
  }
});

export default router;
