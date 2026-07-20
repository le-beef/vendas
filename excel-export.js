/* Exportador XLSX sem dependências, formatado para o modelo fornecido. */
(() => {
  const encoder = new TextEncoder();
  const xml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const column = (index) => String.fromCharCode(65 + index);
  const crc32 = (bytes) => { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; };
  const u16 = (value) => [value & 255, (value >>> 8) & 255];
  const u32 = (value) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
  const zip = (files) => {
    const locals = [], centrals = []; let offset = 0;
    for (const [name, content] of files) {
      const filename = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
      const local = new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),0,0,...filename,...data]);
      locals.push(local);
      centrals.push(new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...filename]));
      offset += local.length;
    }
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),0,0]);
    return new Blob([...locals, ...centrals, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };
  const textCell = (address, value, style) => `<c r="${address}" t="inlineStr" s="${style}"><is><t>${xml(value)}</t></is></c>`;
  const numberCell = (address, value, style) => `<c r="${address}" s="${style}"><v>${Number(value || 0)}</v></c>`;
  window.exportSalesXlsx = (sales, events, eventId) => {
    const paymentMethods = { pix: "PIX", cash: "DINHEIRO", credit_card: "CARTÃO DE CRÉDITO", debit_card: "CARTÃO DE DÉBITO", bank_transfer: "TRANSFERÊNCIA", other: "OUTRO" };
    const paymentDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "";
    const eventName = (id) => events.find((event) => event.id === id)?.name || "Evento removido";
    const saleItems = (sale) => {
      const storedItems = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
      if (storedItems.length) return storedItems.map((item) => {
        const components = Array.isArray(item.components) ? item.components : Object.values(item.components || {});
        const composition = components.map((component) => `${Number(component.quantity || 0)}x ${component.ticketTypeName || "Ingresso"}`).join(" + ");
        const ticketTypeName = item.kind === "package" || item.packageId ? `PACOTE: ${item.packageName || String(item.ticketTypeName || "Pacote").replace(/^Pacote:\s*/i, "")}${composition ? ` (${composition})` : ""}` : item.ticketTypeName || "Ingresso padrão";
        return { ticketTypeName, quantity: Number(item.quantity || 0), subtotal: Number(item.subtotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0)) };
      });
      return [{ ticketTypeName: sale.ticketTypeName || "Ingresso padrão", quantity: Number(sale.quantity || 0), subtotal: Number(sale.total || 0) }];
    };
    const selectedEvent = events.find((event) => event.id === eventId);
    const selectedSales = eventId ? sales.filter((sale) => sale.eventId === eventId) : sales;
    const header = ["EVENTO", "TIPO DE INGRESSO", "PARTICIPANTE", "TELEFONE / CONTATO", "OBSERVAÇÃO", "QTD.", "VALOR", "PAGAMENTO", "FORMA DE PAGAMENTO", "DATA DO PAGAMENTO", "VENDEDOR", "ENTRADA"];
    const rows = selectedSales.flatMap((sale) => saleItems(sale).map((item) => [eventName(sale.eventId), item.ticketTypeName, sale.buyerName || "", sale.buyerPhone || "", sale.notes || "", item.quantity, item.subtotal, sale.paid ? "PAGO" : "PENDENTE", sale.paid ? paymentMethods[sale.paymentMethod] || "NÃO INFORMADA" : "", sale.paid ? paymentDate(sale.paymentDate) : "", sale.createdByName || "VENDAS ANTERIORES", sale.checkedIn ? "SIM" : "NÃO"]));
    const sheetRows = [`<row r="1">${header.map((cell, i) => textCell(`${column(i)}1`, cell, 1)).join("")}</row>`];
    rows.forEach((row, index) => { const r = index + 2, style = index % 2 ? 2 : 0, moneyStyle = index % 2 ? 4 : 3; sheetRows.push(`<row r="${r}">${row.map((cell, i) => i === 5 ? numberCell(`${column(i)}${r}`, cell, style) : i === 6 ? numberCell(`${column(i)}${r}`, cell, moneyStyle) : textCell(`${column(i)}${r}`, cell, style)).join("")}</row>`); });
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="49" customWidth="1"/><col min="3" max="3" width="28" customWidth="1"/><col min="4" max="4" width="21" customWidth="1"/><col min="5" max="5" width="34" customWidth="1"/><col min="6" max="6" width="9" customWidth="1"/><col min="7" max="7" width="16" customWidth="1"/><col min="8" max="8" width="15" customWidth="1"/><col min="9" max="9" width="23" customWidth="1"/><col min="10" max="10" width="21" customWidth="1"/><col min="11" max="11" width="25" customWidth="1"/><col min="12" max="12" width="14" customWidth="1"/></cols><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="R$ #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB0B0B0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>`;
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Vendas" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", styles], ["xl/worksheets/sheet1.xml", sheet]
    ];
    const safeName = (selectedEvent?.name || "vendas").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const url = URL.createObjectURL(zip(files)); const link = document.createElement("a"); link.href = url; link.download = `participantes-${safeName}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
