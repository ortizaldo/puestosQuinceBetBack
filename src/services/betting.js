import mongoose from "mongoose";
import BetOrder from "schemas/BetOrder";
import BetMatch from "schemas/BetMatch";
import Wallet from "schemas/Wallet";
import WalletTransaction from "schemas/WalletTransaction";
import User from "schemas/Users";
import RoosterFights from "schemas/RoosterFights";
import BettingConfig from "schemas/BettingConfig";
import { compatibleMarket, compatibleSide, commissionForProfit, matchedRisks, orderStatus, profitForRisk } from "./bet-calculations";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const oid = (value) => new mongoose.Types.ObjectId(value);
const closedBettingStatus = { $or: [
  { bettingStatus: { $in: ["CLOSED", "BETTING_CLOSED"] } },
  { bettingStatus: { $exists: false } },
  { bettingStatus: null },
] };
function configuredCommissionRate(existingRate = null, fallbackRate = null) {
  if (Number.isInteger(existingRate) && existingRate >= 0 && existingRate <= 10000) return existingRate;
  if (Number.isInteger(fallbackRate) && fallbackRate >= 0 && fallbackRate <= 10000) return fallbackRate;
  const configured = Number(process.env.BET_COMMISSION_BPS || 0);
  if (!Number.isInteger(configured) || configured < 0 || configured > 10000) throw fail(500, "INVALID_COMMISSION_CONFIG", "BET_COMMISSION_BPS debe ser un entero entre 0 y 10000.");
  return configured;
}

export async function getConfiguredCommissionBps() {
  const config = await BettingConfig.findById("global").select("commissionBps").lean();
  if (config?.commissionBps !== undefined && config?.commissionBps !== null) return configuredCommissionRate(config.commissionBps);
  return configuredCommissionRate();
}

export async function getMinimumBetCents() {
  const config = await BettingConfig.findById("global").select("minimumBetCents").lean();
  return config?.minimumBetCents || 100;
}

function minimumForMarket(marketType, configuredMinimumCents) {
  const unit = marketType === "GIVE_80" ? 10000 : marketType === "TAKE_80" ? 8000 : 100;
  const minimum = Math.max(configuredMinimumCents, unit);
  return Math.ceil(minimum / unit) * unit;
}

function validateRisk(marketType, amount, configuredMinimumCents) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail(400, "INVALID_RISK", "La cantidad debe ser un entero positivo en centavos.");
  const minimum = minimumForMarket(marketType, configuredMinimumCents);
  if (amount < minimum) throw fail(400, "RISK_TOO_SMALL", `El riesgo mínimo para esta modalidad es de ${minimum} centavos.`);
  try { profitForRisk(marketType, amount); } catch (error) { throw fail(400, "INVALID_RISK_UNIT", error.message); }
  if (amount > 100000000000) throw fail(400, "RISK_TOO_LARGE", "La cantidad supera el máximo permitido.");
}

async function changeWallet({ userId, deltas, amountCents, type, referenceType, referenceId, eventId, fightId, idempotencyKey, metadata = {}, performedBy = null, session }) {
  let wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) throw fail(409, "WALLET_NOT_FOUND", "No se encontró la wallet del usuario.");
  await Wallet.collection.updateOne({ _id: wallet._id }, [{ $set: { reservedBalanceCents: { $ifNull: ["$reservedBalanceCents", 0] }, inPlayBalanceCents: { $ifNull: ["$inPlayBalanceCents", 0] } } }], { session });
  wallet = await Wallet.findById(wallet._id).session(session);
  const before = {
    available: wallet.balanceCents || 0,
    reserved: wallet.reservedBalanceCents || 0,
    inPlay: wallet.inPlayBalanceCents || 0,
  };
  const after = { available: before.available + (deltas.available || 0), reserved: before.reserved + (deltas.reserved || 0), inPlay: before.inPlay + (deltas.inPlay || 0) };
  if (Object.values(after).some((n) => !Number.isSafeInteger(n) || n < 0 || n > MAX_SAFE)) throw fail(409, "WALLET_BALANCE_INVALID", "La operación no es compatible con los saldos de la wallet.");
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, balanceCents: before.available, reservedBalanceCents: before.reserved, inPlayBalanceCents: before.inPlay },
    { $inc: { balanceCents: deltas.available || 0, reservedBalanceCents: deltas.reserved || 0, inPlayBalanceCents: deltas.inPlay || 0 } },
    { new: true, session, runValidators: true },
  );
  if (!updated) throw fail(409, "WALLET_CONCURRENT_CHANGE", "El saldo cambió durante la operación. Intenta nuevamente.");
  await WalletTransaction.create([{
    walletId: wallet._id,
    userId,
    type,
    amountCents,
    balanceBeforeCents: before.available,
    balanceAfterCents: after.available,
    source: "BETTING",
    reference: String(referenceId),
    description: type,
    performedBy,
    requestId: idempotencyKey,
    idempotencyKey,
    referenceType,
    referenceId,
    eventId,
    fightId,
    metadata: { bucketsBefore: before, bucketsAfter: after, ...metadata },
  }], { session });
  return { availableBalance: after.available, reservedBalance: after.reserved, inPlayBalance: after.inPlay };
}

