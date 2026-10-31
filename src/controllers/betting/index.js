import { Router } from "express";
import { auth, requireRole } from "../../middleware/auth";
import BetOrder from "schemas/BetOrder";
import BetMatch from "schemas/BetMatch";
import Wallet from "schemas/Wallet";
import RoosterFights from "schemas/RoosterFights";
import { cancelPendingBet, createBetOrder, getAdminRecords, getBetDetail, getBetMarket, getBetTransactions, getUserBets, setBettingOpen, settleFight, startFight } from "services/betting";

const router = Router();
const operator = requireRole("ADMIN", "OPERADOR");
function sendError(res, error) {
  const status = error.status || (error.code === 11000 ? 409 : 500);
  res.status(status).json({ success: false, code: error.code || "BETTING_ERROR", message: error.message || "No se pudo completar la operación." });
}
function cents(value) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return NaN;
}

router.post("/fights/:fightId/bets", auth, async (req, res) => {
  try {
    const riskCents = cents(req.body?.riskCents);
    const result = await createBetOrder({ userId: req.user.id, fightId: req.params.fightId, participantSide: req.body?.participantSide, marketType: req.body?.marketType, riskCents });
    res.status(201).json({ success: true, data: result });
  } catch (error) { sendError(res, error); }
});

router.get("/fights/:fightId/bets/market", auth, async (req, res) => {
  try { res.json({ success: true, data: await getBetMarket(req.params.fightId) }); }
  catch (error) { sendError(res, error); }
});

router.get("/fights/:fightId/my-bets", auth, async (req, res) => {
  try {
    const data = await getUserBets(req.user.id, req.params.fightId, { page: req.query.page, limit: req.query.limit });
    const wallet = await Wallet.findOne({ userId: req.user.id }).select("balanceCents reservedBalanceCents inPlayBalanceCents currency").lean();
    res.json({ success: true, data: { ...data, wallet: wallet && { availableBalanceCents: wallet.balanceCents, reservedBalanceCents: wallet.reservedBalanceCents || 0, inPlayBalanceCents: wallet.inPlayBalanceCents || 0, currency: wallet.currency } } });
  } catch (error) { sendError(res, error); }
});

router.get("/fights/open-bets", auth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = { apuestasAbiertas: true, bettingStatus: "OPEN", estado: "PROGRAMADA" };
    const [fights, total] = await Promise.all([RoosterFights.find(filter)
      .populate("event", "nombre fechaEvento")
      .populate("rojo._id", "nombre")
      .populate("verde._id", "nombre")
      .sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), RoosterFights.countDocuments(filter)]);
    res.json({ success: true, data: { items: fights, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) { sendError(res, error); }
});

router.get("/my-bets", auth, async (req, res) => {
  try { res.json({ success: true, data: await getUserBets(req.user.id, null, { page: req.query.page, limit: req.query.limit }) }); }
  catch (error) { sendError(res, error); }
});

router.get("/bets/:betId", auth, async (req, res) => {
  try {
    const isAdmin = ["ADMIN", "OPERADOR"].includes(req.user.role);
    res.json({ success: true, data: await getBetDetail(req.user.id, req.params.betId, isAdmin) });
  } catch (error) { sendError(res, error); }
});

router.post("/bets/:betId/cancel-pending", auth, async (req, res) => {
  try { res.json({ success: true, data: await cancelPendingBet({ userId: req.user.id, betId: req.params.betId }) }); }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/betting/open", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await setBettingOpen({ fightId: req.params.fightId, open: true, actorId: req.user.id }) }); }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/betting/close", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await setBettingOpen({ fightId: req.params.fightId, open: false, actorId: req.user.id }) }); }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/start", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await startFight({ fightId: req.params.fightId, actorId: req.user.id }) }); }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/bets/settle", auth, operator, async (req, res) => {
  try {
    const fightStats = {};
    ["duracionSegundos", "puntuacion", "puntuacionVerde", "puntuacionRojo"].forEach((key) => { if (req.body?.fightStats?.[key] !== undefined) fightStats[key] = req.body.fightStats[key]; });
    res.json({ success: true, data: await settleFight({ fightId: req.params.fightId, outcome: req.body?.outcome, actorId: req.user.id, fightStats }) });
  }
  catch (error) { sendError(res, error); }
});

function filterQuery(query) {
  const out = {};
  ["eventId", "fightId", "userId", "participantSide", "marketType", "status", "from", "to"].forEach((key) => { if (query[key] !== undefined) out[key] = query[key]; });
  return out;
}
router.get("/admin/bets", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await getAdminRecords(BetOrder, { page: req.query.page, limit: req.query.limit, filters: filterQuery(req.query) }) }); }
  catch (error) { sendError(res, error); }
});
router.get("/admin/bet-matches", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await getAdminRecords(BetMatch, { page: req.query.page, limit: req.query.limit, filters: filterQuery(req.query) }) }); }
  catch (error) { sendError(res, error); }
});
router.get("/admin/bet-audit/:referenceId/transactions", auth, operator, async (req, res) => {
  try { res.json({ success: true, data: await getBetTransactions(req.params.referenceId) }); }
  catch (error) { sendError(res, error); }
});

export default router;
