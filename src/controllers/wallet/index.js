import { Router } from "express";
import { auth, requireRole } from "../../middleware/auth";
import { ensureWallet, getMovements, getWallet, registerCredit, registerDebit } from "../../services/wallet";
import User from "../../schemas/Users";

const router = Router();
const respondError = (res, error) => {
  const transactionUnavailable = error.code === 20 || error.code === 263 || /transaction numbers are only allowed|replica set|mongos/i.test(error.message || "");
  return res.status(error.status || (transactionUnavailable ? 503 : 500)).json({
    success: false,
    code: error.code,
    message: transactionUnavailable ? "Los ajustes requieren MongoDB configurado como replica set para garantizar atomicidad." : (error.message || "No fue posible completar la operación."),
  });
};
const requireExistingUser = async (userId) => {
  const user = await User.findById(userId).select("_id").lean();
  if (!user) { const error = new Error("Usuario no encontrado."); error.status = 404; throw error; }
};

router.use(auth);
router.get("/me", async (req, res) => {
  try { res.json({ data: await getWallet(req.user.id) }); } catch (error) { respondError(res, error); }
});
router.get("/me/movements", async (req, res) => {
  try { res.json({ data: await getMovements(req.user.id, req.query) }); } catch (error) { respondError(res, error); }
});
router.get("/users/:userId", requireRole("ADMIN"), async (req, res) => {
  try { await requireExistingUser(req.params.userId); res.json({ data: await getWallet(req.params.userId) }); } catch (error) { respondError(res, error); }
});
router.get("/users/:userId/movements", requireRole("ADMIN"), async (req, res) => {
  try { await requireExistingUser(req.params.userId); res.json({ data: await getMovements(req.params.userId, req.query) }); } catch (error) { respondError(res, error); }
});
router.post("/users/:userId/adjustments", requireRole("ADMIN"), async (req, res) => {
  const { requestId, type, amount, reason, reference = "" } = req.body;
  const amountNumber = Number(amount);
  if (!["CREDIT", "DEBIT"].includes(type)) return res.status(400).json({ success: false, message: "Tipo de ajuste inválido." });
  if (typeof requestId !== "string" || requestId.trim().length < 8 || requestId.length > 100) return res.status(400).json({ success: false, message: "Identificador de ajuste inválido. Intenta de nuevo." });
  if (!reason || !String(reason).trim()) return res.status(400).json({ success: false, message: "El motivo es obligatorio." });
  if (!Number.isFinite(amountNumber) || amountNumber <= 0 || Math.abs(amountNumber * 100 - Math.round(amountNumber * 100)) > 1e-6) return res.status(400).json({ success: false, message: "El monto debe ser positivo y usar máximo dos decimales." });
  try {
    await requireExistingUser(req.params.userId);
    await ensureWallet(req.params.userId);
    const register = type === "CREDIT" ? registerCredit : registerDebit;
    const data = await register({ userId: req.params.userId, amountCents: Math.round(amountNumber * 100), source: "ADMIN_ADJUSTMENT", reference, description: String(reason).trim(), performedBy: req.user.id, requestId: requestId.trim() });
    res.status(201).json({ data });
  } catch (error) { respondError(res, error); }
});

export default router;