async function moveRisk({ order, riskCents, type, session, referenceType, referenceId, performedBy }) {
  return changeWallet({
    userId: order.userId,
    deltas: { reserved: -riskCents, inPlay: riskCents },
    amountCents: riskCents,
    type,
    referenceType,
    referenceId,
    eventId: order.eventId,
    fightId: order.fightId,
    idempotencyKey: `${type}:${referenceId}:${order._id}`,
    metadata: { orderId: order._id, riskCents },
    performedBy,
    session,
  });
}

function updateOrderMatch(order, riskCents) {
  order.matchedRiskAmount += riskCents;
  order.pendingRiskAmount -= riskCents;
  order.status = orderStatus(order);
}

function privateMatch(match, userId) {
  const isRed = String(match.redUserId) === String(userId);
  return {
    _id: match._id,
    eventId: match.eventId,
    fightId: match.fightId,
    marketType: match.marketType,
    orderId: isRed ? match.redOrderId : match.greenOrderId,
    myRiskAmount: isRed ? match.redRiskAmount : match.greenRiskAmount,
    myPotentialProfit: isRed ? match.redPotentialProfit : match.greenPotentialProfit,
    status: match.status,
    settledAt: match.settledAt,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}

export async function createBetOrder({ userId, fightId, participantSide, marketType, riskCents }) {
  if (!validId(fightId)) throw fail(400, "INVALID_FIGHT_ID", "Identificador de pelea inválido.");
  if (!["RED", "GREEN"].includes(participantSide)) throw fail(400, "INVALID_SIDE", "Selecciona rojo o verde.");
  if (!["EVEN", "GIVE_80", "TAKE_80"].includes(marketType)) throw fail(400, "INVALID_MARKET", "Modalidad de apuesta inválida.");
  validateRisk(marketType, riskCents, await getMinimumBetCents());
  const user = await User.findById(userId).select("status");
  if (!user || user.status !== "ACTIVE") throw fail(403, "USER_NOT_ACTIVE", "La cuenta debe estar activa para apostar.");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) throw fail(409, "WALLET_NOT_FOUND", "No se encontró la wallet del usuario.");
      await Wallet.collection.updateOne({ _id: wallet._id }, [{ $set: { reservedBalanceCents: { $ifNull: ["$reservedBalanceCents", 0] }, inPlayBalanceCents: { $ifNull: ["$inPlayBalanceCents", 0] } } }], { session });
      const normalizedWallet = await Wallet.findById(wallet._id).session(session);
      const reserved = await Wallet.findOneAndUpdate(
        { _id: wallet._id, balanceCents: { $gte: riskCents }, reservedBalanceCents: { $lte: MAX_SAFE - riskCents } },
        { $inc: { balanceCents: -riskCents, reservedBalanceCents: riskCents } },
        { new: true, session, runValidators: true },
      );
      if (!reserved) throw fail(409, "INSUFFICIENT_BALANCE", "Saldo disponible insuficiente.");
      const fight = await RoosterFights.findOneAndUpdate(
        { _id: fightId, apuestasAbiertas: true, bettingStatus: "OPEN", estado: "PROGRAMADA" },
        { $inc: { bettingVersion: 1 } },
        { new: true, session },
      );
      if (!fight) throw fail(409, "BETTING_CLOSED", "La pelea no acepta apuestas en este momento.");
      const orderId = new mongoose.Types.ObjectId();
      const [order] = await BetOrder.create([{
        _id: orderId,
        userId,
        eventId: fight.event,
        fightId: fight._id,
        participantSide,
        marketType,
        requestedRiskAmount: riskCents,
        matchedRiskAmount: 0,
        pendingRiskAmount: riskCents,
        potentialGrossProfit: profitForRisk(marketType, riskCents),
        status: "PENDING",
        sequence: fight.bettingVersion,
        openedAt: new Date(),
      }], { session });
      await WalletTransaction.create([{
        walletId: reserved._id, userId, type: "BET_RESERVE", amountCents: riskCents,
        balanceBeforeCents: normalizedWallet.balanceCents, balanceAfterCents: reserved.balanceCents,
        source: "BETTING", reference: String(order._id), description: "Reserva de riesgo de apuesta",
        referenceType: "BetOrder", referenceId: order._id, eventId: fight.event, fightId: fight._id,
        idempotencyKey: `BET_RESERVE:${order._id}`, requestId: `BET_RESERVE:${order._id}`, performedBy: userId,
        metadata: { entryKind: "RESERVE", availableBefore: normalizedWallet.balanceCents, availableAfter: reserved.balanceCents, reservedBefore: normalizedWallet.reservedBalanceCents || 0, reservedAfter: reserved.reservedBalanceCents, riskCents },
      }], { session });

      const oppositeSide = compatibleSide(participantSide);
      const oppositeMarket = compatibleMarket(marketType);
      const candidates = await BetOrder.find({
        fightId: fight._id, participantSide: oppositeSide,
        marketType: oppositeMarket,
        status: { $in: ["PENDING", "PARTIALLY_MATCHED"] },
        pendingRiskAmount: { $gt: 0 }, userId: { $ne: userId },
      }).sort({ createdAt: 1, _id: 1 }).session(session);

      let ownWalletSnapshot = { availableBalance: reserved.balanceCents, reservedBalance: reserved.reservedBalanceCents, inPlayBalance: reserved.inPlayBalanceCents || 0 };
      const matches = [];
      for (const candidate of candidates) {
        if (order.pendingRiskAmount <= 0) break;
        const amounts = matchedRisks(order.marketType, order.pendingRiskAmount, candidate.marketType, candidate.pendingRiskAmount);
        if (amounts.ownRiskCents <= 0) continue;
        const red = order.participantSide === "RED" ? order : candidate;
        const green = order.participantSide === "GREEN" ? order : candidate;
        const redRisk = red === order ? amounts.ownRiskCents : amounts.oppositeRiskCents;
        const greenRisk = green === order ? amounts.ownRiskCents : amounts.oppositeRiskCents;
        const [match] = await BetMatch.create([{
          eventId: fight.event, fightId: fight._id,
          marketType: marketType === "EVEN" ? "EVEN" : "LINE_80",
          redOrderId: red._id, greenOrderId: green._id,
          redUserId: red.userId, greenUserId: green.userId,
          redRiskAmount: redRisk, greenRiskAmount: greenRisk,
          redPotentialProfit: profitForRisk(red.marketType, redRisk),
          greenPotentialProfit: profitForRisk(green.marketType, greenRisk),
          status: "OPEN",
        }], { session });
        updateOrderMatch(order, amounts.ownRiskCents);
        updateOrderMatch(candidate, amounts.oppositeRiskCents);
        await candidate.save({ session });
        await order.save({ session });
        const ownSnapshot = await moveRisk({ order, riskCents: amounts.ownRiskCents, type: "BET_MATCHED", session, referenceType: "BetMatch", referenceId: match._id, performedBy: userId });
        await moveRisk({ order: candidate, riskCents: amounts.oppositeRiskCents, type: "BET_MATCHED", session, referenceType: "BetMatch", referenceId: match._id, performedBy: userId });
        ownWalletSnapshot = ownSnapshot;
        matches.push(match);
      }
      await order.save({ session });
      result = { order: order.toObject(), matches: matches.map((match) => privateMatch(match, userId)), wallet: ownWalletSnapshot };
    });
    return result;
  } finally { await session.endSession(); }
}

