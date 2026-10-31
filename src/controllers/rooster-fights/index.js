import RoosterFights from "schemas/RoosterFights";
import RestRouter from "routes/rest-router";
import BetMatch from "schemas/BetMatch";
import BetOrder from "schemas/BetOrder";

const protectBettingState = async (req) => {
  const protectedFields = ["apuestasAbiertas", "bettingStatus", "bettingCommissionBps", "resultado"];
  if (protectedFields.some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field)) || ["FINALIZADA", "CANCELADA"].includes(req.body?.estado)) {
    const error = new Error("Actualiza el resultado desde la liquidación de apuestas; el estado financiero se gestiona en una transacción.");
    error.status = 409;
    error.code = "USE_BETTING_SETTLEMENT";
    throw error;
  }
  if (req.body?.estado === "EN_CURSO") {
    const error = new Error("Inicia la pelea desde la ruta de operación para bloquear las apuestas de forma atómica."); error.status = 409; error.code = "USE_FIGHT_START_ENDPOINT"; throw error;
  }
};

const protectFightCreation = (req) => {
  const records = Array.isArray(req.body) ? req.body : [req.body || {}];
  if (records.some((record) => record?.apuestasAbiertas === true || record?.bettingStatus === "OPEN" || record?.bettingCommissionBps !== undefined)) {
    const error = new Error("El estado y la comisión de apuestas se fijan desde la operación al abrir el mercado."); error.status = 409; error.code = "USE_BETTING_OPEN_ENDPOINT"; throw error;
  }
};

const protectFightDeletion = async (req) => {
  const ids = req.params.id ? [req.params.id] : Array.isArray(req.query.items) ? req.query.items : String(req.query.items || "").replace(/[\[\]\"]+/g, "").split(",").filter(Boolean);
  const fightIds = ids.filter((id) => /^[a-f\d]{24}$/i.test(String(id)));
  if (!fightIds.length) return;
  const [orderCount, matchCount] = await Promise.all([BetOrder.countDocuments({ fightId: { $in: fightIds } }), BetMatch.countDocuments({ fightId: { $in: fightIds } })]);
  if (orderCount || matchCount) {
    const error = new Error("No se puede eliminar una pelea con órdenes o cotejos asociados."); error.status = 409; error.code = "FIGHT_HAS_BETTING_RECORDS"; throw error;
  }
};

const router = RestRouter(RoosterFights, { beforeEdit: protectBettingState, beforeEditMany: protectBettingState, beforeCreate: protectFightCreation, beforeCreateMany: protectFightCreation, beforeDelete: protectFightDeletion });

export default router;
