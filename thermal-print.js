import { TICKET_PAPER_WIDTHS, effectiveTicketDesign, ticketHeightForDesign } from "./ticket-layout.js?v=3";

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

function ticketMarkup({ event, sale, ticket, qrCode, design, index, count, showCutGuide }) {
  const logo = design.logoDataUrl ? `<img class="event-logo" src="${html(design.logoDataUrl)}" alt="Logo do evento" />` : "";
  const establishment = design.showEstablishment ? "<small class=\"establishment\">LE BEEF</small>" : "";
  const eventMeta = design.showEventMeta ? `<p>${html([event.dateText, event.place].filter(Boolean).join(" · "))}</p>` : "";
  const payment = design.showPayment ? informationCell("PAGAMENTO", [ticket.paymentStatus, ticket.paymentDetail].filter(Boolean).join(" · ")) : "";
  const footer = design.showFooter ? `<p class="footer">${html(design.footer)}</p>` : "";
  const generationOrigin = `<p class="generation-origin"><span>Gerado por: ${html(ticket.generatedByName || "Usuário não identificado")}</span><span>${html(ticket.generatedAtText || "Data e hora não registradas")}</span></p>`;
  const cutGuide = showCutGuide ? `<div class="cut-guide" aria-label="Linha de corte"><svg class="cut-guide-icon" viewBox="0 0 36 24" aria-hidden="true" focusable="false"><circle cx="7" cy="6.5" r="4.2"/><circle cx="7" cy="17.5" r="4.2"/><path d="M10.6 8.6 31.5 1.8M10.6 15.4l20.9 6.8M10.6 8.6 19 12l-8.4 3.4"/></svg></div>` : "";
  return `<section class="thermal-page"><article class="thermal-ticket">
    <header>${logo}${establishment}<h1>${html(design.title)}</h1></header>
    <section class="event"><h2>${html(event.name || "Evento")}</h2>${eventMeta}</section>
    <div class="separator"></div>
    <section class="information-grid">
      ${informationCell("MODALIDADE", ticket.admissionType)}${informationCell("INGRESSO", ticket.ticketTypeName || "Ingresso")}
      ${informationCell("PARTICIPANTE", ticket.participantName || sale.buyerName || "Participante", "wide")}
      ${informationCell("RESERVA", ticket.reservationLabel, "wide")}
      ${informationCell("VALOR", ticket.ticketValue)}${payment}
    </section>
    <section class="validation"><img class="qr-code" src="${html(qrCode)}" alt="QR Code do ingresso" /><strong class="short-code">${html(ticket.shortCode)}</strong>${footer}<small class="sequence">Ingresso ${index + 1} de ${count}</small>${generationOrigin}</section>
  </article>${cutGuide}</section>`;
}

export function buildThermalPrintHtml({ event, sale, tickets, qrCodes, paperWidth, paperHeight, ticketDesign = {} }) {
  const width = normalizeThermalPaperWidth(paperWidth ?? ticketDesign.paperWidth);
  const design = effectiveTicketDesign({ ...ticketDesign, ...(paperHeight === undefined ? {} : { ticketHeight: paperHeight }) }, width);
  const ticketHeight = ticketHeightForDesign(design, width);
  if (!Array.isArray(tickets) || !tickets.length) throw new Error("Nenhum ingresso disponível para impressão.");
  if (!Array.isArray(qrCodes) || qrCodes.length !== tickets.length) throw new Error("Não foi possível preparar os QR Codes para impressão.");
  const showCutGuide = tickets.length > 1;
  const cutSpacing = showCutGuide ? 5 : 0;
  const pageHeight = ticketHeight + cutSpacing;
  const pages = tickets.map((ticket, index) => ticketMarkup({ event, sale, ticket, qrCode: qrCodes[index], design, index, count: tickets.length, showCutGuide })).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingressos - ${html(event.name || "Le Beef")}</title><style>
    @page{size:${width}mm ${pageHeight}mm;margin:0}*{box-sizing:border-box}html,body{width:${width}mm;margin:0;padding:0;overflow:hidden;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
    .thermal-page{width:${width}mm;height:${pageHeight}mm;display:flex;flex-direction:column;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}.thermal-page+.thermal-page{break-before:page;page-break-before:always}.thermal-page:last-child{break-after:auto;page-break-after:auto}
    .thermal-ticket{--space:${design.spacing}mm;--text:${design.textSize}pt;--data:${design.dataSize}pt;width:${width}mm;height:${ticketHeight}mm;flex:0 0 ${ticketHeight}mm;padding:${design.margin}mm;display:flex;flex-direction:column;gap:var(--space);overflow:hidden;overflow-wrap:anywhere;background:#fff}.cut-guide{position:relative;width:${width}mm;height:5mm;flex:0 0 5mm;background:#fff}.cut-guide::before{position:absolute;top:2.3mm;right:.5mm;left:.5mm;border-top:.85mm dashed #000;content:""}.cut-guide-icon{position:absolute;z-index:1;top:0;left:.5mm;display:block;width:8.5mm;height:5mm;padding:0 .45mm;background:#fff;fill:none;stroke:#000;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
    header,.event,.validation{text-align:center}.event-logo{display:block;width:auto;max-width:72%;height:auto;max-height:${design.logoSize}mm;margin:0 auto var(--space);object-fit:contain}.establishment{display:block;font-size:var(--text);font-weight:800;letter-spacing:.14em}h1{margin:0;font-size:${design.titleSize}pt;line-height:1.05}h2{margin:0;font-size:calc(var(--data) + 1pt);line-height:1.08}.event p{margin:.25mm 0 0;font-size:var(--text);line-height:1.1}.separator{flex:0 0 auto;border-top:.25mm dashed #000}
    .information-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space) calc(var(--space) * 2)}.information-cell{text-align:center;min-width:0}.information-cell.wide{grid-column:1/-1}.information-cell span{display:block;margin-bottom:.15mm;font-size:calc(var(--text) - .5pt);font-weight:800;letter-spacing:.06em}.information-cell strong{display:block;font-size:var(--data);line-height:1.08}.validation{margin-top:${design.qrSpacing}mm;display:grid;justify-items:center;gap:.2mm}.qr-code{display:block;width:${design.qrSize}mm;height:${design.qrSize}mm;object-fit:contain;image-rendering:pixelated}.short-code{font-family:"Courier New",monospace;font-size:calc(var(--text) + .5pt);letter-spacing:.1em}.footer{margin:0;font-size:var(--text);line-height:1.08}.sequence{font-size:calc(var(--text) - .5pt)}.generation-origin{max-width:100%;margin:.2mm 0 0;font-size:max(4.5pt,calc(var(--text) - 1pt));line-height:1.05}.generation-origin span{display:block}
    @media screen{body{margin:0 auto;background:#e5e7eb}.thermal-page{margin:0 auto;box-shadow:0 2px 12px #0002}}@media print{html,body{background:#fff}.thermal-page{margin:0;box-shadow:none}}
  </style></head><body>${pages}</body></html>`;
}