export async function cancelPendingBet({ userId, betId }) {
  if (!validId(betId)) throw fail(400, "INVALID_BET_ID", "Identificador de apuesta inválido.");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await BetOrder.findOne({ _id: betId, userId }).session(session);
      if (!order) throw fail(404, "BET_NOT_FOUND", "No se encontró la apuesta.");
      if (order.pendingRiskAmount <= 0 || !["PENDING", "PARTIALLY_MATCHED"].includes(order.status)) throw fail(409, "NO_PENDING_RISK", "La apuesta no tiene importe pendiente por cancelar.");
      const fight = await RoosterFights.findOne({ _id: order.fightId, apuestasAbiertas: true, bettingStatus: "OPEN" }).session(session);
      if (!fight) throw fail(409, "BETTING_CLOSED", "Las apuestas ya están cerradas.");
      const lock = await RoosterFights.updateOne({ _id: fight._id, apuestasAbiertas: true, bettingStatus: "OPEN", bettingVersion: fight.bettingVersion }, { $inc: { bettingVersion: 1 } }, { session });
      if (!lock.modifiedCount) throw fail(409, "BETTING_CHANGED", "El estado de apuestas cambió. Actualiza e intenta nuevamente.");
      const amount = order.pendingRiskAmount;
      const wallet = await changeWallet({
        userId, deltas: { available: amount, reserved: -amount }, amountCents: amount,
        type: "BET_CANCEL_RELEASE", referenceType: "BetOrder", referenceId: order._id,
        eventId: order.eventId, fightId: order.fightId, idempotencyKey: `BET_CANCEL_RELEASE:${order._id}`,
        metadata: { orderId: order._id, releasedRiskCents: amount }, performedBy: userId, session,
      });
      order.pendingRiskAmount = 0;
      order.status = order.matchedRiskAmount > 0 ? "CLOSED_PARTIALLY_MATCHED" : "CANCELLED";
      order.cancelledAt = new Date();
      order.closedAt = order.cancelledAt;
      await order.save({ session });
      result = { order: order.toObject(), wallet };
    });
    return result;
  } finally { await session.endSession(); }
}

