import { TICKET_PAPER_WIDTHS, effectiveTicketDesign } from "./ticket-layout.js?v=1";

export const THERMAL_PAPER_WIDTHS = TICKET_PAPER_WIDTHS;
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function normalizeThermalPaperWidth(value) {
  const width = Number(value);
  return THERMAL_PAPER_WIDTHS.includes(width) ? width : THERMAL_PAPER_WIDTHS[0];
}

function informationCell(label, value, className = "") {
  if (!value) return "";
  return `<div class="information-cell ${className}"><span>${html(label)}</span><strong>${html(value)}</strong></div>`;
}

function ticketMarkup({ event, sale, ticket, qrCode, design, index, count }) {
  const dense = Boolean(ticket.reservationLabel) || String(ticket.participantName || "").length > 32 || String(ticket.ticketTypeName || "").length > 24 || design.titleSize > 10 || design.dataSize > 8 || design.spacing > 0.7 || design.logoSize > 8 || design.qrSize > 20;
  const logo = design.logoDataUrl ? `<img class="event-logo" src="${html(design.logoDataUrl)}" alt="Logo do evento" />` : "";
  const establishment = design.showEstablishment ? "<small class=\"establishment\">LE BEEF</small>" : "";
  const eventMeta = design.showEventMeta ? `<p>${html([event.dateText, event.place].filter(Boolean).join(" · "))}</p>` : "";
  const payment = design.showPayment ? informationCell("PAGAMENTO", [ticket.paymentStatus, ticket.paymentDetail].filter(Boolean).join(" · ")) : "";
  const footer = design.showFooter ? `<p class="footer">${html(design.footer)}</p>` : "";
  return `<article class="thermal-ticket${dense ? " is-dense" : ""}">
    <header>${logo}${establishment}<h1>${html(design.title)}</h1></header>
    <section class="event"><h2>${html(event.name || "Evento")}</h2>${eventMeta}</section>
    <div class="separator"></div>
    <section class="information-grid">
      ${informationCell("MODALIDADE", ticket.admissionType)}${informationCell("INGRESSO", ticket.ticketTypeName || "Ingresso")}
      ${informationCell("PARTICIPANTE", ticket.participantName || sale.buyerName || "Participante", "wide")}
      ${informationCell("RESERVA", ticket.reservationLabel, "wide")}
      ${informationCell("VALOR", ticket.ticketValue)}${payment}
    </section>
    <section class="validation"><img class="qr-code" src="${html(qrCode)}" alt="QR Code do ingresso" /><strong class="short-code">${html(ticket.shortCode)}</strong>${footer}<small class="sequence">Ingresso ${index + 1} de ${count}</small></section>
  </article>`;
}

export function buildThermalPrintHtml({ event, sale, tickets, qrCodes, paperWidth, ticketDesign = {} }) {
  const width = normalizeThermalPaperWidth(paperWidth ?? ticketDesign.paperWidth);
  const design = effectiveTicketDesign(ticketDesign, width);
  if (!Array.isArray(tickets) || !tickets.length) throw new Error("Nenhum ingresso disponível para impressão.");
  if (!Array.isArray(qrCodes) || qrCodes.length !== tickets.length) throw new Error("Não foi possível preparar os QR Codes para impressão.");
  const pages = tickets.map((ticket, index) => ticketMarkup({ event, sale, ticket, qrCode: qrCodes[index], design, index, count: tickets.length })).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingressos - ${html(event.name || "Le Beef")}</title><style>
    @page{size:${width}mm 80mm;margin:0}*{box-sizing:border-box}html,body{width:${width}mm;margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
    .thermal-ticket{--space:${design.spacing}mm;--text:${design.textSize}pt;--data:${design.dataSize}pt;width:${width}mm;height:80mm;padding:${design.margin}mm;display:flex;flex-direction:column;gap:var(--space);overflow:hidden;overflow-wrap:anywhere;background:#fff;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
    .thermal-ticket+.thermal-ticket{break-before:page;page-break-before:always}.thermal-ticket:last-child{break-after:auto;page-break-after:auto}header,.event,.validation{text-align:center}.event-logo{display:block;width:auto;max-width:72%;height:auto;max-height:${design.logoSize}mm;margin:0 auto var(--space);object-fit:contain}.establishment{display:block;font-size:var(--text);font-weight:800;letter-spacing:.14em}h1{margin:0;font-size:${design.titleSize}pt;line-height:1.05}h2{margin:0;font-size:calc(var(--data) + 1pt);line-height:1.08}.event p{margin:.25mm 0 0;font-size:var(--text);line-height:1.1}.separator{flex:0 0 auto;border-top:.25mm dashed #000}
    .information-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space) calc(var(--space) * 2)}.information-cell{text-align:center;min-width:0}.information-cell.wide{grid-column:1/-1}.information-cell span{display:block;margin-bottom:.15mm;font-size:calc(var(--text) - .5pt);font-weight:800;letter-spacing:.06em}.information-cell strong{display:block;font-size:var(--data);line-height:1.08}.validation{margin-top:auto;display:grid;justify-items:center;gap:.25mm}.qr-code{display:block;width:${design.qrSize}mm;height:${design.qrSize}mm;object-fit:contain;image-rendering:pixelated}.short-code{font-family:"Courier New",monospace;font-size:calc(var(--text) + .5pt);letter-spacing:.1em}.footer{margin:0;font-size:var(--text);line-height:1.08}.sequence{font-size:calc(var(--text) - .5pt)}
    .thermal-ticket.is-dense{--space:${Math.min(design.spacing, 0.4)}mm;--text:${Math.min(design.textSize, 5.8)}pt;--data:${Math.min(design.dataSize, 6.8)}pt}.is-dense .event-logo{max-height:${Math.min(design.logoSize, 5.5)}mm;margin-bottom:.2mm}.is-dense h1{font-size:${Math.min(design.titleSize, 9)}pt}.is-dense h2{font-size:calc(var(--data) + .5pt)}.is-dense .event p{margin-top:.1mm}.is-dense .information-grid{gap:.25mm .7mm}.is-dense .information-cell span{margin-bottom:0;font-size:5pt}.is-dense .information-cell strong{line-height:1}.is-dense .qr-code{width:${Math.min(design.qrSize, 18)}mm;height:${Math.min(design.qrSize, 18)}mm}.is-dense .validation{gap:.1mm}.is-dense .footer{font-size:5.5pt;line-height:1}
    @media screen{body{margin:0 auto;background:#e5e7eb}.thermal-ticket{margin:0 auto;box-shadow:0 2px 12px #0002}}@media print{html,body{background:#fff}.thermal-ticket{margin:0;box-shadow:none}}
  </style></head><body>${pages}</body></html>`;
}
