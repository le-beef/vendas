import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const demoEvents = [
  { id: "demo-1", name: "Festival de Inverno", date: "2026-08-02", place: "Espaço Aurora", capacity: 300, ticketTypes: [{ id: "inteira", name: "Inteira", price: 85 }, { id: "meia", name: "Meia-entrada", price: 42.5 }] },
  { id: "demo-2", name: "Noite de Comédia", date: "2026-08-18", place: "Teatro Central", capacity: 180, ticketTypes: [{ id: "padrão", name: "Ingresso padrão", price: 45 }] }
];
const demoSales = [
  { id: "demo-sale", eventId: "demo-1", ticketTypeId: "inteira", ticketTypeName: "Inteira", buyerName: "Marina Alves", buyerPhone: "(11) 98888-1234", buyerEmail: "", notes: "Retirada no local", paid: true, quantity: 2, total: 170, checkedIn: true, createdAt: Date.now() }
];
let state = { events: [], sales: [] };
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
function ticketTypesFor(event) { return event?.ticketTypes?.length ? event.ticketTypes : [{ id: "padrão", name: "Ingresso padrão", price: Number(event?.price || 0) }]; }
function priceLabel(event) { const prices = ticketTypesFor(event).map((item) => Number(item.price)); return prices.length > 1 ? `a partir de ${money.format(Math.min(...prices))}` : money.format(prices[0]); }
function persistDemo() { localStorage.setItem("ingressa-events", JSON.stringify(state.events)); localStorage.setItem("ingressa-sales", JSON.stringify(state.sales)); }
function dateText(value) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || ""; return node.innerHTML; }
function addTicketTypeRow(name = "", price = "") { const row = document.createElement("div"); row.className = "ticket-type-row"; row.innerHTML = `<input class="ticket-name" required placeholder="Ex.: Meia-entrada" value="${escapeHtml(name)}" /><input class="ticket-price" type="number" min="0" step="0.01" required placeholder="Valor" value="${price}" /><button class="close" type="button" data-remove-ticket aria-label="Remover tipo">×</button>`; $("ticketTypesList").append(row); }
function resetTicketTypes() { $("ticketTypesList").innerHTML = ""; addTicketTypeRow("Ingresso padrão", ""); }
function getTicketTypes() { return [...document.querySelectorAll(".ticket-type-row")].map((row, index) => ({ id: `tipo-${Date.now()}-${index}`, name: row.querySelector(".ticket-name").value.trim(), price: Number(row.querySelector(".ticket-price").value) })).filter((item) => item.name && Number.isFinite(item.price)); }
function populateTicketTypes(eventId) { const event = state.events.find((item) => item.id === eventId); const select = $("saleTicketType"); select.innerHTML = event ? `<option value="">Selecione o tipo</option>${ticketTypesFor(event).map((item) => `<option value="${item.id}">${escapeHtml(item.name)} — ${money.format(item.price)}</option>`).join("")}` : `<option value="">Selecione primeiro o evento</option>`; }

