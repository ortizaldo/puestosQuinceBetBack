import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import Deposit from "schemas/Deposits";
import Wallet from "schemas/Wallet";
import WalletTransaction from "schemas/WalletTransaction";
import User from "schemas/Users";
import { uploadDepositProof } from "controllers/upload/images";
import { auth, requireRole } from "../../middleware/auth";
import { publishRealtimeChange } from "../../modules/realtime";

const router = Router();
const maxFileSize = 5 * 1024 * 1024;
const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (req, file, callback) => callback(null, allowedTypes.includes(file.mimetype)),
});
function parseProofUpload(req, res, next) {
  proofUpload.single("proof")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(400).json({ success: false, message: tooLarge ? "El comprobante no puede superar 5 MB." : "No fue posible procesar el comprobante." });
  });
}

function errorResponse(res, error) {
  const unavailable = error.code === 20 || error.code === 263 || /transaction numbers are only allowed|replica set|mongos/i.test(error.message || "");
  return res.status(error.status || (unavailable ? 503 : 500)).json({
    success: false,
    code: error.code,
    message: unavailable ? "La aprobación de depósitos requiere MongoDB configurado como replica set para garantizar atomicidad." : error.message || "No fue posible completar la operación.",
  });
}

function amountToCents(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    const error = new Error("El monto debe ser positivo y usar máximo dos decimales."); error.status = 400; throw error;
  }
  return Math.round(value * 100);
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

router.use(auth);

router.get("/instructions", (req, res) => {
  const bank = process.env.DEPOSIT_BANK_NAME || "";
  const beneficiary = process.env.DEPOSIT_BENEFICIARY || "";
  const clabe = process.env.DEPOSIT_CLABE || "";
  res.json({ data: { configured: Boolean(bank || beneficiary || clabe), bank, beneficiary, clabe } });
});

router.post("/me", parseProofUpload, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const cents = amountToCents(amount);
    if (!Number.isSafeInteger(cents)) return res.status(400).json({ success: false, message: "El monto excede el límite permitido." });
    const depositDate = new Date(`${req.body.depositDate}T12:00:00.000Z`);
    if (!req.body.depositDate || Number.isNaN(depositDate.getTime())) return res.status(400).json({ success: false, message: "Indica una fecha de depósito válida." });
    if (depositDate > new Date()) return res.status(400).json({ success: false, message: "La fecha del depósito no puede ser futura." });
    if (!req.file) return res.status(400).json({ success: false, message: "Adjunta un comprobante PDF, JPG o PNG de máximo 5 MB." });
    if (!allowedTypes.includes(req.file.mimetype)) return res.status(400).json({ success: false, message: "Solo se permiten comprobantes PDF, JPG o PNG." });
    const reference = String(req.body.reference || "").trim();
    if (reference.length > 120) return res.status(400).json({ success: false, message: "La referencia no puede superar 120 caracteres." });

    const uploaded = await uploadDepositProof(req.file);
    const deposit = await Deposit.create({
      userId: req.user.id,
      amount: cents / 100,
      currency: "MXN",
      depositDate,
      reference,
      trackingKey: reference,
      proofUrl: uploaded.secure_url,
      proofPublicId: uploaded.public_id,
      proofFileName: req.file.originalname,
      status: "pending",
    });
    publishRealtimeChange("deposits", "created");
    return res.status(201).json({ data: deposit, message: "Comprobante de depósito enviado. Quedará pendiente de revisión y el saldo se acreditará cuando se confirme la recepción del dinero." });
  } catch (error) { return errorResponse(res, error); }
});

router.get("/me", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const query = { userId: req.user.id };
    const [items, total] = await Promise.all([
      Deposit.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Deposit.countDocuments(query),
    ]);
    return res.json({ data: { items, total, page, limit } });
  } catch (error) { return errorResponse(res, error); }
});

