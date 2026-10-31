import { Router } from "express";
import Events from "schemas/Events";
import RoosterFights from "schemas/RoosterFights";
import User from "schemas/Users";
import LiveChatMessage from "schemas/LiveChatMessage";
import { auth } from "../../middleware/auth";
import { publishRealtimeChange } from "../../modules/realtime";

const router = Router();

router.get("/events", auth, async (_req, res, next) => {
  try {
    const events = await Events.find({ status: "IN_PROGRESS", deleted: { $ne: true } })
      .select("nombre fechaEvento arma streamUrl status")
      .sort({ fechaEvento: -1 })
      .lean();
    const items = await Promise.all(events.map(async (event) => {
      const fights = await RoosterFights.find({
        event: event._id,
        deleted: { $ne: true },
        estado: { $in: ["PROGRAMADA", "EN_CURSO", "FINALIZADA"] },
      })
        .select("cotejo ronda estado resultado puntuacionRojo puntuacionVerde duracionSegundos rojo verde apuestasAbiertas bettingStatus")
        .populate("rojo._id", "nombre")
        .populate("verde._id", "nombre")
        .sort({ ronda: 1, cotejo: 1 })
        .lean();
      return { ...event, fights };
    }));
    res.json({ success: true, data: { items } });
  } catch (error) { next(error); }
});

router.get("/events/:eventId/chat", auth, async (req, res, next) => {
  try {
    const event = await Events.findOne({ _id: req.params.eventId, status: "IN_PROGRESS", deleted: { $ne: true } }).select("_id").lean();
    if (!event) return res.status(404).json({ success: false, message: "El evento no está disponible en vivo." });
    const messages = await LiveChatMessage.find({ eventId: event._id }).sort({ createdAt: -1 }).limit(80).lean();
    res.json({ success: true, data: messages.reverse() });
  } catch (error) { next(error); }
});

router.post("/events/:eventId/chat", auth, async (req, res, next) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message || message.length > 500) return res.status(400).json({ success: false, message: "Escribe un mensaje de hasta 500 caracteres." });
    const event = await Events.findOne({ _id: req.params.eventId, status: "IN_PROGRESS", deleted: { $ne: true } }).select("_id").lean();
    if (!event) return res.status(404).json({ success: false, message: "El evento no está disponible en vivo." });
    const user = await User.findById(req.user.id).select("firstName lastName email").lean();
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    const username = (fullName || user?.email?.split("@")[0] || "Apostador").slice(0, 60);
    const saved = await LiveChatMessage.create({ eventId: event._id, userId: req.user.id, username, message });
    const data = { _id: saved._id, eventId: saved.eventId, username: saved.username, message: saved.message, createdAt: saved.createdAt };
    publishRealtimeChange("live-chat", "message", { eventId: String(event._id) });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
});

export default router;