export async function setBettingOpen({ fightId, open, actorId }) {
  if (!validId(fightId)) throw fail(400, "INVALID_FIGHT_ID", "Identificador de pelea inválido.");
  const configuredBps = open ? await getConfiguredCommissionBps() : null;
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      if (open) {
        const current = await RoosterFights.findById(fightId).select("bettingCommissionBps").session(session);
        if (!current) throw fail(404, "FIGHT_NOT_FOUND", "No se encontró la pelea.");
        const hasExistingMatches = await BetMatch.exists({ fightId }).session(session);
        const commissionBps = hasExistingMatches
          ? configuredCommissionRate(current.bettingCommissionBps, configuredBps)
          : configuredBps;
        const fight = await RoosterFights.findOneAndUpdate(
          { _id: fightId, estado: "PROGRAMADA", ...closedBettingStatus, apuestasAbiertas: { $ne: true } },
          { $set: { bettingStatus: "OPEN", apuestasAbiertas: true, bettingClosedAt: null, bettingCommissionBps: commissionBps }, $inc: { bettingVersion: 1 } },
          { new: true, session, runValidators: true },
        );
        if (!fight) throw fail(409, "CANNOT_OPEN_BETTING", "No se puede abrir apuestas para esta pelea.");
        result = { fight, openedBy: actorId };
        return;
      }
      const fight = await RoosterFights.findOneAndUpdate(
        { _id: fightId, apuestasAbiertas: true, $or: [{ bettingStatus: "OPEN" }, { bettingStatus: { $exists: false } }, { bettingStatus: null }] },
        { $set: { apuestasAbiertas: false, bettingStatus: "BETTING_CLOSED", bettingClosedAt: new Date() }, $inc: { bettingVersion: 1 } },
        { new: true, session },
      );
      if (!fight) throw fail(409, "BETTING_ALREADY_CLOSED", "La pelea ya tiene las apuestas cerradas.");
      const orders = await BetOrder.find({ fightId, status: { $in: ["PENDING", "PARTIALLY_MATCHED"] }, pendingRiskAmount: { $gt: 0 } }).session(session);
      let releasedCents = 0;
      let affected = 0;
      for (const order of orders) {
        const amount = order.pendingRiskAmount;
        await changeWallet({
          userId: order.userId, deltas: { available: amount, reserved: -amount }, amountCents: amount,
          type: "BET_RELEASE", referenceType: "BetOrder", referenceId: order._id,
          eventId: order.eventId, fightId: order.fightId, idempotencyKey: `BET_RELEASE:${order._id}`,
          metadata: { orderId: order._id, releasedRiskCents: amount }, performedBy: actorId, session,
        });
        releasedCents += amount;
        order.pendingRiskAmount = 0;
        order.status = order.matchedRiskAmount > 0 ? "CLOSED_PARTIALLY_MATCHED" : "CLOSED_UNMATCHED";
        order.closedAt = new Date();
        await order.save({ session });
        affected += 1;
      }
      await BetOrder.updateMany({ fightId, status: "MATCHED" }, { $set: { status: "IN_PLAY", closedAt: new Date() } }, { session });
      await BetMatch.updateMany({ fightId, status: "OPEN" }, { $set: { status: "IN_PLAY" } }, { session });
      const matches = await BetMatch.find({ fightId }).session(session);
      const totalMatchedCents = matches.reduce((sum, match) => sum + match.redRiskAmount + match.greenRiskAmount, 0);
      result = { fight, totalMatchedCents, releasedCents, affectedOrders: affected, openMatches: matches.length };
    });
    return result;
  } finally { await session.endSession(); }
}

