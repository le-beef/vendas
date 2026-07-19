import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const demoEvents = [
  { id: "demo-1", name: "Festival de Inverno", date: "2026-08-02", place: "Espaço Aurora", capacity: 300, ticketTypes: [{ id: "inteira", name: "Inteira", price: 85, capacity: 200 }, { id: "meia", name: "Meia-entrada", price: 42.5, capacity: 100 }] },
  { id: "demo-2", name: "Noite de Comédia", date: "2026-08-18", place: "Teatro Central", capacity: 180, ticketTypes: [{ id: "padrão", name: "Ingresso padrão", price: 45, capacity: 180 }] }
];
const demoSales = [
  { id: "demo-sale", eventId: "demo-1", ticketTypeId: "inteira", ticketTypeName: "Inteira", buyerName: "Marina Alves", buyerPhone: "(11) 98888-1234", buyerEmail: "", notes: "Retirada no local", paid: true, quantity: 2, total: 170, checkedIn: true, createdAt: Date.now() }
];
let state = { events: [], sales: [] };
let selectedEventId = localStorage.getItem("ingressa-selected-event") || "";
let selectedTicketTypeFilter = "all";
let selectedPaymentFilter = "all";
let participantSearchQuery = "";
let db;
let isDemo = !firebaseConfig.apiKey || !firebaseConfig.databaseURL || location.protocol === "file:";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = (id) => document.getElementById(id);
const ACCESS_KEY = "ingressa-access-v3";

async function start() {
  if (isDemo) {
    state = { events: JSON.parse(localStorage.getItem("ingressa-events") || "null") || demoEvents, sales: JSON.parse(localStorage.getItem("ingressa-sales") || "null") || demoSales };
    if (location.protocol === "file:") $("connectionText").textContent = "Modo local — dados neste navegador";
    render();
    return;
  }
  try {
    const app = initializeApp(firebaseConfig);
    await signInAnonymously(getAuth(app));
    db = getDatabase(app, firebaseConfig.databaseURL);
    if (!db) throw new Error("Banco de dados não inicializado.");
    $("connectionDot").classList.add("online");
    $("connectionText").textContent = "Firebase conectado";
    onValue(ref(db, "events"), (snapshot) => { state.events = objectToArray(snapshot.val()); render(); }, (error) => toast(`Firebase bloqueou a leitura: ${error.code || error.message}`));
    onValue(ref(db, "sales"), (snapshot) => { state.sales = objectToArray(snapshot.val()); render(); }, (error) => toast(`Firebase bloqueou a leitura: ${error.code || error.message}`));
  } catch (error) {
    console.error(error);
    toast(error.code === "auth/operation-not-allowed" ? "Ative o login Anônimo no Firebase Authentication." : "Não foi possível conectar ao Firebase. Confira a configuração.");
  }
}

