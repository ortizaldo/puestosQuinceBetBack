export const LINE_80_RISK_UNIT_CENTS = Object.freeze({ GIVE_80: 10000, TAKE_80: 8000 });

export function profitForRisk(marketType, riskCents) {
  if (!Number.isSafeInteger(riskCents) || riskCents < 0) throw new Error("El riesgo debe ser un entero de centavos.");
  if (marketType === "EVEN") return riskCents;
  if (marketType === "GIVE_80") {
    if (riskCents % LINE_80_RISK_UNIT_CENTS.GIVE_80) throw new Error("Doy 80 requiere múltiplos de $100.00 de riesgo.");
    return (riskCents / LINE_80_RISK_UNIT_CENTS.GIVE_80) * 8000;
  }
  if (marketType === "TAKE_80") {
    if (riskCents % LINE_80_RISK_UNIT_CENTS.TAKE_80) throw new Error("Agarro 80 requiere múltiplos de $80.00 de riesgo.");
    return (riskCents / LINE_80_RISK_UNIT_CENTS.TAKE_80) * 10000;
  }
  throw new Error("Modalidad inválida.");
}

export function compatibleMarket(marketType) {
  if (marketType === "EVEN") return "EVEN";
  if (marketType === "GIVE_80") return "TAKE_80";
  if (marketType === "TAKE_80") return "GIVE_80";
  throw new Error("Modalidad inválida.");
}

export function compatibleSide(side) {
  if (side === "RED") return "GREEN";
  if (side === "GREEN") return "RED";
  throw new Error("Participante inválido.");
}

export function matchedRisks(marketType, ownPendingCents, oppositeMarketType, oppositePendingCents) {
  if (marketType === "EVEN" && oppositeMarketType === "EVEN") {
    const amount = Math.min(ownPendingCents, oppositePendingCents);
    return { ownRiskCents: amount, oppositeRiskCents: amount };
  }
  const giveRisk = marketType === "GIVE_80" ? ownPendingCents : oppositePendingCents;
  const takeRisk = marketType === "TAKE_80" ? ownPendingCents : oppositePendingCents;
  if (!["GIVE_80", "TAKE_80"].includes(marketType) || !["GIVE_80", "TAKE_80"].includes(oppositeMarketType) || marketType === oppositeMarketType) {
    return { ownRiskCents: 0, oppositeRiskCents: 0 };
  }
  const units = Math.min(Math.floor(giveRisk / 10000), Math.floor(takeRisk / 8000));
  const giveMatched = units * 10000;
  const takeMatched = units * 8000;
  return marketType === "GIVE_80"
    ? { ownRiskCents: giveMatched, oppositeRiskCents: takeMatched }
    : { ownRiskCents: takeMatched, oppositeRiskCents: giveMatched };
}

export function orderStatus(order) {
  if (order.pendingRiskAmount === 0) return "MATCHED";
  return order.matchedRiskAmount > 0 ? "PARTIALLY_MATCHED" : "PENDING";
}

export function commissionForProfit(profitCents, commissionBps = 0) {
  if (!Number.isSafeInteger(profitCents) || profitCents < 0) throw new Error("La ganancia debe ser un entero no negativo.");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10000) throw new Error("Comisión inválida.");
  // Deterministic round-half-up to the nearest cent; fee applies only to profit.
  return Math.floor((profitCents * commissionBps + 5000) / 10000);
}
