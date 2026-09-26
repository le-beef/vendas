export const PLATFORM_COMMISSION_SCOPES = Object.freeze({
  none: "Não cobrar comissão",
  online: "Somente vendas online",
  manual: "Somente vendas manuais",
  both: "Vendas online e manuais"
});

export function normalizePercentage(value) {
  const percentage = Number(value);
  if (!Number.isFinite(percentage)) return 0;
  return Math.min(100, Math.max(0, Math.round(percentage * 100) / 100));
}

export function normalizeCommissionScope(value) {
  return Object.hasOwn(PLATFORM_COMMISSION_SCOPES, value) ? value : "none";
}

export function eventFinancialRules(event = {}) {
  return {
    platformCommissionPercent: normalizePercentage(event.platformCommissionPercent),
    platformCommissionScope: normalizeCommissionScope(event.platformCommissionScope)
  };
}

export function commissionAppliesToChannel(scope, channel) {
  const normalizedScope = normalizeCommissionScope(scope);
  const normalizedChannel = channel === "online" ? "online" : "manual";
  return normalizedScope === "both" || normalizedScope === normalizedChannel;
}

export function saleFinancialSnapshot(event, total, currentSale = null, channel = "manual") {
  const normalizedChannel = currentSale?.channel === "online" || channel === "online" ? "online" : "manual";
  const eventRules = eventFinancialRules(event);
  const percentage = currentSale?.platformCommissionPercent === undefined
    ? eventRules.platformCommissionPercent
    : normalizePercentage(currentSale.platformCommissionPercent);
  const scope = currentSale?.platformCommissionScope === undefined
    ? eventRules.platformCommissionScope
    : normalizeCommissionScope(currentSale.platformCommissionScope);
  const base = Math.max(0, Math.round(Number(total || 0) * 100) / 100);
  const applied = percentage > 0 && commissionAppliesToChannel(scope, normalizedChannel);
  const amount = applied ? Math.round(base * percentage) / 100 : 0;

  return {
    channel: normalizedChannel,
    platformCommissionPercent: percentage,
    platformCommissionScope: scope,
    platformCommissionApplied: applied,
    platformCommissionBase: base,
    platformCommissionAmount: Math.round(amount * 100) / 100
  };
}

export function promoterFinancialSnapshot(promoter, total, currentSale = null, channel = "manual") {
  const normalizedChannel = currentSale?.channel === "online" || channel === "online" ? "online" : "manual";
  const promoterId = String(currentSale?.promoterId || promoter?.id || "");
  const promoterName = String(currentSale?.promoterName || promoter?.name || "");
  const percentage = currentSale?.promoterCommissionPercent === undefined
    ? normalizePercentage(promoter?.commissionPercent)
    : normalizePercentage(currentSale.promoterCommissionPercent);
  const scope = currentSale?.promoterCommissionScope === undefined
    ? normalizeCommissionScope(promoter?.commissionScope)
    : normalizeCommissionScope(currentSale.promoterCommissionScope);
  const base = Math.max(0, Math.round(Number(total || 0) * 100) / 100);
  const applied = Boolean(promoterId) && percentage > 0 && commissionAppliesToChannel(scope, normalizedChannel);
  const amount = applied ? Math.round(base * percentage) / 100 : 0;

  return {
    promoterId,
    promoterName,
    promoterCommissionPercent: percentage,
    promoterCommissionScope: scope,
    promoterCommissionApplied: applied,
    promoterCommissionBase: base,
    promoterCommissionAmount: Math.round(amount * 100) / 100
  };
}