function render() {
  const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  const sales = [...state.sales].sort((a, b) => b.createdAt - a.createdAt);
  const sold = sales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const revenue = sales.filter((sale) => sale.paid).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const checkins = sales.filter((sale) => sale.checkedIn).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  $("revenue").textContent = money.format(revenue); $("sold").textContent = sold; $("capacity").textContent = events.reduce((sum, event) => sum + Number(event.capacity || 0), 0); $("checkins").textContent = checkins;
  $("eventsList").innerHTML = events.length ? events.map((event) => {
    const eventSold = sales.filter((sale) => sale.eventId === event.id).reduce((sum, sale) => sum + Number(sale.quantity), 0);
    return `<div class="event-card" data-event="${event.id}" role="button" tabindex="0"><span class="calendar"><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><span class="event-info"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.place)} · ${dateText(event.date)}</small></span><span class="event-count">${eventSold}/${event.capacity}</span><button class="event-delete" type="button" data-delete-event="${event.id}">Excluir</button></div>`;
  }).join("") : `<div class="empty">Nenhum evento cadastrado ainda.</div>`;
  $("salesList").innerHTML = sales.length ? sales.slice(0, 7).map((sale) => { const event = events.find((item) => item.id === sale.eventId); return `<tr><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${escapeHtml(sale.ticketTypeName || "Ingresso padrão")} · ${sale.quantity} ingresso${sale.quantity > 1 ? "s" : ""}</small></td><td>${escapeHtml(event?.name || "Evento removido")}</td><td>${money.format(sale.total)}</td><td><button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button></td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td><button class="delete-button" data-delete-sale="${sale.id}">Excluir</button></td></tr>`; }).join("") : `<tr><td colspan="6" class="empty">Nenhuma venda registrada.</td></tr>`;
  $("allSalesList").innerHTML = sales.length ? sales.map((sale) => { const event = events.find((item) => item.id === sale.eventId); return `<tr><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${sale.quantity} ingresso${sale.quantity > 1 ? "s" : ""}</small></td><td>${escapeHtml(sale.ticketTypeName || "Ingresso padrão")}</td><td class="sale-note"><strong>${escapeHtml(sale.buyerPhone || "Não informado")}</strong>${sale.notes ? `<small>${escapeHtml(sale.notes)}</small>` : ""}</td><td>${escapeHtml(event?.name || "Evento removido")}</td><td>${money.format(sale.total)}</td><td><button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button></td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td><button class="delete-button" data-delete-sale="${sale.id}">Excluir</button></td></tr>`; }).join("") : `<tr><td colspan="8" class="empty">Nenhuma venda registrada.</td></tr>`;
  const currentEvent = $("saleEvent").value; $("saleEvent").innerHTML = `<option value="">Selecione o evento</option>${events.map((event) => `<option value="${event.id}">${escapeHtml(event.name)} — ${priceLabel(event)}</option>`).join("")}`; if (events.some((event) => event.id === currentEvent)) $("saleEvent").value = currentEvent; populateTicketTypes($("saleEvent").value);
}

async function createEvent(data) {
  const event = { name: data.name.trim(), date: data.date, place: data.place.trim(), capacity: Number(data.capacity), ticketTypes: data.ticketTypes, createdAt: Date.now() };
  if (isDemo) { state.events.push({ id: crypto.randomUUID(), ...event }); persistDemo(); render(); } else { await set(push(ref(db, "events")), event); }
  toast("Evento criado com sucesso.");
}
async function createSale(data) {
  const event = state.events.find((item) => item.id === data.eventId); if (!event) throw new Error("Selecione um evento.");
  const soldForEvent = state.sales.filter((sale) => sale.eventId === event.id).reduce((sum, sale) => sum + Number(sale.quantity), 0);
  const ticketType = ticketTypesFor(event).find((item) => item.id === data.ticketTypeId); if (!ticketType) throw new Error("Selecione o tipo de ingresso.");
  const quantity = Number(data.quantity); if (soldForEvent + quantity > event.capacity) throw new Error("A quantidade ultrapassa a capacidade disponível.");
  const sale = { eventId: event.id, ticketTypeId: ticketType.id, ticketTypeName: ticketType.name, buyerName: data.buyerName.trim(), buyerPhone: data.buyerPhone.trim(), buyerEmail: data.buyerEmail.trim(), notes: data.notes.trim(), paid: data.paymentStatus === "paid", quantity, total: Number(ticketType.price) * quantity, checkedIn: false, createdAt: Date.now() };
  if (isDemo) { state.sales.push({ id: crypto.randomUUID(), ...sale }); persistDemo(); render(); } else { await set(push(ref(db, "sales")), sale); }
  toast("Venda registrada.");
}
async function toggleCheckin(id) { const sale = state.sales.find((item) => item.id === id); if (!sale) return; const value = !sale.checkedIn; if (isDemo) { sale.checkedIn = value; persistDemo(); render(); } else { await update(ref(db, `sales/${id}`), { checkedIn: value }); } }
async function togglePayment(id) { const sale = state.sales.find((item) => item.id === id); if (!sale) return; const value = !sale.paid; if (isDemo) { sale.paid = value; persistDemo(); render(); } else { await update(ref(db, `sales/${id}`), { paid: value }); } }
async function deleteSale(id) { const sale = state.sales.find((item) => item.id === id); if (!sale || !confirm(`Excluir a venda de ${sale.buyerName}?`)) return; if (isDemo) { state.sales = state.sales.filter((item) => item.id !== id); persistDemo(); render(); } else { await update(ref(db), { [`sales/${id}`]: null }); } toast("Venda excluída."); }
async function deleteEvent(id) { const event = state.events.find((item) => item.id === id); if (!event || !confirm(`Excluir o evento “${event.name}” e todas as vendas dele? Esta ação não pode ser desfeita.`)) return; const changes = { [`events/${id}`]: null }; state.sales.filter((sale) => sale.eventId === id).forEach((sale) => { changes[`sales/${sale.id}`] = null; }); if (isDemo) { state.events = state.events.filter((item) => item.id !== id); state.sales = state.sales.filter((sale) => sale.eventId !== id); persistDemo(); render(); } else { await update(ref(db), changes); } toast("Evento e vendas vinculadas excluídos."); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("visible"); setTimeout(() => el.classList.remove("visible"), 3200); }

