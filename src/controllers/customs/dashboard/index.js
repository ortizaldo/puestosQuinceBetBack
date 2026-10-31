import { Router } from "express";
import mongoose from "mongoose";
import Events from "schemas/Events";
import Roosters from "schemas/Roosters";
import RoosterFights from "schemas/RoosterFights";
import Deposit from "schemas/Deposits";
import Wallet from "schemas/Wallet";
import { auth, requireRole } from "../../../middleware/auth";

const router = Router();
const NO_DELETED = { deleted: { $ne: true } };

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

router.get("/", auth, requireRole("ADMIN", "OPERADOR"), async (req, res) => {
  try {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to, true);
    if (from === undefined || to === undefined || (from && to && from > to)) {
      return res.status(400).json({ success: false, message: "El periodo indicado no es válido." });
    }

    const periodFilter = { ...NO_DELETED };
    if (from || to) periodFilter.fechaEvento = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const eventFilter = { ...periodFilter };
    if (req.query.eventId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.eventId)) {
        return res.status(400).json({ success: false, message: "El evento indicado no es válido." });
      }
      eventFilter._id = req.query.eventId;
    }

    const [events, eventOptions] = await Promise.all([
      Events.find(eventFilter).select("nombre fechaEvento status").sort({ fechaEvento: -1, createdAt: -1 }).lean(),
      Events.find(periodFilter).select("nombre fechaEvento status").sort({ fechaEvento: -1, createdAt: -1 }).lean(),
    ]);
    const eventIds = events.map((event) => event._id);
    const [roosterCounts, fightCounts, recentEvents, pendingDeposits, walletSummary, operationEvent] = await Promise.all([
      eventIds.length ? Roosters.aggregate([
        { $match: { ...NO_DELETED, event: { $in: eventIds } } },
        { $group: { _id: "$event", count: { $sum: 1 } } },
      ]) : [],
      eventIds.length ? RoosterFights.aggregate([
        { $match: { ...NO_DELETED, event: { $in: eventIds } } },
        { $group: { _id: { event: "$event", status: "$estado" }, count: { $sum: 1 } } },
      ]) : [],
      Promise.resolve(events.slice(0, 6)),
      Deposit.aggregate([
        { $match: { status: "pending", currency: "MXN", ...NO_DELETED } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      req.user.role === "ADMIN" ? Wallet.aggregate([
        { $match: { currency: "MXN" } },
        { $group: { _id: null, accountCount: { $sum: 1 }, balanceCents: { $sum: "$balanceCents" } } },
      ]) : Promise.resolve([]),
      Events.findOne({ ...NO_DELETED, status: "IN_PROGRESS" }).select("_id nombre fechaEvento status").sort({ fechaEvento: -1 }).lean(),
    ]);

    const participantsByEvent = new Map(roosterCounts.map((item) => [String(item._id), item.count]));
    const fightsByEvent = new Map();
    const fightStatusTotals = { PROGRAMADA: 0, EN_CURSO: 0, FINALIZADA: 0, CANCELADA: 0 };
    fightCounts.forEach(({ _id, count }) => {
      const key = String(_id.event);
      const perEvent = fightsByEvent.get(key) || { total: 0, byStatus: { ...fightStatusTotals } };
      perEvent.total += count;
      if (perEvent.byStatus[_id.status] !== undefined) perEvent.byStatus[_id.status] += count;
      fightStatusTotals[_id.status] = (fightStatusTotals[_id.status] || 0) + count;
      fightsByEvent.set(key, perEvent);
    });

    const mappedEvents = events.map((event) => {
      const fights = fightsByEvent.get(String(event._id)) || {
        total: 0,
        byStatus: { PROGRAMADA: 0, EN_CURSO: 0, FINALIZADA: 0, CANCELADA: 0 },
      };
      return {
        id: String(event._id),
        name: event.nombre,
        date: event.fechaEvento,
        status: event.status,
        participants: participantsByEvent.get(String(event._id)) || 0,
        fights: fights.total,
        fightsByStatus: fights.byStatus,
      };
    });

    let operation = null;
    if (operationEvent) {
      const operationEventId = String(operationEvent._id);
      const [currentFight, operationFightCounts] = await Promise.all([
        RoosterFights.findOne({ event: operationEvent._id, estado: "EN_CURSO", ...NO_DELETED }).sort({ cotejo: 1 }).select("cotejo ronda estado").lean(),
        RoosterFights.aggregate([
          { $match: { event: operationEvent._id, ...NO_DELETED } },
          { $group: { _id: "$estado", count: { $sum: 1 } } },
        ]),
      ]);
      const nextFight = await RoosterFights.findOne({
        event: operationEvent._id,
        estado: "PROGRAMADA",
        ...NO_DELETED,
        ...(currentFight ? { cotejo: { $gt: currentFight.cotejo } } : {}),
      }).sort({ cotejo: 1 }).select("cotejo ronda estado").lean();
      const progressCounts = Object.fromEntries(operationFightCounts.map(({ _id, count }) => [_id, count]));
      const totalFights = Object.values(progressCounts).reduce((sum, count) => sum + count, 0);
      operation = {
        event: { id: operationEventId, name: operationEvent.nombre },
        currentFight: currentFight ? { number: currentFight.cotejo, round: currentFight.ronda } : null,
        nextFight: nextFight ? { number: nextFight.cotejo, round: nextFight.ronda } : null,
        progress: { completed: progressCounts.FINALIZADA || 0, total: totalFights },
      };
    }

    const eventStatusCounts = events.reduce((counts, event) => {
      if (event.status === "DRAFT") counts.draft += 1;
      else if (event.status === "PUBLISHED" || event.status === "OPEN") counts.published += 1;
      else if (event.status === "IN_PROGRESS") counts.inProgress += 1;
      else if (event.status === "FINISHED") counts.finished += 1;
      else if (event.status === "CANCELLED") counts.cancelled += 1;
      return counts;
    }, { draft: 0, published: 0, inProgress: 0, finished: 0, cancelled: 0 });
    const result = {
      filters: { from: from || null, to: to || null, eventId: req.query.eventId || null },
      metrics: {
        events: { total: events.length, byStatus: eventStatusCounts },
        participants: { total: [...participantsByEvent.values()].reduce((sum, count) => sum + count, 0) },
        fights: { total: [...fightsByEvent.values()].reduce((sum, item) => sum + item.total, 0), byStatus: fightStatusTotals },
        pendingDeposits: { count: pendingDeposits[0]?.count || 0, amount: pendingDeposits[0]?.amount || 0, currency: "MXN" },
      },
      recentEvents: mappedEvents.slice(0, 6),
      eventOptions: eventOptions.map((event) => ({ id: String(event._id), name: event.nombre, date: event.fechaEvento, status: event.status })),
      operation,
    };
    if (req.user.role === "ADMIN") {
      result.metrics.wallet = {
        accountCount: walletSummary[0]?.accountCount || 0,
        balance: (walletSummary[0]?.balanceCents || 0) / 100,
        currency: "MXN",
      };
    }
    return res.json({ data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "No fue posible cargar el resumen del dashboard." });
  }
});

export default router;