router.get("/admin", requireRole("ADMIN", "OPERADOR"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const query = {};
    if (["pending", "approved", "rejected"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.search) {
      const search = escapeRegex(String(req.query.search).trim().slice(0, 120));
      const users = await User.find({ $or: [{ firstName: new RegExp(search, "i") }, { lastName: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] }).select("_id").limit(100).lean();
      query.$or = [{ reference: new RegExp(search, "i") }, { trackingKey: new RegExp(search, "i") }, { userId: { $in: users.map((user) => user._id) } }];
      if (mongoose.Types.ObjectId.isValid(search)) query.$or.push({ _id: search });
    }
    const [items, total] = await Promise.all([
      Deposit.find(query).populate("userId", "firstName lastName email").populate("reviewedBy", "firstName lastName").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Deposit.countDocuments(query),
    ]);
    return res.json({ data: { items, total, page, limit } });
  } catch (error) { return errorResponse(res, error); }
});

router.get("/admin/:id", requireRole("ADMIN", "OPERADOR"), async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id).populate("userId", "firstName lastName email").populate("reviewedBy", "firstName lastName");
    if (!deposit) return res.status(404).json({ success: false, message: "Depósito no encontrado." });
    return res.json({ data: deposit });
  } catch (error) { return errorResponse(res, error); }
});

router.post("/admin/:id/approve", requireRole("ADMIN", "OPERADOR"), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let resolved;
    await session.withTransaction(async () => {
      const deposit = await Deposit.findOne({ _id: req.params.id, status: "pending" }).session(session);
      if (!deposit) { const error = new Error("La solicitud ya fue resuelta o no existe."); error.status = 409; throw error; }
      const wallet = await Wallet.findOneAndUpdate(
        { userId: deposit.userId, balanceCents: { $lte: Number.MAX_SAFE_INTEGER - amountToCents(deposit.amount) } },
        { $inc: { balanceCents: amountToCents(deposit.amount) }, $setOnInsert: { currency: "MXN" } },
        { upsert: true, new: true, session, setDefaultsOnInsert: true, runValidators: true },
      );
      if (!wallet) { const error = new Error("El saldo supera el máximo monetario permitido."); error.status = 409; throw error; }
      await WalletTransaction.create([{
        walletId: wallet._id, userId: deposit.userId, type: "CREDIT", amountCents: amountToCents(deposit.amount),
        balanceAfterCents: wallet.balanceCents, source: "DEPOSIT_CONFIRMED", reference: deposit._id.toString(),
        description: `Depósito aprobado${deposit.reference ? ` · ${deposit.reference}` : ""}`,
        performedBy: req.user.id, requestId: `deposit-${deposit._id}`,
      }], { session });
      deposit.status = "approved";
      deposit.reviewedBy = req.user.id;
      deposit.reviewedAt = new Date();
      deposit.reviewNote = String(req.body.note || "").trim();
      await deposit.save({ session });
      resolved = deposit;
    });
    publishRealtimeChange("deposits", "approved");
    publishRealtimeChange("wallet", "updated");
    return res.json({ data: resolved, message: "Depósito aprobado y saldo acreditado." });
  } catch (error) { return errorResponse(res, error); } finally { await session.endSession(); }
});

router.post("/admin/:id/reject", requireRole("ADMIN", "OPERADOR"), async (req, res) => {
  const note = String(req.body.reason || "").trim();
  if (!note) return res.status(400).json({ success: false, message: "El motivo de rechazo es obligatorio." });
  try {
    const deposit = await Deposit.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status: "rejected", reviewNote: note, reviewedBy: req.user.id, reviewedAt: new Date() } },
      { new: true, runValidators: true },
    );
    if (!deposit) return res.status(409).json({ success: false, message: "La solicitud ya fue resuelta o no existe." });
    publishRealtimeChange("deposits", "rejected");
    return res.json({ data: deposit, message: "Solicitud rechazada. No se modificó el saldo de Wallet." });
  } catch (error) { return errorResponse(res, error); }
});

export default router;
