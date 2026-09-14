export const THERMAL_PAPER_WIDTHS = [58, 80];

const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function normalizeThermalPaperWidth(value) {
  const width = Number(value);
  return THERMAL_PAPER_WIDTHS.includes(width) ? width : THERMAL_PAPER_WIDTHS[0];
}

function informationRow(label, value) {
  if (!value) return "";
  return `<div class="information-row"><span>${html(label)}</span><strong>${html(value)}</strong></div>`;
}

export function buildThermalPrintHtml({ event, sale, tickets, qrCodes, paperWidth, ticketDesign = {} }) {
  const width = normalizeThermalPaperWidth(paperWidth);
  if (!Array.isArray(tickets) || !tickets.length) throw new Error("Nenhum ingresso disponível para impressão.");
  if (!Array.isArray(qrCodes) || qrCodes.length !== tickets.length) throw new Error("Não foi possível preparar os QR Codes para impressão.");
  const pageHeight = 200;
  const title = String(ticketDesign.title || "INGRESSO DIGITAL").trim();
  const footer = String(ticketDesign.footer || "Apresente este QR Code na entrada.").trim();
  const pages = tickets.map((ticket, index) => `<article class="thermal-ticket">
    <header><small>LE BEEF</small><h1>${html(title)}</h1></header>
    <section class="event"><h2>${html(event.name || "Evento")}</h2><p>${html([event.dateText, event.place].filter(Boolean).join(" - "))}</p></section>
    <div class="separator"></div>
    ${informationRow("MODALIDADE", ticket.admissionType)}
    ${informationRow("PARTICIPANTE", ticket.participantName || sale.buyerName || "Participante")}
    ${informationRow("INGRESSO", ticket.ticketTypeName || "Ingresso")}
    ${informationRow("RESERVA", ticket.reservationLabel)}
    ${informationRow("VALOR", ticket.ticketValue)}
    ${informationRow("PAGAMENTO", [ticket.paymentStatus, ticket.paymentDetail].filter(Boolean).join(" - "))}
    <div class="separator"></div>
    <img class="qr-code" src="${html(qrCodes[index])}" alt="QR Code do ingresso" />
    <strong class="short-code">${html(ticket.shortCode)}</strong>
    <p class="footer">${html(footer)}</p>
    <small class="sequence">Ingresso ${index + 1} de ${tickets.length}</small>
  </article>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ingressos - ${html(event.name || "Le Beef")}</title><style>
    @page{size:${width}mm ${pageHeight}mm;margin:0}
    *{box-sizing:border-box}
    html,body{width:${width}mm;margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}
    body{font-size:${width === 58 ? "9pt" : "10pt"}}
    .thermal-ticket{width:${width}mm;padding:${width === 58 ? "4mm 3mm" : "5mm 5mm"};overflow-wrap:anywhere;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
    .thermal-ticket+.thermal-ticket{break-before:page;page-break-before:always}
    .thermal-ticket:last-child{break-after:auto;page-break-after:auto}
    header{text-align:center}header small{display:block;font-size:8pt;font-weight:700;letter-spacing:.16em}h1{margin:2mm 0 0;font-size:${width === 58 ? "14pt" : "16pt"};line-height:1.15}h2{margin:0;font-size:${width === 58 ? "13pt" : "15pt"};line-height:1.2}.event{margin-top:4mm;text-align:center}.event p{margin:1.5mm 0 0;font-size:8.5pt;line-height:1.35}.separator{margin:3mm 0;border-top:.35mm dashed #000}.information-row{margin:0 0 2.2mm}.information-row span{display:block;margin-bottom:.6mm;font-size:7pt;font-weight:700;letter-spacing:.08em}.information-row strong{display:block;font-size:${width === 58 ? "10pt" : "11pt"};line-height:1.3}.qr-code{display:block;width:${width === 58 ? "36mm" : "40mm"};height:${width === 58 ? "36mm" : "40mm"};margin:3mm auto 1.5mm}.short-code,.sequence{display:block;text-align:center}.short-code{font-family:"Courier New",monospace;font-size:10pt;letter-spacing:.12em}.footer{margin:3mm 0 2mm;text-align:center;font-size:8pt;line-height:1.4}.sequence{font-size:7pt}
    @media screen{body{margin:0 auto;background:#e5e7eb}.thermal-ticket{margin:0 auto;background:#fff}}
    @media print{html,body{background:#fff}.thermal-ticket{margin:0}}
  </style></head><body>${pages}</body></html>`;
}