export async function startFight({ fightId, actorId }) {
  if (!validId(fightId)) throw fail(400, "INVALID_FIGHT_ID", "Identificador de pelea inválido.");
  const session = await mongoose.startSession();
  let fight;
  try {
    await session.withTransaction(async () => {
      fight = await RoosterFights.findOneAndUpdate(
        { _id: fightId, estado: "PROGRAMADA", apuestasAbiertas: { $ne: true }, ...closedBettingStatus },
        { $set: { estado: "EN_CURSO" }, $inc: { bettingVersion: 1 } },
        { new: true, session, runValidators: true },
      );
      if (!fight) throw fail(409, "CANNOT_START_FIGHT", "Cierra las apuestas antes de iniciar la pelea.");
    });
    return { fight, startedBy: actorId };
  } finally { await session.endSession(); }
}

export async function settleFight({ fightId, outcome, actorId, fightStats = {} }) {
  const outcomes = { RED: "RED", GREEN: "GREEN", DRAW: "DRAW", CANCELLED: "CANCELLED", NO_CONTEST: "CANCELLED" };
  if (!validId(fightId)) throw fail(400, "INVALID_FIGHT_ID", "Identificador de pelea inválido.");
  if (!outcomes[outcome]) throw fail(400, "INVALID_OUTCOME", "Resultado de liquidación inválido.");
  if (fightStats.duracionSegundos !== undefined && (!Number.isSafeInteger(fightStats.duracionSegundos) || fightStats.duracionSegundos < 0)) throw fail(400, "INVALID_FIGHT_STATS", "La duración debe ser un entero no negativo.");
  if (fightStats.puntuacion !== undefined && !["0", "1", "3"].includes(String(fightStats.puntuacion))) throw fail(400, "INVALID_FIGHT_STATS", "La puntuación de pelea no es válida.");
  for (const key of ["puntuacionVerde", "puntuacionRojo"]) if (fightStats[key] !== undefined && ![0, 1, 3].includes(fightStats[key])) throw fail(400, "INVALID_FIGHT_STATS", "La puntuación de pelea no es válida.");
  const normalized = outcomes[outcome];
  const configuredBps = await getConfiguredCommissionBps();
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const fight = await RoosterFights.findOneAndUpdate(
        { _id: fightId, apuestasAbiertas: { $ne: true }, ...closedBettingStatus },
        { $set: { bettingStatus: "SETTLED", ...(normalized === "CANCELLED" ? { estado: "CANCELADA" } : { resultado: normalized === "RED" ? "ROJO" : normalized === "GREEN" ? "VERDE" : "TABLAS", estado: "FINALIZADA" }), ...fightStats }, $inc: { bettingVersion: 1 } },
        { new: true, session, runValidators: true },
      );
      if (!fight) {
        const prior = await RoosterFights.findById(fightId).session(session);
        if (prior?.bettingStatus === "SETTLED") throw fail(409, "ALREADY_SETTLED", "Esta pelea ya fue liquidada.");
        throw fail(409, "BETTING_NOT_CLOSED", "Cierra las apuestas antes de liquidar.");
      }
      const matches = await BetMatch.find({ fightId, status: "IN_PLAY" }).sort({ createdAt: 1, _id: 1 }).session(session);
      const hasRefund = normalized === "DRAW" || normalized === "CANCELLED";
      const bps = configuredCommissionRate(fight.bettingCommissionBps, configuredBps);
      let winningCents = 0;
      let refundedCents = 0;
      for (const match of matches) {
        const refund = hasRefund;
        const redWins = normalized === "RED";
        const winnerUser = redWins ? match.redUserId : match.greenUserId;
        const loserUser = redWins ? match.greenUserId : match.redUserId;
        const winnerRisk = redWins ? match.redRiskAmount : match.greenRiskAmount;
        const loserRisk = redWins ? match.greenRiskAmount : match.redRiskAmount;
        const winnerProfit = redWins ? match.redPotentialProfit : match.greenPotentialProfit;
        const redOrder = await BetOrder.findById(match.redOrderId).session(session);
        const greenOrder = await BetOrder.findById(match.greenOrderId).session(session);
        if (refund) {
          for (const [userId, risk, order] of [[match.redUserId, match.redRiskAmount, redOrder], [match.greenUserId, match.greenRiskAmount, greenOrder]]) {
            await changeWallet({ userId, deltas: { available: risk, inPlay: -risk }, amountCents: risk, type: normalized === "DRAW" ? "BET_DRAW_REFUND" : "BET_FIGHT_REFUND", referenceType: "BetMatch", referenceId: match._id, eventId: match.eventId, fightId, idempotencyKey: `${normalized}_REFUND:${match._id}:${userId}`, metadata: { orderId: order?._id, returnedCapitalCents: risk }, performedBy: actorId, session });
            refundedCents += risk;
          }
          match.status = normalized === "DRAW" ? "DRAW" : "REFUNDED";
        } else {
          const commission = commissionForProfit(winnerProfit, bps);
          const netProfit = winnerProfit - commission;
          await changeWallet({ userId: winnerUser, deltas: { available: winnerRisk, inPlay: -winnerRisk }, amountCents: winnerRisk, type: "BET_WIN", referenceType: "BetMatch", referenceId: match._id, eventId: match.eventId, fightId, idempotencyKey: `BET_PRINCIPAL:${match._id}:${winnerUser}`, metadata: { entryKind: "RETURNED_CAPITAL", returnedCapitalCents: winnerRisk, orderId: redWins ? redOrder?._id : greenOrder?._id }, performedBy: actorId, session });
          if (winnerProfit) await changeWallet({ userId: winnerUser, deltas: { available: winnerProfit }, amountCents: winnerProfit, type: "BET_WIN", referenceType: "BetMatch", referenceId: match._id, eventId: match.eventId, fightId, idempotencyKey: `BET_PROFIT:${match._id}:${winnerUser}`, metadata: { entryKind: "GROSS_PROFIT", grossProfitCents: winnerProfit }, performedBy: actorId, session });
          if (commission) await changeWallet({ userId: winnerUser, deltas: { available: -commission }, amountCents: commission, type: "BET_COMMISSION", referenceType: "BetMatch", referenceId: match._id, eventId: match.eventId, idempotencyKey: `BET_COMMISSION:${match._id}:${winnerUser}`, metadata: { commissionCents: commission, grossProfitCents: winnerProfit }, performedBy: actorId, session });
          await changeWallet({ userId: loserUser, deltas: { inPlay: -loserRisk }, amountCents: loserRisk, type: "BET_LOSS", referenceType: "BetMatch", referenceId: match._id, eventId: match.eventId, idempotencyKey: `BET_LOSS:${match._id}:${loserUser}`, metadata: { lostRiskCents: loserRisk }, performedBy: actorId, session });
          const winOrder = redWins ? redOrder : greenOrder;
          const lossOrder = redWins ? greenOrder : redOrder;
          if (winOrder) { winOrder.status = "WON"; winOrder.settledAt = new Date(); await winOrder.save({ session }); }
          if (lossOrder) { lossOrder.status = "LOST"; lossOrder.settledAt = new Date(); await lossOrder.save({ session }); }
          winningCents += winnerRisk + netProfit;
          match.status = redWins ? "WON_RED" : "WON_GREEN";
        }
        match.settledAt = new Date();
        await match.save({ session });
      }
      if (hasRefund) {
        await BetOrder.updateMany({ fightId, matchedRiskAmount: { $gt: 0 } }, { $set: { status: "REFUNDED", settledAt: new Date() } }, { session });
      }
      result = { fight, settledMatches: matches.length, outcome: normalized, winningPayoutCents: winningCents, refundedCents, settledBy: actorId };
    });
    return result;
  } finally { await session.endSession(); }
}

