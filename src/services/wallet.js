import mongoose from "mongoose";
import Wallet from "schemas/Wallet";
import WalletTransaction from "schemas/WalletTransaction";

export async function ensureWallet(userId) {
  try {
    return await Wallet.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, balanceCents: 0, reservedBalanceCents: 0, inPlayBalanceCents: 0, currency: "MXN" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    // A concurrent upsert can lose the unique-index race; return the winner.
    if (error.code === 11000) return Wallet.findOne({ userId });
    throw error;
  }
}

function idempotencyConflict() {
  const error = new Error("La clave de esta operación ya fue usada para un ajuste diferente.");
  error.status = 409;
  error.code = "IDEMPOTENCY_KEY_REUSED";
  return error;
}

async function findIdempotentMovement(requestId, movement) {
  if (!requestId) return null;
  const existing = await WalletTransaction.findOne({ requestId });
  if (!existing) return null;
  const sameOperation = String(existing.userId) === String(movement.userId)
    && existing.type === movement.type
    && existing.amountCents === movement.amountCents
    && existing.source === movement.source
    && (existing.reference || "") === (movement.reference || "")
    && existing.description === movement.description
    && String(existing.performedBy || "") === String(movement.performedBy || "");
  if (!sameOperation) throw idempotencyConflict();
  return existing;
}

export async function registerMovement({ userId, type, amountCents, source, reference = "", description, performedBy = null, requestId }) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    const error = new Error("El monto debe ser mayor que cero y tener precisión de centavos.");
    error.status = 400;
    throw error;
  }
  if (!["CREDIT", "DEBIT"].includes(type)) {
    const error = new Error("Tipo de movimiento inválido."); error.status = 400; throw error;
  }

  const movement = { userId, type, amountCents, source, reference, description, performedBy };
  const priorMovement = await findIdempotentMovement(requestId, movement);
  if (priorMovement) return priorMovement;

  const wallet = await ensureWallet(userId);
  const session = await mongoose.startSession();
  try {
    let transaction;
    await session.withTransaction(async () => {
      const delta = type === "CREDIT" ? amountCents : -amountCents;
      const balanceGuard = type === "DEBIT"
        ? { balanceCents: { $gte: amountCents } }
        : { balanceCents: { $lte: Number.MAX_SAFE_INTEGER - amountCents } };
      const updated = await Wallet.findOneAndUpdate(
        { _id: wallet._id, ...balanceGuard },
        { $inc: { balanceCents: delta } },
        { new: true, session, runValidators: true },
      );
      if (!updated) {
        const error = new Error(type === "DEBIT" ? "El débito supera el saldo disponible." : "El saldo supera el máximo monetario permitido."); error.status = 409; error.code = type === "DEBIT" ? "INSUFFICIENT_BALANCE" : "BALANCE_LIMIT"; throw error;
      }
      [transaction] = await WalletTransaction.create([{
        walletId: updated._id, userId, type, amountCents,
        balanceAfterCents: updated.balanceCents, source, reference, description, performedBy, requestId,
      }], { session });
    });
    return transaction;
  } catch (error) {
    if (error.code === 11000 && requestId) {
      const duplicate = await findIdempotentMovement(requestId, movement);
      if (duplicate) return duplicate;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export function registerCredit(options) {
  return registerMovement({ ...options, type: "CREDIT" });
}

export function registerDebit(options) {
  return registerMovement({ ...options, type: "DEBIT" });
}

export async function getWallet(userId) {
  const wallet = await ensureWallet(userId);
  return { ...wallet.toObject(), availableBalanceCents: wallet.balanceCents, reservedBalanceCents: wallet.reservedBalanceCents || 0, inPlayBalanceCents: wallet.inPlayBalanceCents || 0, balance: wallet.balanceCents / 100 };
}

export async function getMovements(userId, { page = 1, limit = 5, type, from, to } = {}) {
  const wallet = await ensureWallet(userId);
  const query = { walletId: wallet._id };
  if (["CREDIT", "DEBIT"].includes(type)) query.type = type;
  if (from || to) query.occurredAt = {};
  if (from) query.occurredAt.$gte = new Date(from);
  if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); query.occurredAt.$lte = end; }
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
  const [items, total] = await Promise.all([
    WalletTransaction.find(query).sort({ occurredAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    WalletTransaction.countDocuments(query),
  ]);
  return { items: items.map((item) => ({ ...item, amount: item.amountCents / 100, balanceAfter: item.balanceAfterCents / 100, movementDirection: Number.isFinite(item.balanceBeforeCents) ? (item.balanceAfterCents > item.balanceBeforeCents ? "CREDIT" : item.balanceAfterCents < item.balanceBeforeCents ? "DEBIT" : "INFO") : item.type })), total, page: safePage, limit: safeLimit };
}