function objectToArray(value) { return Object.entries(value || {}).map(([id, item]) => ({ id, ...item })); }
function ticketTypesFor(event) {
  const original = event?.ticketTypes?.length ? event.ticketTypes : [{ id: "padrão", name: "Ingresso padrão", price: Number(event?.price || 0) }];
  const hasPerTypeCapacity = original.every((item) => item.capacity !== undefined && item.capacity !== null && item.capacity !== "");
  if (hasPerTypeCapacity) return original.map((item) => ({ ...item, price: Number(item.price || 0), capacity: Math.max(0, Number(item.capacity || 0)) }));
  const previousTotal = Math.max(0, Number(event?.capacity || 0));
  const base = Math.floor(previousTotal / original.length);
  const remainder = previousTotal % original.length;
  return original.map((item, index) => ({ ...item, price: Number(item.price || 0), capacity: base + (index < remainder ? 1 : 0) }));
}
function eventCapacity(event) { return ticketTypesFor(event).reduce((sum, item) => sum + Number(item.capacity || 0), 0); }
function soldForTicket(eventId, ticketType, excludedSaleId = "") {
  return state.sales.filter((sale) => sale.eventId === eventId && sale.id !== excludedSaleId && (sale.ticketTypeId === ticketType.id || (!sale.ticketTypeId && sale.ticketTypeName === ticketType.name))).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
}
function priceLabel(event) { const prices = ticketTypesFor(event).map((item) => Number(item.price)); return prices.length > 1 ? `a partir de ${money.format(Math.min(...prices))}` : money.format(prices[0]); }
function persistDemo() { localStorage.setItem("ingressa-events", JSON.stringify(state.events)); localStorage.setItem("ingressa-sales", JSON.stringify(state.sales)); }
function dateText(value) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || ""; return node.innerHTML; }
function normalizedSearch(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"); }
function matchesParticipantSearch(sale) {
  const query = participantSearchQuery.trim();
  if (!query) return true;
  const textMatch = normalizedSearch(sale.buyerName).includes(normalizedSearch(query));
  const queryDigits = query.replace(/\D/g, "");
  const phoneMatch = queryDigits && String(sale.buyerPhone || "").replace(/\D/g, "").includes(queryDigits);
  return textMatch || Boolean(phoneMatch);
}
function resetParticipantFilters() {
  selectedTicketTypeFilter = "all";
  selectedPaymentFilter = "all";
  participantSearchQuery = "";
}
function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
function whatsappButtonHtml(sale, eventName) {
  const number = whatsappNumber(sale.buyerPhone);
  if (!number) return "";
  const message = `Olá, ${sale.buyerName || "participante"}! Tudo bem? Estou entrando em contato sobre o seu ingresso para ${eventName || "o evento"}.`;
  return `<button class="whatsapp-button" type="button" data-whatsapp data-whatsapp-number="${number}" data-whatsapp-message="${encodeURIComponent(message)}" data-whatsapp-name="${escapeHtml(sale.buyerName || "Participante")}" data-whatsapp-phone="${escapeHtml(sale.buyerPhone || number)}" aria-label="Escolher o WhatsApp para conversar com ${escapeHtml(sale.buyerName || "participante")}"><span aria-hidden="true">●</span> WhatsApp</button>`;
}
function participantContactHtml(sale, eventName) {
  if (!sale.buyerPhone) return "";
  return `<span class="participant-contact"><span>${escapeHtml(sale.buyerPhone)}</span>${whatsappButtonHtml(sale, eventName)}</span>`;
}
function openWhatsappChooser(trigger) {
  const modal = $("whatsappModal");
  modal.dataset.number = trigger.dataset.whatsappNumber || "";
  modal.dataset.message = trigger.dataset.whatsappMessage || "";
  $("whatsappContactName").textContent = trigger.dataset.whatsappName || "Participante";
  $("whatsappContactPhone").textContent = trigger.dataset.whatsappPhone || modal.dataset.number;
  $("whatsappPlatformHint").textContent = /Android/i.test(navigator.userAgent) ? "No Android, o painel tentará abrir diretamente o aplicativo escolhido." : "Neste aparelho, o sistema pode usar o WhatsApp definido como padrão.";
  if (!modal.open) modal.showModal();
}
function launchWhatsapp(appType) {
  const modal = $("whatsappModal");
  const number = modal.dataset.number;
  const message = modal.dataset.message;
  if (!number) return;
  const fallbackUrl = `https://wa.me/${number}?text=${message}`;
  modal.close();
  if (/Android/i.test(navigator.userAgent)) {
    const packageName = appType === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
    const intentUrl = `intent://send?phone=${number}&text=${message}#Intent;scheme=whatsapp;package=${packageName};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
    window.location.assign(intentUrl);
    return;
  }
  window.open(fallbackUrl, "_blank", "noopener,noreferrer");
}
function addTicketTypeRow(name = "", price = "", capacity = "", id = "") { const row = document.createElement("div"); row.className = "ticket-type-row"; row.dataset.ticketId = id; row.innerHTML = `<input class="ticket-name" required aria-label="Nome do tipo ou lote" placeholder="Ex.: 1º lote" value="${escapeHtml(name)}" /><input class="ticket-price" type="number" min="0" step="0.01" required aria-label="Valor do ingresso" placeholder="Valor" value="${price}" /><input class="ticket-capacity" type="number" min="1" step="1" required aria-label="Quantidade disponível" placeholder="Quantidade" value="${capacity}" /><button class="close" type="button" data-remove-ticket aria-label="Remover tipo">×</button>`; $("ticketTypesList").append(row); }
function resetTicketTypes() { $("ticketTypesList").innerHTML = ""; addTicketTypeRow("Ingresso padrão", "", ""); }
function getTicketTypes() { return [...document.querySelectorAll(".ticket-type-row")].map((row, index) => ({ id: row.dataset.ticketId || `tipo-${Date.now()}-${index}`, name: row.querySelector(".ticket-name").value.trim(), price: Number(row.querySelector(".ticket-price").value), capacity: Number(row.querySelector(".ticket-capacity").value) })).filter((item) => item.name && Number.isFinite(item.price) && Number.isInteger(item.capacity) && item.capacity > 0); }
function populateTicketTypes(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  const select = $("saleTicketType");
  const excludedSaleId = $("saleForm").dataset.editId || "";
  select.innerHTML = event ? `<option value="">Selecione o tipo</option>${ticketTypesFor(event).map((item) => { const remaining = Math.max(0, Number(item.capacity) - soldForTicket(event.id, item, excludedSaleId)); return `<option value="${item.id}" ${remaining === 0 ? "disabled" : ""}>${escapeHtml(item.name)} — ${money.format(item.price)} — ${remaining} disponíveis</option>`; }).join("")}` : `<option value="">Selecione primeiro o evento</option>`;
}
function addSaleEditButtons() { document.querySelectorAll("[data-sale-row]").forEach((row) => { const actions = row.lastElementChild; if (!actions?.querySelector("[data-edit-sale]")) { const button = document.createElement("button"); button.type = "button"; button.className = "edit-button"; button.dataset.editSale = row.dataset.saleRow; button.textContent = "Editar"; actions.prepend(button); } }); }

function render() {
  const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  const sales = [...state.sales].sort((a, b) => b.createdAt - a.createdAt);
  if (!events.some((event) => event.id === selectedEventId)) selectedEventId = events[0]?.id || "";
  if (selectedEventId) localStorage.setItem("ingressa-selected-event", selectedEventId); else localStorage.removeItem("ingressa-selected-event");
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedSales = sales.filter((sale) => sale.eventId === selectedEventId);
  const availableTicketTypes = selectedEvent ? ticketTypesFor(selectedEvent) : [];
  if (selectedTicketTypeFilter !== "all" && !availableTicketTypes.some((type) => type.id === selectedTicketTypeFilter)) selectedTicketTypeFilter = "all";
  const selectedTypeName = availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter)?.name;
  const visibleSales = selectedSales.filter((sale) => {
    const matchesTicketType = selectedTicketTypeFilter === "all" || sale.ticketTypeId === selectedTicketTypeFilter || sale.ticketTypeName === selectedTypeName;
    const matchesPayment = selectedPaymentFilter === "all" || (selectedPaymentFilter === "paid" ? sale.paid : !sale.paid);
    return matchesTicketType && matchesPayment && matchesParticipantSearch(sale);
  });
  const visibleSold = visibleSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const visibleSalesTotal = visibleSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const visibleCapacity = selectedTicketTypeFilter === "all" ? eventCapacity(selectedEvent) : Number(availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter)?.capacity || 0);
  const sold = selectedSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const revenuePaid = selectedSales.filter((sale) => sale.paid).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const revenuePending = selectedSales.filter((sale) => !sale.paid).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const revenueTotal = revenuePaid + revenuePending;
  const checkins = selectedSales.filter((sale) => sale.checkedIn).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  $("selectedEventArea").hidden = !selectedEvent;
  $("ticketTypeFilter").innerHTML = `<option value="all">Todos</option>${availableTicketTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")}`;
  $("ticketTypeFilter").value = selectedTicketTypeFilter;
  $("paymentStatusFilter").value = selectedPaymentFilter;
  $("participantSearch").value = participantSearchQuery;
  const activeFilterCount = Number(selectedTicketTypeFilter !== "all") + Number(selectedPaymentFilter !== "all");
  $("filterLabel").textContent = activeFilterCount > 1 ? `${activeFilterCount} filtros` : selectedPaymentFilter === "paid" ? "Pago" : selectedPaymentFilter === "pending" ? "Pendente" : selectedTicketTypeFilter === "all" ? "Todos" : selectedTypeName || "Todos";
  $("clearParticipantFilters").hidden = !participantSearchQuery && activeFilterCount === 0;
  $("filterCount").textContent = `${visibleSold} ${visibleSold === 1 ? "vendido" : "vendidos"} • ${visibleCapacity} ${visibleCapacity === 1 ? "disponível" : "disponíveis"}`;
  $("allSalesTotalLabel").textContent = participantSearchQuery || activeFilterCount ? "Total vendido — resultados filtrados" : "Total vendido — Todos";
  $("allSalesTotal").textContent = money.format(visibleSalesTotal);
  $("revenue").textContent = money.format(revenueTotal); $("revenuePaid").textContent = money.format(revenuePaid); $("revenuePending").textContent = money.format(revenuePending); $("sold").textContent = sold; $("capacity").textContent = eventCapacity(selectedEvent); $("checkins").textContent = checkins;
  if (selectedEvent) { $("selectedEventName").textContent = selectedEvent.name; $("selectedEventMeta").textContent = `${selectedEvent.place} · ${dateText(selectedEvent.date)} · ${priceLabel(selectedEvent)}`; $("salesPanelTitle").textContent = `Vendas de ${selectedEvent.name}`; $("allSalesTitle").textContent = `Participantes — ${selectedEvent.name}`; }
  $("eventsList").innerHTML = events.length ? events.map((event) => {
    const eventSold = sales.filter((sale) => sale.eventId === event.id).reduce((sum, sale) => sum + Number(sale.quantity), 0);
    return `<div class="event-card ${event.id === selectedEventId ? "is-selected" : ""}" data-select-event="${event.id}" role="button" tabindex="0" aria-pressed="${event.id === selectedEventId}"><span class="calendar"><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><span class="event-info"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.place)} · ${priceLabel(event)}</small></span><span class="event-count">${eventSold}/${eventCapacity(event)}</span></div>`;
  }).join("") : `<div class="empty">Nenhum evento cadastrado ainda.</div>`;
  $("salesList").innerHTML = visibleSales.length ? visibleSales.slice(0, 7).map((sale) => `<tr class="sales-row" data-sale-row="${sale.id}"><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${sale.quantity} ingresso${sale.quantity > 1 ? "s" : ""}</small>${participantContactHtml(sale, selectedEvent?.name)}</td><td>${escapeHtml(sale.ticketTypeName || "Ingresso padrão")}</td><td class="sale-observation">${escapeHtml(sale.notes || "Sem observação")}</td><td>${money.format(sale.total)}</td><td><button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button></td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td><button class="delete-button" data-delete-sale="${sale.id}">Excluir</button></td></tr>`).join("") : `<tr><td colspan="7" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhuma venda neste evento."}</td></tr>`;
  $("allSalesList").innerHTML = visibleSales.length ? visibleSales.map((sale) => `<tr class="sales-row" data-sale-row="${sale.id}"><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${sale.quantity} ingresso${sale.quantity > 1 ? "s" : ""}</small></td><td>${escapeHtml(sale.ticketTypeName || "Ingresso padrão")}</td><td class="sale-note"><span class="phone-line"><strong>${escapeHtml(sale.buyerPhone || "Não informado")}</strong>${whatsappButtonHtml(sale, selectedEvent?.name)}</span>${sale.notes ? `<small>${escapeHtml(sale.notes)}</small>` : ""}</td><td>${escapeHtml(selectedEvent?.name || "Evento removido")}</td><td>${money.format(sale.total)}</td><td><button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button></td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td><button class="delete-button" data-delete-sale="${sale.id}">Excluir</button></td></tr>`).join("") : `<tr><td colspan="8" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhum participante neste evento."}</td></tr>`;
  addSaleEditButtons();
  const currentEvent = $("saleEvent").value; $("saleEvent").innerHTML = `<option value="">Selecione o evento</option>${events.map((event) => `<option value="${event.id}">${escapeHtml(event.name)} — ${priceLabel(event)}</option>`).join("")}`; if (events.some((event) => event.id === currentEvent)) $("saleEvent").value = currentEvent; populateTicketTypes($("saleEvent").value);
}

async function saveEvent(data, id = "") {
  const eventSales = state.sales.filter((sale) => sale.eventId === id);
  if (id) {
    const keptIds = new Set(data.ticketTypes.map((item) => item.id));
    const removedWithSales = eventSales.find((sale) => sale.ticketTypeId && !keptIds.has(sale.ticketTypeId));
    if (removedWithSales) throw new Error(`Não é possível remover o tipo “${removedWithSales.ticketTypeName}” porque ele já possui vendas.`);
    for (const type of data.ticketTypes) {
      const alreadySold = soldForTicket(id, type);
      if (alreadySold > type.capacity) throw new Error(`O tipo “${type.name}” já possui ${alreadySold} vendidos. Informe uma quantidade igual ou maior.`);
    }
  }
  const capacity = data.ticketTypes.reduce((sum, item) => sum + Number(item.capacity), 0);
  const eventData = { name: data.name.trim(), date: data.date, place: data.place.trim(), capacity, ticketTypes: data.ticketTypes, updatedAt: Date.now() };
  if (isDemo) { if (id) state.events = state.events.map((item) => item.id === id ? { ...item, ...eventData } : item); else { selectedEventId = crypto.randomUUID(); state.events.push({ id: selectedEventId, ...eventData, createdAt: Date.now() }); } persistDemo(); render(); }
  else if (id) await update(ref(db, `events/${id}`), eventData); else { const eventRef = push(ref(db, "events")); selectedEventId = eventRef.key; await set(eventRef, { ...eventData, createdAt: Date.now() }); }
  toast(id ? "Evento atualizado." : "Evento criado com sucesso.");
}
async function saveSale(data, id = "") {
  const event = state.events.find((item) => item.id === data.eventId); if (!event) throw new Error("Selecione um evento.");
  const ticketType = ticketTypesFor(event).find((item) => item.id === data.ticketTypeId); if (!ticketType) throw new Error("Selecione o tipo de ingresso.");
  const quantity = Number(data.quantity); if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Informe uma quantidade válida.");
  const soldForType = soldForTicket(event.id, ticketType, id);
  const remaining = Math.max(0, Number(ticketType.capacity) - soldForType);
  if (quantity > remaining) throw new Error(`Restam apenas ${remaining} ingressos do tipo “${ticketType.name}”.`);
  const current = state.sales.find((sale) => sale.id === id);
  const saleData = { eventId: event.id, ticketTypeId: ticketType.id, ticketTypeName: ticketType.name, buyerName: data.buyerName.trim(), buyerPhone: data.buyerPhone.trim(), buyerEmail: data.buyerEmail.trim(), notes: data.notes.trim(), paid: data.paymentStatus === "paid", quantity, total: Number(ticketType.price) * quantity, checkedIn: current?.checkedIn || false, updatedAt: Date.now() };
  if (isDemo) { if (id) state.sales = state.sales.map((item) => item.id === id ? { ...item, ...saleData } : item); else state.sales.push({ id: crypto.randomUUID(), ...saleData, createdAt: Date.now() }); persistDemo(); render(); }
  else if (id) await update(ref(db, `sales/${id}`), saleData); else await set(push(ref(db, "sales")), { ...saleData, createdAt: Date.now() });
  toast(id ? "Participante atualizado." : "Venda registrada.");
}
async function toggleCheckin(id) { const sale = state.sales.find((item) => item.id === id); if (!sale) return; const value = !sale.checkedIn; if (isDemo) { sale.checkedIn = value; persistDemo(); render(); } else { await update(ref(db, `sales/${id}`), { checkedIn: value }); } }
async function togglePayment(id) { const sale = state.sales.find((item) => item.id === id); if (!sale) return; const value = !sale.paid; if (isDemo) { sale.paid = value; persistDemo(); render(); } else { await update(ref(db, `sales/${id}`), { paid: value }); } }
async function deleteSale(id) { const sale = state.sales.find((item) => item.id === id); if (!sale || !confirm(`Excluir a venda de ${sale.buyerName}?`)) return; if (isDemo) { state.sales = state.sales.filter((item) => item.id !== id); persistDemo(); render(); } else { await update(ref(db), { [`sales/${id}`]: null }); } toast("Venda excluída."); }
async function deleteEvent(id) { const event = state.events.find((item) => item.id === id); if (!event || !confirm(`Excluir o evento “${event.name}” e todas as vendas dele? Esta ação não pode ser desfeita.`)) return; const changes = { [`events/${id}`]: null }; state.sales.filter((sale) => sale.eventId === id).forEach((sale) => { changes[`sales/${sale.id}`] = null; }); if (isDemo) { state.events = state.events.filter((item) => item.id !== id); state.sales = state.sales.filter((sale) => sale.eventId !== id); persistDemo(); render(); } else { await update(ref(db), changes); } toast("Evento e vendas vinculadas excluídos."); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("visible"); setTimeout(() => el.classList.remove("visible"), 3200); }

function openNewEvent() { const form = $("eventForm"); form.reset(); form.dataset.editId = ""; $("eventModalTitle").textContent = "Novo evento"; $("eventSubmitButton").textContent = "Criar evento"; resetTicketTypes(); $("eventModal").showModal(); }
function openEditEvent(id) { const item = state.events.find((event) => event.id === id); if (!item) return; const form = $("eventForm"); form.dataset.editId = id; form.elements.name.value = item.name || ""; form.elements.date.value = item.date || ""; form.elements.place.value = item.place || ""; $("ticketTypesList").innerHTML = ""; ticketTypesFor(item).forEach((type) => addTicketTypeRow(type.name, type.price, type.capacity, type.id)); $("eventModalTitle").textContent = "Editar evento"; $("eventSubmitButton").textContent = "Salvar alterações"; $("eventModal").showModal(); }
function openNewSale(eventId = "") { if (!state.events.length) return toast("Cadastre um evento antes de registrar uma venda."); const form = $("saleForm"); form.reset(); form.dataset.editId = ""; $("saleModalTitle").textContent = "Registrar ingresso"; $("saleSubmitButton").textContent = "Confirmar venda"; $("saleEvent").value = eventId; populateTicketTypes(eventId); $("saleModal").showModal(); }
function openEditSale(id) { const sale = state.sales.find((item) => item.id === id); if (!sale) return; if ($("allSalesModal").open) $("allSalesModal").close(); const form = $("saleForm"); form.reset(); form.dataset.editId = id; $("saleEvent").value = sale.eventId; populateTicketTypes(sale.eventId); form.elements.ticketTypeId.value = sale.ticketTypeId || ""; form.elements.buyerName.value = sale.buyerName || ""; form.elements.buyerPhone.value = sale.buyerPhone || ""; form.elements.buyerEmail.value = sale.buyerEmail || ""; form.elements.quantity.value = sale.quantity || 1; form.elements.paymentStatus.value = sale.paid ? "paid" : "pending"; form.elements.notes.value = sale.notes || ""; $("saleModalTitle").textContent = "Editar participante"; $("saleSubmitButton").textContent = "Salvar alterações"; $("saleModal").showModal(); }

document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.open === "eventModal") return openNewEvent(); if (button.dataset.open === "saleModal") return openNewSale(selectedEventId); $(button.dataset.open).showModal(); }));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
$("addTicketType").addEventListener("click", () => addTicketTypeRow());
$("saleEvent").addEventListener("change", () => populateTicketTypes($("saleEvent").value));
$("ticketTypeFilter").addEventListener("change", (event) => { selectedTicketTypeFilter = event.currentTarget.value; document.querySelector(".ticket-filter").open = false; render(); });
$("paymentStatusFilter").addEventListener("change", (event) => { selectedPaymentFilter = event.currentTarget.value; document.querySelector(".ticket-filter").open = false; render(); });
$("participantSearch").addEventListener("input", (event) => { participantSearchQuery = event.currentTarget.value; render(); });
$("participantSearch").addEventListener("keydown", (event) => { if (event.key === "Escape") { participantSearchQuery = ""; render(); event.currentTarget.focus(); } });
$("clearParticipantFilters").addEventListener("click", () => { resetParticipantFilters(); render(); $("participantSearch").focus(); });
$("eventsList").addEventListener("click", (event) => { if (event.target.closest("[data-select-event]")) resetParticipantFilters(); });
$("eventForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); data.ticketTypes = getTicketTypes(); if (!data.ticketTypes.length) throw new Error("Informe ao menos um tipo ou lote com valor e quantidade."); await saveEvent(data, form.dataset.editId); form.reset(); resetTicketTypes(); $("eventModal").close(); } catch (error) { toast(error.message); } });
$("saleForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { await saveSale(Object.fromEntries(new FormData(form)), form.dataset.editId); form.reset(); $("saleModal").close(); } catch (error) { toast(error.message); } });
document.addEventListener("click", (event) => { const whatsappTrigger = event.target.closest("[data-whatsapp]"); if (whatsappTrigger) { event.preventDefault(); openWhatsappChooser(whatsappTrigger); return; } const whatsappApp = event.target.closest("[data-whatsapp-app]"); if (whatsappApp) { launchWhatsapp(whatsappApp.dataset.whatsappApp); return; } const removeTicket = event.target.closest("[data-remove-ticket]"); if (removeTicket) { if (document.querySelectorAll(".ticket-type-row").length === 1) return toast("O evento precisa de pelo menos um tipo de ingresso."); removeTicket.closest(".ticket-type-row").remove(); return; } const selectedAction = event.target.closest("[data-selected-action]"); if (selectedAction) { const action = selectedAction.dataset.selectedAction; if (action === "sale") openNewSale(selectedEventId); if (action === "edit") openEditEvent(selectedEventId); if (action === "export") window.exportSalesXlsx(state.sales, state.events, selectedEventId); if (action === "delete") deleteEvent(selectedEventId); return; } const selectEvent = event.target.closest("[data-select-event]"); if (selectEvent) { selectedEventId = selectEvent.dataset.selectEvent; render(); return; } const editSaleButton = event.target.closest("[data-edit-sale]"); if (editSaleButton) { openEditSale(editSaleButton.dataset.editSale); return; } const deleteSaleButton = event.target.closest("[data-delete-sale]"); if (deleteSaleButton) { deleteSale(deleteSaleButton.dataset.deleteSale); return; } const checkin = event.target.closest("[data-checkin]"); if (checkin) { toggleCheckin(checkin.dataset.checkin); return; } const paid = event.target.closest("[data-paid]"); if (paid) { togglePayment(paid.dataset.paid); return; } const saleRow = event.target.closest("[data-sale-row]"); if (saleRow) { openEditSale(saleRow.dataset.saleRow); return; } });
document.addEventListener("keydown", (event) => { const card = event.target.closest?.("[data-select-event]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedEventId = card.dataset.selectEvent; resetParticipantFilters(); render(); } });
if (localStorage.getItem(ACCESS_KEY) === "granted") start();
else window.addEventListener("ingressa:access-granted", start, { once: true });
resetTicketTypes();