export async function getBetMarket(fightId) {
  if (!validId(fightId)) throw fail(400, "INVALID_FIGHT_ID", "Identificador de pelea inválido.");
  const [fight, orders, matches, minimumBetCents, configuredBps] = await Promise.all([
    RoosterFights.findById(fightId).select("bettingCommissionBps").lean(),
    BetOrder.aggregate([{ $match: { fightId: oid(fightId), status: { $in: ["PENDING", "PARTIALLY_MATCHED"] } } }, { $group: { _id: { side: "$participantSide", market: "$marketType" }, pendingCents: { $sum: "$pendingRiskAmount" }, matchedCents: { $sum: "$matchedRiskAmount" }, orders: { $sum: 1 } } }]),
    BetMatch.aggregate([{ $match: { fightId: oid(fightId) } }, { $group: { _id: "$status", redCents: { $sum: "$redRiskAmount" }, greenCents: { $sum: "$greenRiskAmount" }, count: { $sum: 1 } } }]),
    getMinimumBetCents(),
    getConfiguredCommissionBps(),
  ]);
  if (!fight) throw fail(404, "FIGHT_NOT_FOUND", "No se encontró la pelea.");
  if (!fight) throw fail(404, "FIGHT_NOT_FOUND", "No se encontró la pelea.");
  const commissionBps = configuredCommissionRate(fight.bettingCommissionBps, configuredBps);
  return { orders, matches, commissionBps, minimumBetCents };
}

