import { Router } from "express";
import { auth, requireRole } from "../../middleware/auth";
import BetOrder from "schemas/BetOrder";
import BetMatch from "schemas/BetMatch";
import Wallet from "schemas/Wallet";
import RoosterFights from "schemas/RoosterFights";
import BettingConfig from "schemas/BettingConfig";
import { cancelPendingBet, createBetOrder, getAdminRecords, getBetDetail, getBetMarket, getBetTransactions, getConfiguredCommissionBps, getMinimumBetCents, getUserBets, setBettingOpen, settleFight, startFight } from "services/betting";
import { publishRealtimeChange } from "../../modules/realtime";

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
    publishRealtimeChange("bets", "created");
    publishRealtimeChange("wallet", "updated");
    res.status(201).json({ success: true, data: result });
  } catch (error) { sendError(res, error); }
});

router.get("/fights/:fightId/bets/context", auth, async (req, res) => {
  try {
    const [fight, wallet] = await Promise.all([
      RoosterFights.findById(req.params.fightId)
        .populate("event", "nombre fechaEvento")
        .populate("rojo._id", "nombre")
        .populate("verde._id", "nombre")
        .lean(),
      Wallet.findOne({ userId: req.user.id }).select("balanceCents reservedBalanceCents inPlayBalanceCents currency").lean(),
    ]);
    if (!fight) {
      const error = new Error("No se encontró la pelea."); error.status = 404; error.code = "FIGHT_NOT_FOUND"; throw error;
    }
    res.json({ success: true, data: {
      fight,
      event: fight.event || null,
      wallet: wallet && {
        availableBalanceCents: wallet.balanceCents || 0,
        reservedBalanceCents: wallet.reservedBalanceCents || 0,
        inPlayBalanceCents: wallet.inPlayBalanceCents || 0,
        currency: wallet.currency,
      },
    } });
  } catch (error) { sendError(res, error); }
});

router.get("/admin/betting-config", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const [minimumBetCents, commissionBps] = await Promise.all([getMinimumBetCents(), getConfiguredCommissionBps()]);
    res.json({ success: true, data: { minimumBetCents, commissionBps } });
  } catch (error) { sendError(res, error); }
});

router.put("/admin/betting-config", auth, requireRole("ADMIN"), async (req, res) => {
  try {
    const minimumBetCents = cents(req.body?.minimumBetCents);
    const commissionBps = cents(req.body?.commissionBps);
    if (!Number.isSafeInteger(minimumBetCents) || minimumBetCents < 100 || minimumBetCents > 1000000000 || minimumBetCents % 100 !== 0) {
      const error = new Error("El mínimo debe ser un monto entero en pesos entre $1 y $10,000,000."); error.status = 400; error.code = "INVALID_MINIMUM_BET"; throw error;
    }
    if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
      const error = new Error("La comisión debe ser un porcentaje entre 0% y 100% con hasta dos decimales."); error.status = 400; error.code = "INVALID_BET_COMMISSION"; throw error;
    }
    const config = await BettingConfig.findByIdAndUpdate("global", {
      $set: { minimumBetCents, commissionBps, updatedBy: req.user.id },
    }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
    publishRealtimeChange("bets", "minimum_updated");
    res.json({ success: true, data: { minimumBetCents: config.minimumBetCents, commissionBps: config.commissionBps } });
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
  try {
    const data = await cancelPendingBet({ userId: req.user.id, betId: req.params.betId });
    publishRealtimeChange("bets", "cancelled");
    publishRealtimeChange("wallet", "updated");
    res.json({ success: true, data });
  }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/betting/open", auth, operator, async (req, res) => {
  try {
    const data = await setBettingOpen({ fightId: req.params.fightId, open: true, actorId: req.user.id });
    publishRealtimeChange("fights", "betting_opened");
    publishRealtimeChange("bets", "market_updated");
    res.json({ success: true, data });
  }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/betting/close", auth, operator, async (req, res) => {
  try {
    const data = await setBettingOpen({ fightId: req.params.fightId, open: false, actorId: req.user.id });
    publishRealtimeChange("fights", "betting_closed");
    publishRealtimeChange("bets", "market_updated");
    publishRealtimeChange("wallet", "updated");
    res.json({ success: true, data });
  }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/start", auth, operator, async (req, res) => {
  try {
    const data = await startFight({ fightId: req.params.fightId, actorId: req.user.id });
    publishRealtimeChange("fights", "started");
    res.json({ success: true, data });
  }
  catch (error) { sendError(res, error); }
});

router.post("/fights/:fightId/bets/settle", auth, operator, async (req, res) => {
  try {
    const fightStats = {};
    ["duracionSegundos", "puntuacion", "puntuacionVerde", "puntuacionRojo"].forEach((key) => { if (req.body?.fightStats?.[key] !== undefined) fightStats[key] = req.body.fightStats[key]; });
    const data = await settleFight({ fightId: req.params.fightId, outcome: req.body?.outcome, actorId: req.user.id, fightStats });
    publishRealtimeChange("fights", "settled");
    publishRealtimeChange("bets", "settled");
    publishRealtimeChange("wallet", "updated");
    res.json({ success: true, data });
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
