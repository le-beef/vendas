export const TICKET_PAPER_WIDTHS = [58, 80];

export const DEFAULT_TICKET_DESIGN = Object.freeze({
  primaryColor: "#17375f", accentColor: "#14b886", title: "INGRESSO DIGITAL",
  footer: "Apresente este QR Code na entrada.", logoDataUrl: "", paperWidth: 58,
  logoSize: 7, titleSize: 10, textSize: 6.5, dataSize: 7.5,
  spacing: 0.65, qrSize: 28, qrSpacing: 1.5, margin: 2,
  showEstablishment: true, showEventMeta: true, showPayment: true, showFooter: true
});

const numberWithin = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};
const booleanValue = (value, fallback) => value === undefined || value === null ? fallback : Boolean(value);
const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
const safeLogo = (value) => {
  const logo = String(value || "");
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=\s]+$/i.test(logo) && logo.length <= 700000 ? logo : "";
};

export function normalizeTicketDesign(value = {}) {
  const defaults = DEFAULT_TICKET_DESIGN;
  const paperWidth = TICKET_PAPER_WIDTHS.includes(Number(value.paperWidth)) ? Number(value.paperWidth) : defaults.paperWidth;
  return {
    primaryColor: safeColor(value.primaryColor, defaults.primaryColor), accentColor: safeColor(value.accentColor, defaults.accentColor),
    title: String(value.title || defaults.title).trim().slice(0, 36) || defaults.title,
    footer: String(value.footer || defaults.footer).trim().slice(0, 120) || defaults.footer,
    logoDataUrl: safeLogo(value.logoDataUrl), paperWidth,
    logoSize: numberWithin(value.logoSize, defaults.logoSize, 4, 10), titleSize: numberWithin(value.titleSize, defaults.titleSize, 8, 12),
    textSize: numberWithin(value.textSize, defaults.textSize, 5.5, 8), dataSize: numberWithin(value.dataSize, defaults.dataSize, 6.5, 9.5),
    spacing: numberWithin(value.spacing, defaults.spacing, 0.35, 1.2), qrSize: numberWithin(value.qrSize, defaults.qrSize, 18, 40),
    qrSpacing: numberWithin(value.qrSpacing, defaults.qrSpacing, 0, 20),
    margin: numberWithin(value.margin, defaults.margin, 1.5, 3.5),
    showEstablishment: booleanValue(value.showEstablishment, defaults.showEstablishment),
    showEventMeta: booleanValue(value.showEventMeta, defaults.showEventMeta),
    showPayment: booleanValue(value.showPayment, defaults.showPayment), showFooter: booleanValue(value.showFooter, defaults.showFooter)
  };
}

export function effectiveTicketDesign(value = {}, paperWidth) {
  const design = normalizeTicketDesign({ ...value, paperWidth: paperWidth ?? value.paperWidth });
  return { ...design, logoSize: Math.min(design.logoSize, design.paperWidth === 58 ? 8 : 10) };
}

export function ticketHeightForDesign(value = {}, paperWidth) {
  const design = effectiveTicketDesign(value, paperWidth);
  const enlargedQr = Math.max(0, design.qrSize - 28);
  const movedDown = Math.max(0, design.qrSpacing - DEFAULT_TICKET_DESIGN.qrSpacing);
  const enlargedQrWithLogo = enlargedQr > 0 && design.logoDataUrl ? design.logoSize : 0;
  return Math.min(130, Math.ceil((80 + enlargedQr + movedDown + enlargedQrWithLogo) * 2) / 2);
}