document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.open === "saleModal" && !state.events.length) return toast("Cadastre um evento antes de registrar uma venda."); $(button.dataset.open).showModal(); }));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
$("addTicketType").addEventListener("click", () => addTicketTypeRow());
$("saleEvent").addEventListener("change", () => populateTicketTypes($("saleEvent").value));
$("eventForm").addEventListener("submit", async (event) => { event.preventDefault(); try { const data = Object.fromEntries(new FormData(event.currentTarget)); data.ticketTypes = getTicketTypes(); if (!data.ticketTypes.length) throw new Error("Informe ao menos um tipo de ingresso com valor."); await createEvent(data); event.currentTarget.reset(); resetTicketTypes(); $("eventModal").close(); } catch (error) { toast(error.message); } });
$("saleForm").addEventListener("submit", async (event) => { event.preventDefault(); try { await createSale(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); $("saleModal").close(); } catch (error) { toast(error.message); } });
document.addEventListener("click", (event) => { const removeTicket = event.target.closest("[data-remove-ticket]"); if (removeTicket) { if (document.querySelectorAll(".ticket-type-row").length === 1) return toast("O evento precisa de pelo menos um tipo de ingresso."); removeTicket.closest(".ticket-type-row").remove(); return; } const deleteEventButton = event.target.closest("[data-delete-event]"); if (deleteEventButton) { deleteEvent(deleteEventButton.dataset.deleteEvent); return; } const deleteSaleButton = event.target.closest("[data-delete-sale]"); if (deleteSaleButton) { deleteSale(deleteSaleButton.dataset.deleteSale); return; } const checkin = event.target.closest("[data-checkin]"); if (checkin) toggleCheckin(checkin.dataset.checkin); const paid = event.target.closest("[data-paid]"); if (paid) togglePayment(paid.dataset.paid); const card = event.target.closest("[data-event]"); if (card) { $("saleEvent").value = card.dataset.event; populateTicketTypes(card.dataset.event); $("saleModal").showModal(); } });
document.querySelector("[data-export-sales]").addEventListener("click", () => { window.exportSalesXlsx(state.sales, state.events); });
if (localStorage.getItem(ACCESS_KEY) === "granted") start();
else window.addEventListener("ingressa:access-granted", start, { once: true });
resetTicketTypes();
