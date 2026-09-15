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
  const moneyText = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  window.exportSalesXlsx = (sales, events, eventId, mode = "unit") => {
    const paymentMethods = { pix: "PIX", cash: "DINHEIRO", credit_card: "CARTÃO DE CRÉDITO", debit_card: "CARTÃO DE DÉBITO", bank_transfer: "TRANSFERÊNCIA", other: "OUTRO", courtesy: "CORTESIA" };
    const paymentDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "";
    const eventName = (id) => events.find((event) => event.id === id)?.name || "Evento removido";
    const saleItems = (sale) => {
      const storedItems = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
      if (storedItems.length) return storedItems.map((item) => {
        const components = Array.isArray(item.components) ? item.components : Object.values(item.components || {});
        const composition = components.map((component) => `${Number(component.quantity || 0)}x ${component.ticketTypeName || "Ingresso"}`).join(" + ");
        const isCourtesy = item.packageKind === "courtesy" || /^Cortesia:/i.test(String(item.ticketTypeName || ""));
        const ticketTypeName = item.kind === "package" || item.packageId ? `${isCourtesy ? "CORTESIA" : "PACOTE"}: ${item.packageName || String(item.ticketTypeName || (isCourtesy ? "Cortesia" : "Pacote")).replace(/^(?:Pacote|Cortesia):\s*/i, "")}${composition ? ` (${composition})` : ""}` : item.ticketTypeName || "Ingresso padrão";
        return { ticketTypeName, quantity: Number(item.quantity || 0), subtotal: Number(item.subtotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0)) };
      });
      return [{ ticketTypeName: sale.ticketTypeName || "Ingresso padrão", quantity: Number(sale.quantity || 0), subtotal: Number(sale.total || 0) }];
    };
    const selectedEvent = events.find((event) => event.id === eventId);
    const allSelectedSales = (eventId ? sales.filter((sale) => sale.eventId === eventId) : sales).filter((sale) => sale.reservationType !== "table_block" && sale.nonRevenue !== true);
    const selectedSales = mode === "checkins" ? allSelectedSales : allSelectedSales.filter((sale) => mode === "tables" ? sale.reservationType === "table" : sale.reservationType !== "table");
    const reservationOccupants = (sale) => {
      const stored = Array.isArray(sale.occupants) ? sale.occupants : Object.values(sale.occupants || {});
      const names = stored.map((name) => String(name || "").trim()).filter(Boolean);
      if (!names.length && sale.buyerName) names.push(String(sale.buyerName).trim());
      return names;
    };
    const reservationCheckins = (sale) => {
      const stored = Array.isArray(sale.occupantCheckins) ? sale.occupantCheckins : Object.keys(sale.occupantCheckins || {}).sort((a, b) => Number(a) - Number(b)).map((key) => sale.occupantCheckins[key]);
      return reservationOccupants(sale).map((name, index) => `${name}: ${stored[index] ? "SIM" : "NÃO"}`).join(", ");
    };
    const reservationDiscounts = (sale) => {
      const stored = Array.isArray(sale.occupantPricing) ? sale.occupantPricing : Object.keys(sale.occupantPricing || {}).sort((a, b) => Number(a) - Number(b)).map((key) => sale.occupantPricing[key]);
      return reservationOccupants(sale).map((name, index) => {
        const item = stored[index] || {};
        const value = Math.max(0, Number(item.discountValue || 0));
        if (!value) return "";
        return `${name}: ${item.discountType === "fixed" ? moneyText(value) : `${value}%`}`;
      }).filter(Boolean).join(", ") || "SEM DESCONTO";
    };
    const arrayValue = (value) => Array.isArray(value) ? value : Object.keys(value || {}).sort((a, b) => Number(a) - Number(b)).map((key) => value[key]);
    const storedQrTickets = (sale) => arrayValue(sale.qrTickets).filter(Boolean);
    const qrValidationUrl = (token) => {
      if (!token) return "";
      const base = location.protocol === "file:" ? "https://le-beef.github.io/vendas/" : `${location.origin}${location.pathname}`;
      return `${base}#validar=${encodeURIComponent(token)}`;
    };
    const checkinDateTime = (value) => value ? new Date(Number(value)).toLocaleString("pt-BR") : "";
    const individualTicketUnits = (sale) => {
      const groups = [];
      saleItems(sale).forEach((item) => {
        const components = arrayValue(item.components).filter(Boolean);
        if ((item.kind === "package" || item.packageId) && components.length) {
          const totalUnits = components.reduce((sum, component) => sum + Number(component.quantity || 0) * Number(item.quantity || 0), 0);
          const unitValue = totalUnits ? Number(item.subtotal || 0) / totalUnits : 0;
          components.forEach((component) => groups.push({ name: component.ticketTypeName || item.ticketTypeName || "Ingresso", quantity: Number(component.quantity || 0) * Number(item.quantity || 0), unitValue }));
        } else {
          const quantity = Number(item.quantity || 0);
          groups.push({ name: item.ticketTypeName || "Ingresso padrão", quantity, unitValue: quantity ? Number(item.subtotal || 0) / quantity : 0 });
        }
      });
      return groups.flatMap((group) => Array.from({ length: group.quantity }, () => ({ ticketTypeName: group.name, value: group.unitValue })));
    };
    const checkinRows = (sale) => {
      const qrTickets = storedQrTickets(sale);
      const payment = sale.courtesy || sale.paymentMethod === "courtesy" ? "CORTESIA" : sale.paid ? "PAGO" : "PENDENTE";
      const paymentMethod = payment === "CORTESIA" ? "CORTESIA" : sale.paid ? paymentMethods[sale.paymentMethod] || "NÃO INFORMADA" : "";
      const paidAt = payment === "CORTESIA" ? "" : sale.paid ? paymentDate(sale.paymentDate) : "";
      const common = [eventName(sale.eventId), sale.reservationType === "table" ? String(sale.furnitureKind || "mesa").toUpperCase() : "INDIVIDUAL"];
      if (sale.reservationType === "table") {
        const occupants = reservationOccupants(sale);
        const checkins = arrayValue(sale.occupantCheckins);
        const pricing = arrayValue(sale.occupantPricing);
        const fallbackValue = occupants.length ? Number(sale.total || 0) / occupants.length : 0;
        return occupants.map((name, index) => {
          const qr = qrTickets.find((ticket) => Number(ticket.occupantIndex) === index) || qrTickets[index] || {};
          const checked = qr.checkedIn === undefined ? Boolean(checkins[index]) : Boolean(qr.checkedIn);
          const discount = Number(pricing[index]?.discountValue || 0);
          return [...common, (sale.mapArea || sale.reservationArea) === "mezanino" ? "MEZANINO" : "SALÃO", sale.reservationLabel || "RESERVA", name || sale.buyerName || "Participante", sale.buyerName || "", sale.buyerPhone || "", `${sale.reservationLabel || "Reserva"} - cadeira ${index + 1}`, discount ? pricing[index]?.discountType === "fixed" ? moneyText(discount) : `${discount}%` : "SEM DESCONTO", 1, Number(pricing[index]?.finalPrice ?? fallbackValue), payment, paymentMethod, paidAt, sale.createdByName || "VENDAS ANTERIORES", sale.notes || "", checked ? "SIM" : "NÃO", checked ? checkinDateTime(qr.checkedInAt) : "", qr.token ? "GERADO" : "NÃO GERADO", qr.token ? String(qr.token).slice(-8).toUpperCase() : "", qrValidationUrl(qr.token)];
        });
      }
      const names = arrayValue(sale.participantNames).map((name) => String(name || "").trim());
      const units = individualTicketUnits(sale);
      return units.map((unit, index) => {
        const qr = qrTickets[index] || {};
        const checked = qr.checkedIn === undefined ? Boolean(sale.checkedIn) : Boolean(qr.checkedIn);
        const participant = qr.participantName || names[index] || (index ? `${sale.buyerName || "Participante"}/Convidado-${index + 1}` : sale.buyerName) || "Participante";
        return [...common, "", "", participant, sale.buyerName || "", sale.buyerPhone || "", qr.ticketTypeName || unit.ticketTypeName, "", 1, Number(unit.value || 0), payment, paymentMethod, paidAt, sale.createdByName || "VENDAS ANTERIORES", sale.notes || "", checked ? "SIM" : "NÃO", checked ? checkinDateTime(qr.checkedInAt) : "", qr.token ? "GERADO" : "NÃO GERADO", qr.token ? String(qr.token).slice(-8).toUpperCase() : "", qrValidationUrl(qr.token)];
      });
    };
    const header = mode === "checkins"
      ? ["EVENTO", "MODALIDADE", "ÁREA", "MESA / BISTRÔ", "PARTICIPANTE", "RESPONSÁVEL", "TELEFONE", "TIPO DE INGRESSO", "DESCONTO", "QTD.", "VALOR", "PAGAMENTO", "FORMA DE PAGAMENTO", "DATA DO PAGAMENTO", "VENDEDOR", "OBSERVAÇÃO", "ENTRADA", "DATA / HORA DO CHECK-IN", "QR CODE", "CÓDIGO", "LINK DE VALIDAÇÃO"]
      : mode === "tables"
      ? ["EVENTO", "ÁREA", "MESA / BISTRÔ", "RESPONSÁVEL", "TELEFONE", "OCUPANTES", "DESCONTOS DAS CADEIRAS", "QTD.", "VALOR", "PAGAMENTO", "FORMA DE PAGAMENTO", "DATA DO PAGAMENTO", "VENDEDOR", "OBSERVAÇÃO", "ENTRADAS"]
      : ["EVENTO", "TIPO DE INGRESSO", "PARTICIPANTE", "TELEFONE / CONTATO", "OBSERVAÇÃO", "QTD.", "VALOR", "PAGAMENTO", "FORMA DE PAGAMENTO", "DATA DO PAGAMENTO", "VENDEDOR", "ENTRADA"];
    const rows = mode === "checkins"
      ? selectedSales.flatMap(checkinRows)
      : mode === "tables"
      ? selectedSales.map((sale) => [eventName(sale.eventId), (sale.mapArea || sale.reservationArea) === "mezanino" ? "MEZANINO" : "SALÃO", sale.reservationLabel || "RESERVA", sale.buyerName || "", sale.buyerPhone || "", reservationOccupants(sale).join(", "), reservationDiscounts(sale), Number(sale.quantity || 0), Number(sale.total || 0), sale.paid ? "PAGO" : "PENDENTE", sale.paid ? paymentMethods[sale.paymentMethod] || "NÃO INFORMADA" : "", sale.paid ? paymentDate(sale.paymentDate) : "", sale.createdByName || "VENDAS ANTERIORES", sale.notes || "", reservationCheckins(sale)])
      : selectedSales.flatMap((sale) => saleItems(sale).map((item) => { const courtesy = sale.courtesy || sale.paymentMethod === "courtesy" || /^CORTESIA:/i.test(item.ticketTypeName); return [eventName(sale.eventId), item.ticketTypeName, sale.buyerName || "", sale.buyerPhone || "", sale.notes || "", item.quantity, item.subtotal, courtesy ? "CORTESIA" : sale.paid ? "PAGO" : "PENDENTE", courtesy ? "CORTESIA" : sale.paid ? paymentMethods[sale.paymentMethod] || "NÃO INFORMADA" : "", courtesy ? "" : sale.paid ? paymentDate(sale.paymentDate) : "", sale.createdByName || "VENDAS ANTERIORES", sale.checkedIn ? "SIM" : "NÃO"]; }));
    const sheetRows = [`<row r="1">${header.map((cell, i) => textCell(`${column(i)}1`, cell, 1)).join("")}</row>`];
    rows.forEach((row, index) => { const r = index + 2, style = index % 2 ? 2 : 0, moneyStyle = index % 2 ? 4 : 3, quantityIndex = mode === "checkins" ? 9 : mode === "tables" ? 7 : 5, moneyIndex = mode === "checkins" ? 10 : mode === "tables" ? 8 : 6; sheetRows.push(`<row r="${r}">${row.map((cell, i) => i === quantityIndex ? numberCell(`${column(i)}${r}`, cell, style) : i === moneyIndex ? numberCell(`${column(i)}${r}`, cell, moneyStyle) : textCell(`${column(i)}${r}`, cell, style)).join("")}</row>`); });
    const widths = mode === "checkins" ? [25,16,14,19,28,28,20,34,18,8,15,14,22,18,25,34,12,24,13,14,58] : [25,49,28,21,34,9,16,15,23,21,25,14,24,34,24];
    const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="R$ #,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB0B0B0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom></border></borders><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="3" borderId="1" applyNumberFormat="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>`;
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${mode === "checkins" ? "Check-ins" : "Vendas"}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", styles], ["xl/worksheets/sheet1.xml", sheet]
    ];
    const safeName = (selectedEvent?.name || "vendas").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const filePrefix = mode === "checkins" ? "check-ins-completo" : mode === "tables" ? "reservas-mesas" : "participantes";
    const url = URL.createObjectURL(zip(files)); const link = document.createElement("a"); link.href = url; link.download = `${filePrefix}-${safeName}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