export async function getUserBets(userId, fightId, { page = 1, limit = 100 } = {}) {
  const filter = { userId };
  if (fightId) filter.fightId = fightId;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const [orders, total] = await Promise.all([
    BetOrder.find(filter).sort({ createdAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    BetOrder.countDocuments(filter),
  ]);
  const ids = orders.map((order) => order._id);
  const matches = await BetMatch.find({ $or: [{ redOrderId: { $in: ids } }, { greenOrderId: { $in: ids } }] }).sort({ createdAt: 1 }).lean();
  return { orders, matches: matches.map((match) => privateMatch(match, userId)), total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };
}

export async function getBetDetail(userId, betId, isAdmin = false) {
  const filter = { _id: betId };
  if (!isAdmin) filter.userId = userId;
  const order = await BetOrder.findOne(filter).lean();
  if (!order) throw fail(404, "BET_NOT_FOUND", "No se encontró la apuesta.");
  const matches = await BetMatch.find({ $or: [{ redOrderId: order._id }, { greenOrderId: order._id }] }).sort({ createdAt: 1 }).lean();
  return { ...order, matches: isAdmin ? matches : matches.map((match) => privateMatch(match, userId)) };
}

export async function getAdminRecords(model, { page = 1, limit = 25, filters = {} }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const query = {};
  ["eventId", "fightId", "userId", "participantSide", "marketType", "status"].forEach((key) => { if (filters[key] && !(key === "userId" && model === BetMatch)) query[key] = filters[key]; });
  if (model === BetMatch && ["GIVE_80", "TAKE_80"].includes(filters.marketType)) query.marketType = "LINE_80";
  if (filters.from || filters.to) query.createdAt = {};
  if (filters.from) query.createdAt.$gte = new Date(filters.from);
  if (filters.to) {
    const end = new Date(filters.to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) end.setUTCHours(23, 59, 59, 999);
    query.createdAt.$lte = end;
  }
  if (filters.userId && model === BetMatch) query.$or = [{ redUserId: filters.userId }, { greenUserId: filters.userId }];
  const [items, total] = await Promise.all([model.find(query).sort({ createdAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(), model.countDocuments(query)]);
  return { items, total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };
}

export async function getBetTransactions(referenceId) {
  if (!validId(referenceId)) throw fail(400, "INVALID_REFERENCE_ID", "Identificador de auditoría inválido.");
  return WalletTransaction.find({ referenceId, referenceType: { $in: ["BetOrder", "BetMatch"] } }).sort({ occurredAt: 1, _id: 1 }).lean();
}
