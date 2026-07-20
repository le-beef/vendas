import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, browserLocalPersistence, inMemoryPersistence, setPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, onValue, get, query, orderByChild, equalTo, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const demoEvents = [
  { id: "demo-1", name: "Festival de Inverno", date: "2026-08-02", place: "Espaço Aurora", capacity: 300, ticketTypes: [{ id: "inteira", name: "Inteira", price: 85, capacity: 200 }, { id: "meia", name: "Meia-entrada", price: 42.5, capacity: 100 }], packages: [{ id: "combo-casal", name: "Combo Casal", discountType: "percent", discountValue: 10, discountPercent: 10, regularPrice: 127.5, price: 114.75, items: [{ ticketTypeId: "inteira", quantity: 1 }, { ticketTypeId: "meia", quantity: 1 }] }] },
  { id: "demo-2", name: "Noite de Comédia", date: "2026-08-18", place: "Teatro Central", capacity: 180, ticketTypes: [{ id: "padrão", name: "Ingresso padrão", price: 45, capacity: 180 }] }
];
const demoSales = [
  { id: "demo-sale", eventId: "demo-1", ticketTypeId: "multiple", ticketTypeName: "Vários ingressos", items: [{ ticketTypeId: "inteira", ticketTypeName: "Inteira", unitPrice: 85, quantity: 1, subtotal: 85 }, { ticketTypeId: "meia", ticketTypeName: "Meia-entrada", unitPrice: 42.5, quantity: 2, subtotal: 85 }], buyerName: "Marina Alves", buyerPhone: "(11) 98888-1234", buyerEmail: "", notes: "Retirada no local", paid: true, paymentMethod: "pix", paymentDate: new Date().toISOString().slice(0, 10), quantity: 3, total: 170, checkedIn: true, createdByUid: "local-demo", createdByName: "Administrador local", createdByEmail: "demo@local", createdAt: Date.now() }
];
let state = { events: [], sales: [], users: [], auditLogs: [] };
let selectedEventId = localStorage.getItem("ingressa-selected-event") || "";
let selectedTicketTypeFilter = "all";
let selectedPaymentFilter = "all";
let selectedEntryFilter = "all";
let participantSearchQuery = "";
let firebaseApp;
let auth;
let db;
let currentUser;
let currentUserProfile;
let dataSubscriptions = [];
let isDemo = !firebaseConfig.apiKey || !firebaseConfig.databaseURL || location.protocol === "file:";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { admin: "Administrador", seller: "Vendedor", door: "Portaria" };
const PAYMENT_METHOD_LABELS = { pix: "Pix", cash: "Dinheiro", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", bank_transfer: "Transferência", other: "Outro" };

function roleLabel(role) { return ROLE_LABELS[role] || "Sem perfil"; }
function paymentMethodLabel(method) { return PAYMENT_METHOD_LABELS[method] || "Forma não informada"; }
function todayInputValue() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 10); }
function paymentDateLabel(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Data não informada"; }
function paymentDetailsHtml(sale) { return sale.paid ? `<small class="payment-details">${escapeHtml(paymentMethodLabel(sale.paymentMethod))} · ${escapeHtml(paymentDateLabel(sale.paymentDate))}</small>` : ""; }
function hasRole(...roles) { return Boolean(currentUserProfile?.active && roles.includes(currentUserProfile.role)); }
function allowedEventIds(profile = currentUserProfile) { return Object.entries(profile?.eventIds || {}).filter(([, allowed]) => allowed === true).map(([eventId]) => eventId).sort(); }
function eventAccessSignature(profile) { return allowedEventIds(profile).join("|"); }
function requireRole(roles, message = "Seu perfil não permite realizar esta ação.") { if (hasRole(...roles)) return true; toast(message); return false; }
function userInitials(name, email = "") { const source = String(name || email || "U").trim(); const parts = source.split(/\s+/).filter(Boolean); return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : source.slice(0, 2)).toLocaleUpperCase("pt-BR"); }
function clearDataSubscriptions() { dataSubscriptions.forEach((unsubscribe) => unsubscribe()); dataSubscriptions = []; }
function showAccessModal(message = "") { $("accessError").textContent = message; if (!$("accessModal").open) $("accessModal").showModal(); }
function hideAccessModal() { if ($("accessModal").open) $("accessModal").close(); }
function authErrorMessage(error) {
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-email"].includes(error.code)) return "E-mail ou senha inválidos.";
  if (error.code === "auth/too-many-requests") return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (error.code === "auth/network-request-failed") return "Sem conexão com a internet. Tente novamente.";
  if (error.code === "auth/operation-not-allowed") return "Ative o login por e-mail e senha no Firebase Authentication.";
  if (error.code === "auth/email-already-in-use") return "Este e-mail já possui uma conta.";
  if (error.code === "auth/weak-password") return "A senha precisa ter pelo menos 6 caracteres.";
  return error.message || "Não foi possível concluir a autenticação.";
}
function applyRolePermissions() {
  document.body.classList.remove("role-admin", "role-seller", "role-door");
  if (currentUserProfile?.role) document.body.classList.add(`role-${currentUserProfile.role}`);
  document.querySelectorAll("[data-roles]").forEach((element) => { element.hidden = !String(element.dataset.roles).split(",").includes(currentUserProfile?.role); });
  $("userMenu").hidden = !currentUserProfile;
  if (!currentUserProfile) return;
  const displayName = currentUserProfile.name || currentUser?.email || "Usuário";
  $("userInitials").textContent = userInitials(displayName, currentUser?.email);
  $("userDisplayName").textContent = displayName;
  $("userPopoverName").textContent = displayName;
  $("userEmail").textContent = currentUser?.email || currentUserProfile.email || "";
  $("userRoleLabel").textContent = roleLabel(currentUserProfile.role);
  $("userRoleBadge").textContent = roleLabel(currentUserProfile.role);
}
function attachRealtimeListeners() {
  clearDataSubscriptions();
  const readError = async (error) => { toast(`Acesso ao Firebase bloqueado: ${error.code || error.message}`); if (error.code === "PERMISSION_DENIED" || error.code === "permission_denied") await signOut(auth); };
  dataSubscriptions.push(onValue(ref(db, `users/${currentUser.uid}`), async (snapshot) => {
    const profile = snapshot.val();
    if (!profile?.active || !ROLE_LABELS[profile.role]) { await signOut(auth); return; }
    const roleChanged = currentUserProfile?.role !== profile.role;
    const eventAccessChanged = eventAccessSignature(currentUserProfile) !== eventAccessSignature(profile);
    currentUserProfile = { ...profile, active: true };
    applyRolePermissions();
    if (roleChanged || eventAccessChanged) attachRealtimeListeners(); else render();
  }, readError));

  if (hasRole("admin")) {
    dataSubscriptions.push(onValue(ref(db, "events"), (snapshot) => { state.events = objectToArray(snapshot.val()); render(); }, readError));
    dataSubscriptions.push(onValue(ref(db, "sales"), (snapshot) => { state.sales = objectToArray(snapshot.val()); render(); }, readError));
    dataSubscriptions.push(onValue(ref(db, "users"), (snapshot) => { state.users = objectToArray(snapshot.val()); renderUsers(); }, readError));
    dataSubscriptions.push(onValue(ref(db, "auditLogs"), (snapshot) => { state.auditLogs = objectToArray(snapshot.val()); renderAuditHistory(); }, readError));
    return;
  }

  const eventMap = new Map();
  const salesByEvent = new Map();
  state.events = [];
  state.sales = [];
  state.users = currentUserProfile ? [{ id: currentUser.uid, ...currentUserProfile }] : [];
  state.auditLogs = [];
  render();
  allowedEventIds().forEach((eventId) => {
    dataSubscriptions.push(onValue(ref(db, `events/${eventId}`), (snapshot) => {
      if (snapshot.exists()) eventMap.set(eventId, { id: eventId, ...snapshot.val() }); else eventMap.delete(eventId);
      state.events = [...eventMap.values()];
      render();
    }, readError));
    const eventSalesQuery = query(ref(db, "sales"), orderByChild("eventId"), equalTo(eventId));
    dataSubscriptions.push(onValue(eventSalesQuery, (snapshot) => {
      salesByEvent.set(eventId, objectToArray(snapshot.val()));
      state.sales = [...salesByEvent.values()].flat();
      render();
    }, readError));
  });
}
async function handleAuthenticatedUser(user) {
  clearDataSubscriptions();
  if (!user) {
    currentUser = null; currentUserProfile = null; state = { events: [], sales: [], users: [], auditLogs: [] }; $("connectionDot").classList.remove("online"); $("connectionText").textContent = "Aguardando login"; if ($("userManagementModal").open) $("userManagementModal").close(); applyRolePermissions(); render(); showAccessModal(); return;
  }
  try {
    const profileSnapshot = await get(ref(db, `users/${user.uid}`));
    const profile = profileSnapshot.val();
    if (!profile || !profile.active || !ROLE_LABELS[profile.role]) { await signOut(auth); showAccessModal("Sua conta ainda não possui permissão ativa. Fale com o administrador."); return; }
    currentUser = user; currentUserProfile = { ...profile, active: profile.active === true }; hideAccessModal(); applyRolePermissions();
    $("connectionDot").classList.add("online"); $("connectionText").textContent = "Firebase conectado";
    attachRealtimeListeners();
  } catch (error) { console.error(error); await signOut(auth); showAccessModal("Não foi possível carregar suas permissões. Confira as regras do Firebase."); }
}
async function start() {
  if (isDemo) {
    currentUser = { uid: "local-demo", email: "demo@local" }; currentUserProfile = { name: "Administrador local", email: "demo@local", role: "admin", active: true };
    state = { events: JSON.parse(localStorage.getItem("ingressa-events") || "null") || demoEvents, sales: JSON.parse(localStorage.getItem("ingressa-sales") || "null") || demoSales, users: [{ id: "local-demo", ...currentUserProfile }], auditLogs: JSON.parse(localStorage.getItem("ingressa-audit-logs") || "null") || [] };
    $("connectionText").textContent = "Modo local — dados neste navegador"; applyRolePermissions(); render(); return;
  }
  try {
    showAccessModal();
    $("connectionText").textContent = "Aguardando login";
    firebaseApp = initializeApp(firebaseConfig); auth = getAuth(firebaseApp); db = getDatabase(firebaseApp, firebaseConfig.databaseURL);
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, (user) => { handleAuthenticatedUser(user); });
  } catch (error) { console.error(error); showAccessModal("Não foi possível iniciar o login. Confira a configuração do Firebase."); }
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
function packagesFor(event) {
  const original = Array.isArray(event?.packages) ? event.packages : Object.values(event?.packages || {});
  return original.map((item) => {
    const packageItems = (Array.isArray(item.items) ? item.items : Object.values(item.items || {})).map((component) => ({ ticketTypeId: component.ticketTypeId || "", quantity: Math.max(0, Number(component.quantity || 0)) })).filter((component) => component.ticketTypeId && component.quantity > 0);
    const regularPrice = packageItems.reduce((sum, component) => { const type = ticketTypesFor(event).find((ticket) => ticket.id === component.ticketTypeId); return sum + Number(type?.price || 0) * component.quantity; }, 0);
    const discountType = item.discountType === "fixed" ? "fixed" : "percent";
    const legacyPercent = Math.min(100, Math.max(0, Number(item.discountPercent || 0)));
    const discountValue = Math.max(0, Number(item.discountValue ?? (discountType === "fixed" ? item.discountAmount : legacyPercent) ?? 0));
    const discountAmount = discountType === "fixed" ? Math.min(regularPrice, discountValue) : regularPrice * Math.min(100, discountValue) / 100;
    const discountPercent = regularPrice > 0 ? discountAmount / regularPrice * 100 : 0;
    const price = Math.max(0, Number(item.price ?? regularPrice - discountAmount));
    return { ...item, id: item.id || "", name: item.name || "Pacote", items: packageItems, regularPrice: Number(item.regularPrice ?? regularPrice), discountType, discountValue, discountAmount, discountPercent, price };
  }).filter((item) => item.id && item.name && item.items.length);
}
function packageCompositionText(packageItem, event) { return packageItem.items.map((component) => { const type = ticketTypesFor(event).find((item) => item.id === component.ticketTypeId); return `${component.quantity}× ${type?.name || "Ingresso"}`; }).join(" + "); }
function packageTicketCount(packageItem) { return packageItem.items.reduce((sum, component) => sum + Number(component.quantity || 0), 0); }
function saleItems(sale, event = state.events.find((item) => item.id === sale?.eventId)) {
  const storedItems = Array.isArray(sale?.items) ? sale.items : Object.values(sale?.items || {});
  if (storedItems.length) return storedItems.map((item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    if (item.kind === "package" || item.packageId) {
      const packageItem = packagesFor(event).find((entry) => entry.id === item.packageId);
      const rawComponents = Array.isArray(item.components) ? item.components : Object.values(item.components || {});
      const sourceComponents = rawComponents.length ? rawComponents : packageItem?.items || [];
      const components = sourceComponents.map((component) => {
        const ticketType = ticketTypesFor(event).find((type) => type.id === component.ticketTypeId || type.name === component.ticketTypeName);
        return { ticketTypeId: component.ticketTypeId || ticketType?.id || "", ticketTypeName: component.ticketTypeName || ticketType?.name || "Ingresso padrão", unitPrice: Number(component.unitPrice ?? ticketType?.price ?? 0), quantity: Math.max(0, Number(component.quantity || 0)) };
      }).filter((component) => component.ticketTypeId && component.quantity > 0);
      const packageName = item.packageName || packageItem?.name || String(item.ticketTypeName || "Pacote").replace(/^Pacote:\s*/i, "");
      const unitPrice = Number(item.unitPrice ?? packageItem?.price ?? 0);
      return { kind: "package", packageId: item.packageId || packageItem?.id || "", packageName, ticketTypeId: `package:${item.packageId || packageItem?.id || ""}`, ticketTypeName: `Pacote: ${packageName}`, unitPrice, quantity, subtotal: Number(item.subtotal ?? unitPrice * quantity), components };
    }
    const ticketType = ticketTypesFor(event).find((type) => type.id === item.ticketTypeId || type.name === item.ticketTypeName);
    const unitPrice = Number(item.unitPrice ?? ticketType?.price ?? 0);
    return { kind: "ticket", ticketTypeId: item.ticketTypeId || ticketType?.id || "", ticketTypeName: item.ticketTypeName || ticketType?.name || "Ingresso padrão", unitPrice, quantity, subtotal: Number(item.subtotal ?? unitPrice * quantity) };
  }).filter((item) => item.quantity > 0);
  const quantity = Math.max(0, Number(sale?.quantity || 0));
  if (!quantity) return [];
  const ticketType = ticketTypesFor(event).find((type) => type.id === sale?.ticketTypeId || type.name === sale?.ticketTypeName);
  const unitPrice = Number(ticketType?.price ?? (Number(sale?.total || 0) / quantity) ?? 0);
  return [{ kind: "ticket", ticketTypeId: sale?.ticketTypeId || ticketType?.id || "", ticketTypeName: sale?.ticketTypeName || ticketType?.name || "Ingresso padrão", unitPrice, quantity, subtotal: Number(sale?.total ?? unitPrice * quantity) }];
}
function saleStockItems(sale, event) {
  const stock = new Map();
  saleItems(sale, event).forEach((item) => {
    const components = item.kind === "package" ? item.components.map((component) => ({ ...component, quantity: Number(component.quantity || 0) * Number(item.quantity || 0) })) : [{ ticketTypeId: item.ticketTypeId, ticketTypeName: item.ticketTypeName, unitPrice: item.unitPrice, quantity: item.quantity }];
    components.forEach((component) => { const key = component.ticketTypeId || component.ticketTypeName; const current = stock.get(key) || { ...component, quantity: 0 }; current.quantity += Number(component.quantity || 0); stock.set(key, current); });
  });
  return [...stock.values()];
}
function saleQuantity(sale, event) { return saleStockItems(sale, event).reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
function saleTotal(sale, event) { return saleItems(sale, event).reduce((sum, item) => sum + Number(item.subtotal || 0), 0); }
function saleTypeQuantity(sale, ticketType, event) { return saleStockItems(sale, event).filter((item) => item.ticketTypeId === ticketType.id || item.ticketTypeName === ticketType.name).reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
function saleTypeTotal(sale, ticketType, event) {
  return saleItems(sale, event).reduce((sum, item) => {
    if (item.kind !== "package") return sum + ((item.ticketTypeId === ticketType.id || item.ticketTypeName === ticketType.name) ? Number(item.subtotal || 0) : 0);
    const regularTotal = item.components.reduce((componentSum, component) => componentSum + Number(component.unitPrice || 0) * Number(component.quantity || 0), 0);
    if (!regularTotal) return sum;
    const matchingRegular = item.components.filter((component) => component.ticketTypeId === ticketType.id || component.ticketTypeName === ticketType.name).reduce((componentSum, component) => componentSum + Number(component.unitPrice || 0) * Number(component.quantity || 0), 0);
    return sum + Number(item.subtotal || 0) * (matchingRegular / regularTotal);
  }, 0);
}
function saleTicketSummary(sale, event) { return saleItems(sale, event).map((item) => item.kind === "package" ? `${item.quantity}× Pacote ${item.packageName} (${item.components.map((component) => `${component.quantity}× ${component.ticketTypeName}`).join(" + ")})` : `${item.quantity}× ${item.ticketTypeName}`).join(" + ") || "Ingresso padrão"; }
function saleTicketBreakdownHtml(sale, event) { return `<span class="sale-ticket-breakdown">${saleItems(sale, event).map((item) => item.kind === "package" ? `<span><b>${item.quantity}×</b><span class="package-item-name">Pacote ${escapeHtml(item.packageName)}</span><em>${money.format(item.subtotal)}</em></span><small class="package-composition">${escapeHtml(item.components.map((component) => `${component.quantity}× ${component.ticketTypeName}`).join(" + "))}</small>` : `<span><b>${item.quantity}×</b><span>${escapeHtml(item.ticketTypeName)}</span><em>${money.format(item.subtotal)}</em></span>`).join("")}</span>`; }
function soldForTicket(eventId, ticketType, excludedSaleId = "") {
  const event = state.events.find((item) => item.id === eventId);
  return state.sales.filter((sale) => sale.eventId === eventId && sale.id !== excludedSaleId).reduce((sum, sale) => sum + saleTypeQuantity(sale, ticketType, event), 0);
}
function priceLabel(event) { const prices = ticketTypesFor(event).map((item) => Number(item.price)); return prices.length > 1 ? `a partir de ${money.format(Math.min(...prices))}` : money.format(prices[0]); }
function persistDemo() { localStorage.setItem("ingressa-events", JSON.stringify(state.events)); localStorage.setItem("ingressa-sales", JSON.stringify(state.sales)); localStorage.setItem("ingressa-audit-logs", JSON.stringify(state.auditLogs)); }
function dateText(value) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || ""; return node.innerHTML; }
function auditTimestampText(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "Data em processamento";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(timestamp));
}
function auditActor() {
  return {
    actorUid: currentUser?.uid || "unknown",
    actorName: currentUserProfile?.name || currentUser?.email || "Usuário",
    actorEmail: currentUser?.email || currentUserProfile?.email || "",
    actorRole: currentUserProfile?.role || "unknown"
  };
}
function auditLogData(action, sale, details, timestamp = isDemo ? Date.now() : serverTimestamp()) {
  const event = state.events.find((item) => item.id === sale.eventId);
  return {
    eventId: sale.eventId,
    eventName: event?.name || "Evento",
    saleId: sale.id,
    participantName: sale.buyerName || "Participante",
    ticketTypeName: saleTicketSummary(sale, event).slice(0, 160),
    quantity: saleQuantity(sale, event),
    action,
    details: String(details || "Alteração registrada.").slice(0, 500),
    timestamp,
    ...auditActor()
  };
}
function appendDemoAudit(action, sale, details) {
  state.auditLogs.push({ id: crypto.randomUUID(), ...auditLogData(action, sale, details) });
}
function auditChangeSummary(previous, next) {
  const fields = [
    ["buyerName", "nome"], ["buyerPhone", "telefone"], ["buyerEmail", "e-mail"],
    ["items", "ingressos e quantidades"],
    ["paid", "situação do pagamento"], ["paymentMethod", "forma de pagamento"], ["paymentDate", "data do pagamento"], ["notes", "observação"]
  ];
  const changed = fields.filter(([key]) => key === "items" ? JSON.stringify(saleItems(previous)) !== JSON.stringify(saleItems(next)) : String(previous?.[key] ?? "") !== String(next?.[key] ?? "")).map(([, label]) => label);
  return changed.length ? `Atualizou: ${changed.join(", ")}.` : "Salvou a venda sem alterações nos dados.";
}
function renderAuditHistory() {
  const list = $("auditLogList");
  if (!list) return;
  const event = state.events.find((item) => item.id === selectedEventId);
  const logs = state.auditLogs.filter((item) => item.eventId === selectedEventId).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  $("auditLogTitle").textContent = event ? `Histórico — ${event.name}` : "Histórico de alterações";
  $("auditLogCount").textContent = `${logs.length} ${logs.length === 1 ? "registro" : "registros"}`;
  const actionLabels = { created: "Venda criada", edited: "Venda editada", deleted: "Venda excluída", payment: "Pagamento alterado", checkin: "Entrada alterada" };
  list.innerHTML = logs.length ? logs.map((log) => `<article class="audit-entry audit-${escapeHtml(log.action)}"><div class="audit-entry-marker" aria-hidden="true"></div><div class="audit-entry-content"><div class="audit-entry-heading"><span class="audit-action">${escapeHtml(actionLabels[log.action] || "Alteração")}</span><time>${escapeHtml(auditTimestampText(log.timestamp))}</time></div><strong>${escapeHtml(log.participantName || "Participante")}</strong><p>${escapeHtml(log.details || "Alteração registrada.")}</p><div class="audit-entry-meta"><span>Por <b>${escapeHtml(log.actorName || log.actorEmail || "Usuário")}</b></span><span>${escapeHtml(roleLabel(log.actorRole))}</span></div></div></article>`).join("") : `<div class="audit-empty"><span aria-hidden="true">◷</span><strong>Nenhuma alteração registrada</strong><p>As próximas ações realizadas nas vendas deste evento aparecerão aqui.</p></div>`;
}
function openAuditHistory(eventId) {
  if (!requireRole(["admin"], "O histórico é exclusivo para administradores.")) return;
  selectedEventId = eventId;
  renderAuditHistory();
  if (!$("auditLogModal").open) $("auditLogModal").showModal();
}
function normalizedSearch(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim(); }
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
  selectedEntryFilter = "all";
  participantSearchQuery = "";
}
function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
function formatPhoneDisplay(phone) {
  const original = String(phone || "").trim();
  let digits = original.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return original;
}
function whatsappButtonHtml(sale, eventName) {
  const number = whatsappNumber(sale.buyerPhone);
  if (!number) return "";
  const message = `Olá, ${sale.buyerName || "participante"}! Tudo bem? Estou entrando em contato sobre o seu ingresso para ${eventName || "o evento"}.`;
  return `<button class="whatsapp-button" type="button" data-whatsapp data-whatsapp-number="${number}" data-whatsapp-message="${encodeURIComponent(message)}" data-whatsapp-name="${escapeHtml(sale.buyerName || "Participante")}" data-whatsapp-phone="${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || number)}" aria-label="Escolher o WhatsApp para conversar com ${escapeHtml(sale.buyerName || "participante")}"><img class="whatsapp-icon-asset" src="whatsapp-icon.png" alt="" aria-hidden="true" /><span class="whatsapp-button-label">WhatsApp</span></button>`;
}
function participantContactHtml(sale, eventName) {
  if (!sale.buyerPhone) return "";
  return `<span class="participant-contact"><span>${escapeHtml(formatPhoneDisplay(sale.buyerPhone))}</span>${whatsappButtonHtml(sale, eventName)}</span>`;
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
function newEntityId(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function draftTicketTypes() { return [...document.querySelectorAll(".ticket-type-row")].map((row) => ({ id: row.dataset.ticketId, name: row.querySelector(".ticket-name").value.trim(), price: Number(row.querySelector(".ticket-price").value || 0), capacity: Number(row.querySelector(".ticket-capacity").value || 0) })); }
function addTicketTypeRow(name = "", price = "", capacity = "", id = "") { const row = document.createElement("div"); row.className = "ticket-type-row"; row.dataset.ticketId = id || newEntityId("tipo"); row.innerHTML = `<input class="ticket-name" required aria-label="Nome do tipo ou lote" placeholder="Ex.: 1º lote" value="${escapeHtml(name)}" /><input class="ticket-price" type="number" min="0" step="0.01" required aria-label="Valor do ingresso" placeholder="Valor" value="${price}" /><input class="ticket-capacity" type="number" min="1" step="1" required aria-label="Quantidade disponível" placeholder="Quantidade" value="${capacity}" /><button class="close" type="button" data-remove-ticket aria-label="Remover tipo">×</button>`; $("ticketTypesList").append(row); refreshPackageTicketOptions(); }
function resetTicketTypes() { $("ticketTypesList").innerHTML = ""; addTicketTypeRow("Ingresso padrão", "", ""); }
function getTicketTypes() { return draftTicketTypes().filter((item) => item.name && Number.isFinite(item.price) && Number.isInteger(item.capacity) && item.capacity > 0); }
function renderPackagesEmptyState() { if (!document.querySelector(".package-row")) $("packagesList").innerHTML = `<div class="packages-empty">Nenhum pacote criado. Use “+ Criar pacote” para montar uma oferta.</div>`; }
function addPackageComponentRow(packageRow, ticketTypeId = "", quantity = 1) {
  const row = document.createElement("div");
  row.className = "package-component-row";
  row.innerHTML = `<label>Ingresso<select class="package-component-type" required></select></label><label>Quantidade<input class="package-component-quantity" type="number" min="1" step="1" value="${Math.max(1, Number(quantity || 1))}" required /></label><button class="close" type="button" data-remove-package-component aria-label="Remover ingresso do pacote">×</button>`;
  row.querySelector(".package-component-type").dataset.selectedValue = ticketTypeId;
  packageRow.querySelector(".package-components").append(row);
}
function addPackageRow(packageData = {}) {
  if (!document.querySelector(".package-row")) $("packagesList").innerHTML = "";
  const row = document.createElement("div");
  row.className = "package-row";
  row.dataset.packageId = packageData.id || newEntityId("pacote");
  const discountType = packageData.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = Number(packageData.discountValue ?? (discountType === "fixed" ? packageData.discountAmount : packageData.discountPercent) ?? 0);
  row.dataset.discountType = discountType;
  row.innerHTML = `<div class="package-row-heading"><label>Nome do pacote<input class="package-name" required placeholder="Ex.: Combo casal" value="${escapeHtml(packageData.name || "")}" /></label><label class="package-discount-label"><span>Desconto <button class="package-discount-toggle" type="button" data-toggle-package-discount title="Alternar entre porcentagem e reais" aria-label="Alterar desconto para ${discountType === "fixed" ? "porcentagem" : "valor em reais"}">${discountType === "fixed" ? "R$" : "%"}</button></span><input class="package-discount" type="number" min="0" step="0.01" value="${discountValue}" required /></label><button class="close" type="button" data-remove-package aria-label="Remover pacote">×</button></div><div class="package-components"></div><div class="package-actions"><button class="package-add-component" type="button" data-add-package-component>+ Adicionar ingresso ao pacote</button><div class="package-summary"><span>Normal: <strong data-package-regular>R$ 0,00</strong></span><span>Pacote: <strong data-package-price>R$ 0,00</strong></span><span class="package-saving" data-package-saving>Economia R$ 0,00</span></div></div>`;
  $("packagesList").append(row);
  const packageItems = Array.isArray(packageData.items) ? packageData.items : Object.values(packageData.items || {});
  (packageItems.length ? packageItems : [{ ticketTypeId: "", quantity: 1 }]).forEach((component) => addPackageComponentRow(row, component.ticketTypeId, component.quantity));
  refreshPackageTicketOptions();
  return row;
}
function packageDraftDetails(packageRow) {
  const ticketTypes = draftTicketTypes();
  const components = [...packageRow.querySelectorAll(".package-component-row")].map((row) => { const type = ticketTypes.find((item) => item.id === row.querySelector(".package-component-type").value); const quantity = Math.max(0, Number(row.querySelector(".package-component-quantity").value || 0)); return { type, quantity }; });
  const regularPrice = components.reduce((sum, component) => sum + Number(component.type?.price || 0) * component.quantity, 0);
  return { components, regularPrice };
}
function syncPackageDiscountControl(packageRow) {
  const isFixed = packageRow.dataset.discountType === "fixed";
  const input = packageRow.querySelector(".package-discount");
  const toggle = packageRow.querySelector("[data-toggle-package-discount]");
  const { regularPrice } = packageDraftDetails(packageRow);
  input.max = isFixed ? String(Math.max(0, regularPrice)) : "100";
  toggle.textContent = isFixed ? "R$" : "%";
  toggle.setAttribute("aria-label", `Alterar desconto para ${isFixed ? "porcentagem" : "valor em reais"}`);
}
function togglePackageDiscountType(packageRow) {
  const input = packageRow.querySelector(".package-discount");
  const { regularPrice } = packageDraftDetails(packageRow);
  const currentValue = Math.max(0, Number(input.value || 0));
  const isFixed = packageRow.dataset.discountType === "fixed";
  packageRow.dataset.discountType = isFixed ? "percent" : "fixed";
  const converted = isFixed ? (regularPrice > 0 ? currentValue / regularPrice * 100 : 0) : regularPrice * Math.min(100, currentValue) / 100;
  input.value = String(Math.round(converted * 100) / 100);
  syncPackageDiscountControl(packageRow);
  updatePackageSummary(packageRow);
}
function updatePackageSummary(packageRow) {
  const { regularPrice } = packageDraftDetails(packageRow);
  const discountValue = Math.max(0, Number(packageRow.querySelector(".package-discount").value || 0));
  const isFixed = packageRow.dataset.discountType === "fixed";
  const discountAmount = isFixed ? Math.min(regularPrice, discountValue) : regularPrice * Math.min(100, discountValue) / 100;
  const price = Math.round(Math.max(0, regularPrice - discountAmount) * 100) / 100;
  syncPackageDiscountControl(packageRow);
  packageRow.querySelector("[data-package-regular]").textContent = money.format(regularPrice);
  packageRow.querySelector("[data-package-price]").textContent = money.format(price);
  packageRow.querySelector("[data-package-saving]").textContent = `Economia ${money.format(regularPrice - price)}`;
}
function refreshPackageTicketOptions() {
  if (!$("packagesList")) return;
  const ticketTypes = draftTicketTypes().filter((item) => item.name);
  document.querySelectorAll(".package-row").forEach((packageRow) => {
    const rows = [...packageRow.querySelectorAll(".package-component-row")];
    const selectedValues = rows.map((row) => row.querySelector(".package-component-type").value || row.querySelector(".package-component-type").dataset.selectedValue || "");
    rows.forEach((row, rowIndex) => {
      const select = row.querySelector(".package-component-type");
      const selectedValue = selectedValues[rowIndex];
      select.innerHTML = `<option value="">Selecione o ingresso</option>${ticketTypes.map((type) => `<option value="${type.id}" ${selectedValues.some((value, index) => index !== rowIndex && value === type.id) ? "disabled" : ""}>${escapeHtml(type.name)} — ${money.format(type.price)}</option>`).join("")}`;
      if (ticketTypes.some((type) => type.id === selectedValue)) select.value = selectedValue;
      delete select.dataset.selectedValue;
      row.querySelector("[data-remove-package-component]").disabled = rows.length === 1;
    });
    packageRow.querySelector("[data-add-package-component]").disabled = !ticketTypes.length || rows.length >= ticketTypes.length;
    updatePackageSummary(packageRow);
  });
  renderPackagesEmptyState();
}
function resetPackages() { $("packagesList").innerHTML = ""; renderPackagesEmptyState(); }
function getPackages(ticketTypes) {
  const packageNames = new Set();
  return [...document.querySelectorAll(".package-row")].map((row) => {
    const name = row.querySelector(".package-name").value.trim();
    const discountType = row.dataset.discountType === "fixed" ? "fixed" : "percent";
    const discountValue = Number(row.querySelector(".package-discount").value);
    if (!name) throw new Error("Informe o nome de todos os pacotes.");
    const normalizedName = normalizedSearch(name);
    if (packageNames.has(normalizedName)) throw new Error(`O pacote “${name}” foi cadastrado mais de uma vez.`);
    packageNames.add(normalizedName);
    if (!Number.isFinite(discountValue) || discountValue < 0) throw new Error(`Informe um desconto válido para “${name}”.`);
    if (discountType === "percent" && discountValue > 100) throw new Error(`Informe um desconto entre 0% e 100% para “${name}”.`);
    const usedTypes = new Set();
    const items = [...row.querySelectorAll(".package-component-row")].map((componentRow) => {
      const ticketTypeId = componentRow.querySelector(".package-component-type").value;
      const type = ticketTypes.find((item) => item.id === ticketTypeId);
      if (!type) throw new Error(`Selecione todos os ingressos do pacote “${name}”.`);
      if (usedTypes.has(type.id)) throw new Error(`O ingresso “${type.name}” está repetido no pacote “${name}”.`);
      usedTypes.add(type.id);
      const quantity = Number(componentRow.querySelector(".package-component-quantity").value);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Informe uma quantidade válida para “${type.name}” no pacote “${name}”.`);
      if (quantity > Number(type.capacity || 0)) throw new Error(`O pacote “${name}” usa ${quantity} ingressos “${type.name}”, mas somente ${type.capacity} estão disponíveis no evento.`);
      return { ticketTypeId: type.id, quantity };
    });
    const regularPrice = items.reduce((sum, component) => sum + Number(ticketTypes.find((type) => type.id === component.ticketTypeId)?.price || 0) * component.quantity, 0);
    if (discountType === "fixed" && discountValue > regularPrice) throw new Error(`O desconto em reais do pacote “${name}” não pode ser maior que ${money.format(regularPrice)}.`);
    const discountAmount = discountType === "fixed" ? discountValue : regularPrice * discountValue / 100;
    const discountPercent = regularPrice > 0 ? discountAmount / regularPrice * 100 : 0;
    const price = Math.round(Math.max(0, regularPrice - discountAmount) * 100) / 100;
    return { id: row.dataset.packageId, name, discountType, discountValue, discountAmount, discountPercent, regularPrice, price, items };
  });
}
function saleItemOptionKey(item) { return item?.kind === "package" || item?.packageId ? `package:${item.packageId}` : item?.ticketTypeId ? `ticket:${item.ticketTypeId}` : ""; }
function packageAvailability(event, packageItem, excludedSaleId = "") {
  if (!packageItem?.items?.length) return 0;
  return Math.max(0, Math.min(...packageItem.items.map((component) => { const type = ticketTypesFor(event).find((item) => item.id === component.ticketTypeId); if (!type) return 0; const remaining = Math.max(0, Number(type.capacity) - soldForTicket(event.id, type, excludedSaleId)); return Math.floor(remaining / Number(component.quantity || 1)); })));
}
function saleOptionsFor(event, excludedSaleId = "") {
  if (!event) return [];
  const ticketOptions = ticketTypesFor(event).map((item) => ({ key: `ticket:${item.id}`, kind: "ticket", item, available: Math.max(0, Number(item.capacity) - soldForTicket(event.id, item, excludedSaleId)) }));
  const packageOptions = packagesFor(event).map((item) => ({ key: `package:${item.id}`, kind: "package", item, available: packageAvailability(event, item, excludedSaleId) }));
  return [...ticketOptions, ...packageOptions];
}
function addSaleTicketItemRow(selectedOption = "", quantity = 1) {
  const row = document.createElement("div");
  row.className = "sale-ticket-item-row";
  row.innerHTML = `<label>Ingresso ou pacote<select class="sale-item-type" required></select></label><label>Quantidade<input class="sale-item-quantity" type="number" min="1" step="1" value="${Math.max(1, Number(quantity || 1))}" required /></label><button class="close" type="button" data-remove-sale-ticket aria-label="Remover item">×</button>`;
  row.querySelector(".sale-item-type").dataset.selectedValue = selectedOption;
  $("saleTicketItemsList").append(row);
  return row;
}
function updateSaleItemsSummary() {
  const event = state.events.find((item) => item.id === $("saleEvent").value);
  const options = saleOptionsFor(event, $("saleForm").dataset.editId || "");
  let quantity = 0;
  let total = 0;
  document.querySelectorAll(".sale-ticket-item-row").forEach((row) => {
    const option = options.find((item) => item.key === row.querySelector(".sale-item-type").value);
    const itemQuantity = Math.max(0, Number(row.querySelector(".sale-item-quantity").value || 0));
    if (option && Number.isInteger(itemQuantity)) { quantity += (option.kind === "package" ? packageTicketCount(option.item) : 1) * itemQuantity; total += Number(option.item.price || 0) * itemQuantity; }
  });
  $("saleItemsQuantity").textContent = quantity;
  $("saleItemsTotal").textContent = money.format(total);
}
function populateSaleTicketItemOptions(eventId = $("saleEvent").value) {
  const event = state.events.find((item) => item.id === eventId);
  const rows = [...document.querySelectorAll(".sale-ticket-item-row")];
  const selectedValues = rows.map((row) => row.querySelector(".sale-item-type").value || row.querySelector(".sale-item-type").dataset.selectedValue || "");
  const excludedSaleId = $("saleForm").dataset.editId || "";
  const options = saleOptionsFor(event, excludedSaleId);
  rows.forEach((row, rowIndex) => {
    const select = row.querySelector(".sale-item-type");
    const selectedValue = selectedValues[rowIndex];
    const ticketOptions = options.filter((option) => option.kind === "ticket").map((option) => { const disabled = selectedValues.some((value, index) => index !== rowIndex && value === option.key) || (option.available === 0 && selectedValue !== option.key); return `<option value="${option.key}" ${disabled ? "disabled" : ""}>${escapeHtml(option.item.name)} — ${money.format(option.item.price)} — ${option.available} disponíveis</option>`; }).join("");
    const packageOptions = options.filter((option) => option.kind === "package").map((option) => { const disabled = selectedValues.some((value, index) => index !== rowIndex && value === option.key) || (option.available === 0 && selectedValue !== option.key); return `<option value="${option.key}" ${disabled ? "disabled" : ""}>PACOTE · ${escapeHtml(option.item.name)} — ${money.format(option.item.price)} — ${packageTicketCount(option.item)} ingressos — ${option.available} pacotes disponíveis</option>`; }).join("");
    select.innerHTML = event ? `<option value="">Selecione o item</option><optgroup label="Ingressos avulsos">${ticketOptions}</optgroup>${packageOptions ? `<optgroup label="Pacotes promocionais">${packageOptions}</optgroup>` : ""}` : `<option value="">Selecione primeiro o evento</option>`;
    if (event && options.some((option) => option.key === selectedValue)) select.value = selectedValue;
    delete select.dataset.selectedValue;
    row.querySelector("[data-remove-sale-ticket]").disabled = rows.length === 1;
  });
  $("addSaleTicketItem").disabled = !event || rows.length >= options.length;
  updateSaleItemsSummary();
}
function setSaleTicketItems(eventId, items = []) {
  $("saleTicketItemsList").innerHTML = "";
  const configuredItems = items.length ? items : [{ ticketTypeId: "", quantity: 1 }];
  configuredItems.forEach((item) => addSaleTicketItemRow(saleItemOptionKey(item), item.quantity || 1));
  populateSaleTicketItemOptions(eventId);
}
function getSaleTicketItems() {
  const event = state.events.find((item) => item.id === $("saleEvent").value);
  if (!event) throw new Error("Selecione um evento.");
  const rows = [...document.querySelectorAll(".sale-ticket-item-row")];
  if (!rows.length) throw new Error("Adicione pelo menos um ingresso.");
  const options = saleOptionsFor(event, $("saleForm").dataset.editId || "");
  const usedOptions = new Set();
  return rows.map((row) => {
    const optionKey = row.querySelector(".sale-item-type").value;
    const option = options.find((item) => item.key === optionKey);
    if (!option) throw new Error("Selecione todos os ingressos ou pacotes da venda.");
    if (usedOptions.has(option.key)) throw new Error(`O item “${option.item.name}” foi adicionado mais de uma vez.`);
    usedOptions.add(option.key);
    const quantity = Number(row.querySelector(".sale-item-quantity").value);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Informe uma quantidade válida para “${option.item.name}”.`);
    if (option.kind === "ticket") return { kind: "ticket", ticketTypeId: option.item.id, ticketTypeName: option.item.name, unitPrice: Number(option.item.price || 0), quantity, subtotal: Number(option.item.price || 0) * quantity };
    const components = option.item.items.map((component) => { const type = ticketTypesFor(event).find((item) => item.id === component.ticketTypeId); return { ticketTypeId: type.id, ticketTypeName: type.name, unitPrice: Number(type.price || 0), quantity: Number(component.quantity || 0) }; });
    return { kind: "package", packageId: option.item.id, packageName: option.item.name, ticketTypeId: `package:${option.item.id}`, ticketTypeName: `Pacote: ${option.item.name}`, unitPrice: Number(option.item.price || 0), quantity, subtotal: Number(option.item.price || 0) * quantity, components };
  });
}
function addSaleEditButtons() { if (!hasRole("admin", "seller")) return; document.querySelectorAll("[data-sale-row]").forEach((row) => { const actions = row.lastElementChild; if (!actions?.querySelector("[data-edit-sale]")) { const button = document.createElement("button"); button.type = "button"; button.className = "edit-button"; button.dataset.editSale = row.dataset.saleRow; button.textContent = "Editar"; actions.prepend(button); } }); }

function eventAccessCheckboxes(selectedIds = []) {
  const selected = new Set(selectedIds);
  if (!state.events.length) return `<p class="user-events-empty">Nenhum evento cadastrado.</p>`;
  return [...state.events].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR")).map((event) => `<label class="user-event-option"><input type="checkbox" value="${event.id}" ${selected.has(event.id) ? "checked" : ""} /><span><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.place || "Local não informado")} · ${dateText(event.date)}</small></span></label>`).join("");
}
function renderCreateUserEventOptions() {
  const container = $("createUserEvents");
  if (!container) return;
  container.innerHTML = eventAccessCheckboxes();
  container.querySelectorAll("input").forEach((input) => { input.name = "eventIds"; });
  syncCreateUserEventAccess();
}
function syncCreateUserEventAccess() {
  const field = $("createUserEventAccess");
  if (!field) return;
  const isAdmin = document.querySelector('#createUserForm [name="role"]').value === "admin";
  field.classList.toggle("is-admin", isAdmin);
  field.querySelectorAll("input").forEach((input) => { input.disabled = isAdmin; });
  $("createUserEventHint").textContent = isAdmin ? "Administradores visualizam todos os eventos." : "Marque um ou mais eventos que esta pessoa poderá acessar.";
}
function renderUsers() {
  renderCreateUserEventOptions();
  const users = [...state.users].sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email), "pt-BR"));
  $("usersCount").textContent = `${users.length} ${users.length === 1 ? "usuário" : "usuários"}`;
  $("usersList").innerHTML = users.length ? users.map((user) => {
    const isCurrent = user.id === currentUser?.uid;
    const selectedIds = allowedEventIds(user).filter((eventId) => state.events.some((event) => event.id === eventId));
    const eventSummary = user.role === "admin" ? "Todos os eventos" : `${selectedIds.length} ${selectedIds.length === 1 ? "evento permitido" : "eventos permitidos"}`;
    const accessEditor = user.role === "admin" ? `<div class="user-event-access admin-access"><strong>Acesso aos eventos</strong><span>Administrador visualiza todos.</span></div>` : `<details class="user-event-access" data-event-access-user="${user.id}"><summary><span>Acesso aos eventos</span><strong>${eventSummary}</strong></summary><div class="user-event-options">${eventAccessCheckboxes(selectedIds)}</div><button class="save-user-events" type="button" data-save-user-events="${user.id}">Salvar eventos permitidos</button></details>`;
    return `<article class="managed-user ${user.active ? "" : "is-inactive"}"><div class="managed-user-main"><span class="managed-user-avatar">${escapeHtml(userInitials(user.name, user.email))}</span><div class="managed-user-copy"><strong>${escapeHtml(user.name || "Sem nome")}${isCurrent ? " (você)" : ""}</strong><small>${escapeHtml(user.email || "E-mail não informado")}</small><em>${user.active ? "Acesso ativo" : "Acesso bloqueado"}</em></div></div><select data-user-role="${user.id}" aria-label="Perfil de ${escapeHtml(user.name || user.email)}" ${isCurrent ? "disabled" : ""}><option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option><option value="seller" ${user.role === "seller" ? "selected" : ""}>Vendedor</option><option value="door" ${user.role === "door" ? "selected" : ""}>Portaria</option></select><div class="managed-user-actions"><button type="button" data-reset-user="${user.id}">Redefinir senha</button>${isCurrent ? `<button type="button" disabled>Conta atual</button>` : `<button class="deactivate" type="button" data-toggle-user="${user.id}">${user.active ? "Bloquear" : "Ativar"}</button>`}</div>${accessEditor}</article>`;
  }).join("") : `<div class="empty">Nenhum usuário cadastrado.</div>`;
}
async function createManagedUser(data) {
  if (!requireRole(["admin"])) return;
  const selectedEventIds = [...document.querySelectorAll("#createUserEvents input:checked")].map((input) => input.value);
  if (data.role !== "admin" && !selectedEventIds.length) throw new Error("Selecione pelo menos um evento para este usuário.");
  if (isDemo) throw new Error("A criação de contas funciona somente no site conectado ao Firebase.");
  const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, data.email.trim(), data.password);
    const profile = { name: data.name.trim(), email: data.email.trim().toLocaleLowerCase("pt-BR"), role: data.role, active: true, createdAt: Date.now(), createdBy: currentUser.uid };
    if (data.role !== "admin") profile.eventIds = Object.fromEntries(selectedEventIds.map((eventId) => [eventId, true]));
    await set(ref(db, `users/${credential.user.uid}`), profile);
  } finally { try { await signOut(secondaryAuth); } catch {} await deleteApp(secondaryApp); }
}
async function updateManagedUserRole(uid, role) { if (!requireRole(["admin"]) || uid === currentUser?.uid) return; await update(ref(db, `users/${uid}`), { role, updatedAt: Date.now(), updatedBy: currentUser.uid }); toast("Perfil atualizado."); }
async function updateManagedUserEvents(uid, eventIds) {
  if (!requireRole(["admin"])) return;
  const user = state.users.find((item) => item.id === uid);
  if (!user || user.role === "admin") return;
  if (!eventIds.length && state.events.length) throw new Error("Selecione pelo menos um evento.");
  const eventAccess = eventIds.length ? Object.fromEntries(eventIds.map((eventId) => [eventId, true])) : null;
  await update(ref(db, `users/${uid}`), { eventIds: eventAccess, updatedAt: Date.now(), updatedBy: currentUser.uid });
  toast("Eventos permitidos atualizados.");
}
async function toggleManagedUser(uid) { if (!requireRole(["admin"]) || uid === currentUser?.uid) return; const user = state.users.find((item) => item.id === uid); if (!user) return; const active = !user.active; if (!confirm(`${active ? "Ativar" : "Bloquear"} o acesso de ${user.name || user.email}?`)) return; await update(ref(db, `users/${uid}`), { active, updatedAt: Date.now(), updatedBy: currentUser.uid }); toast(active ? "Acesso ativado." : "Acesso bloqueado."); }
async function resetManagedUserPassword(uid) { if (!requireRole(["admin"])) return; const user = state.users.find((item) => item.id === uid); if (!user?.email) return; await sendPasswordResetEmail(auth, user.email); toast("E-mail para redefinição de senha enviado."); }

function sellerForSale(sale) {
  const creationLog = state.auditLogs.find((log) => log.saleId === sale.id && log.action === "created");
  const creatorId = sale.createdByUid || creationLog?.actorUid || "legacy-sales";
  const profile = state.users.find((user) => user.id === creatorId);
  return {
    id: creatorId,
    name: profile?.name || sale.createdByName || creationLog?.actorName || "Vendas anteriores",
    email: profile?.email || sale.createdByEmail || creationLog?.actorEmail || "Sem vendedor identificado"
  };
}
function saleCreatedDate(sale) {
  const timestamp = Number(sale.createdAt);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function renderSellerClosing(eventSales) {
  const start = $("sellerClosingStart").value;
  const end = $("sellerClosingEnd").value;
  const periodSales = eventSales.filter((sale) => { const date = saleCreatedDate(sale); return (!start || (date && date >= start)) && (!end || (date && date <= end)); });
  const groups = new Map();
  periodSales.forEach((sale) => {
    const seller = sellerForSale(sale);
    const current = groups.get(seller.id) || { ...seller, sales: 0, tickets: 0, total: 0, received: 0, pending: 0 };
    current.sales += 1;
    current.tickets += saleQuantity(sale);
    current.total += saleTotal(sale);
    if (sale.paid) current.received += saleTotal(sale); else current.pending += saleTotal(sale);
    groups.set(seller.id, current);
  });
  const rows = [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  const totals = rows.reduce((sum, row) => ({ sales: sum.sales + row.sales, tickets: sum.tickets + row.tickets, total: sum.total + row.total, received: sum.received + row.received, pending: sum.pending + row.pending }), { sales: 0, tickets: 0, total: 0, received: 0, pending: 0 });
  $("sellerClosingPeriodLabel").textContent = start || end ? `${start ? paymentDateLabel(start) : "Início"} até ${end ? paymentDateLabel(end) : "hoje"}` : "Todo o evento";
  $("sellerClosingBreakdown").innerHTML = rows.length ? `${rows.map((row) => `<tr><td data-label="Vendedor"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email)}</small></td><td data-label="Vendas">${row.sales}</td><td data-label="Ingressos">${row.tickets}</td><td data-label="Total vendido">${money.format(row.total)}</td><td data-label="Recebido">${money.format(row.received)}</td><td data-label="Pendente">${money.format(row.pending)}</td></tr>`).join("")}<tr class="seller-closing-total"><td data-label="Vendedor"><strong>Total do período</strong></td><td data-label="Vendas">${totals.sales}</td><td data-label="Ingressos">${totals.tickets}</td><td data-label="Total vendido">${money.format(totals.total)}</td><td data-label="Recebido">${money.format(totals.received)}</td><td data-label="Pendente">${money.format(totals.pending)}</td></tr>` : `<tr><td class="financial-empty" colspan="6">Nenhuma venda registrada neste período.</td></tr>`;
}

function renderFinancialReport(event, eventSales) {
  const totalSold = eventSales.reduce((sum, sale) => sum + saleTotal(sale, event), 0);
  const totalReceived = eventSales.filter((sale) => sale.paid).reduce((sum, sale) => sum + saleTotal(sale, event), 0);
  const totalPending = totalSold - totalReceived;
  const salesCount = eventSales.length;
  const ticketsCount = eventSales.reduce((sum, sale) => sum + saleQuantity(sale, event), 0);
  const averageOrder = salesCount ? totalSold / salesCount : 0;
  const averageTicket = ticketsCount ? totalSold / ticketsCount : 0;
  const receiptRate = totalSold ? Math.round((totalReceived / totalSold) * 100) : 0;
  const paidSalesCount = eventSales.filter((sale) => sale.paid).length;

  $("financialReportEventMeta").textContent = event ? `${event.name} · ${event.place} · ${dateText(event.date)}` : "Selecione um evento para visualizar o relatório.";
  $("financialTotalSold").textContent = money.format(totalSold);
  $("financialTotalReceived").textContent = money.format(totalReceived);
  $("financialTotalPending").textContent = money.format(totalPending);
  $("financialAverageOrder").textContent = money.format(averageOrder);
  $("financialSalesCount").textContent = salesCount;
  $("financialTicketsCount").textContent = ticketsCount;
  $("financialAverageTicket").textContent = money.format(averageTicket);
  $("financialReceiptRate").textContent = `${receiptRate}%`;
  $("financialReceiptProgress").style.width = `${receiptRate}%`;
  $("financialReceiptProgress").parentElement.setAttribute("aria-valuenow", String(receiptRate));
  $("financialReceiptCaption").textContent = salesCount ? `${paidSalesCount} de ${salesCount} ${salesCount === 1 ? "venda está confirmada" : "vendas estão confirmadas"}.` : "Nenhuma venda registrada.";

  const ticketTypes = event ? ticketTypesFor(event) : [];
  $("financialTicketBreakdown").innerHTML = ticketTypes.length ? ticketTypes.map((type) => {
    const typeSales = eventSales.filter((sale) => saleTypeQuantity(sale, type, event) > 0);
    const quantity = typeSales.reduce((sum, sale) => sum + saleTypeQuantity(sale, type, event), 0);
    const total = typeSales.reduce((sum, sale) => sum + saleTypeTotal(sale, type, event), 0);
    const received = typeSales.filter((sale) => sale.paid).reduce((sum, sale) => sum + saleTypeTotal(sale, type, event), 0);
    return `<tr><td data-label="Tipo de ingresso">${escapeHtml(type.name)}</td><td data-label="Vendidos">${quantity}</td><td data-label="Total">${money.format(total)}</td><td data-label="Recebido">${money.format(received)}</td><td data-label="Pendente">${money.format(total - received)}</td></tr>`;
  }).join("") : `<tr><td class="financial-empty" colspan="5">Nenhum tipo de ingresso disponível.</td></tr>`;
  renderSellerClosing(eventSales);
}

function syncApplicationPage() {
  const reportOpen = location.hash === "#relatorio-financeiro" && Boolean(selectedEventId) && hasRole("admin");
  $("dashboardPage").hidden = reportOpen;
  $("financialReportPage").hidden = !reportOpen;
  document.body.classList.toggle("financial-report-open", reportOpen);
  const selectedEvent = state.events.find((event) => event.id === selectedEventId);
  document.title = reportOpen && selectedEvent ? `Relatório financeiro — ${selectedEvent.name}` : "Le Beef | Controle de ingressos";
}

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
    const matchesTicketType = selectedTicketTypeFilter === "all" || saleItems(sale, selectedEvent).some((item) => item.ticketTypeId === selectedTicketTypeFilter || item.ticketTypeName === selectedTypeName);
    const matchesPayment = selectedPaymentFilter === "all" || (selectedPaymentFilter === "paid" ? sale.paid : !sale.paid);
    const matchesEntry = selectedEntryFilter === "all" || (selectedEntryFilter === "checked" ? sale.checkedIn : !sale.checkedIn);
    return matchesTicketType && matchesPayment && matchesEntry && matchesParticipantSearch(sale);
  });
  const filteredTicketType = availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter);
  const visibleSold = visibleSales.reduce((sum, sale) => sum + (filteredTicketType ? saleTypeQuantity(sale, filteredTicketType, selectedEvent) : saleQuantity(sale, selectedEvent)), 0);
  const visibleSalesTotal = visibleSales.reduce((sum, sale) => sum + (filteredTicketType ? saleTypeTotal(sale, filteredTicketType, selectedEvent) : saleTotal(sale, selectedEvent)), 0);
  const visibleCapacity = selectedTicketTypeFilter === "all" ? eventCapacity(selectedEvent) : Number(availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter)?.capacity || 0);
  const sold = selectedSales.reduce((sum, sale) => sum + saleQuantity(sale, selectedEvent), 0);
  const revenuePaid = selectedSales.filter((sale) => sale.paid).reduce((sum, sale) => sum + saleTotal(sale, selectedEvent), 0);
  const revenuePending = selectedSales.filter((sale) => !sale.paid).reduce((sum, sale) => sum + saleTotal(sale, selectedEvent), 0);
  const revenueTotal = revenuePaid + revenuePending;
  const checkins = selectedSales.filter((sale) => sale.checkedIn).reduce((sum, sale) => sum + saleQuantity(sale, selectedEvent), 0);
  $("selectedEventArea").hidden = !selectedEvent;
  $("ticketTypeFilter").innerHTML = `<option value="all">Todos</option>${availableTicketTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.name)}</option>`).join("")}`;
  $("ticketTypeFilter").value = selectedTicketTypeFilter;
  $("paymentStatusFilter").value = selectedPaymentFilter;
  $("entryStatusFilter").value = selectedEntryFilter;
  $("participantSearch").value = participantSearchQuery;
  const activeFilterCount = Number(selectedTicketTypeFilter !== "all") + Number(selectedPaymentFilter !== "all") + Number(selectedEntryFilter !== "all");
  const singleFilterLabel = selectedPaymentFilter === "paid" ? "Pago" : selectedPaymentFilter === "pending" ? "Pendente" : selectedEntryFilter === "checked" ? "Entrada feita" : selectedEntryFilter === "waiting" ? "Aguardando" : selectedTicketTypeFilter === "all" ? "Todos" : selectedTypeName || "Todos";
  $("filterLabel").textContent = activeFilterCount > 1 ? `${activeFilterCount} filtros` : singleFilterLabel;
  const hasActiveParticipantFilters = Boolean(participantSearchQuery) || activeFilterCount > 0;
  $("clearParticipantFilters").hidden = !hasActiveParticipantFilters;
  $("clearParticipantFilters").disabled = !hasActiveParticipantFilters;
  $("clearParticipantFiltersMenu").disabled = false;
  $("filterCount").textContent = `${visibleSold} ${visibleSold === 1 ? "vendido" : "vendidos"} • ${visibleCapacity} ${visibleCapacity === 1 ? "disponível" : "disponíveis"}`;
  $("allSalesTotalLabel").textContent = participantSearchQuery || activeFilterCount ? "Total vendido — resultados filtrados" : "Total vendido — Todos";
  $("allSalesTotal").textContent = money.format(visibleSalesTotal);
  $("revenue").textContent = money.format(revenueTotal); $("revenuePaid").textContent = money.format(revenuePaid); $("revenuePending").textContent = money.format(revenuePending); $("sold").textContent = sold; $("capacity").textContent = eventCapacity(selectedEvent); $("checkins").textContent = checkins;
  renderFinancialReport(hasRole("admin") ? selectedEvent : undefined, hasRole("admin") ? selectedSales : []);
  if (selectedEvent) { $("selectedEventName").textContent = selectedEvent.name; $("selectedEventMeta").textContent = hasRole("door") ? `${selectedEvent.place} · ${dateText(selectedEvent.date)}` : `${selectedEvent.place} · ${dateText(selectedEvent.date)} · ${priceLabel(selectedEvent)}`; $("salesPanelTitle").textContent = `Vendas de ${selectedEvent.name}`; $("allSalesTitle").textContent = `Participantes — ${selectedEvent.name}`; }
  $("eventsList").innerHTML = events.length ? events.map((event) => {
    const eventSold = sales.filter((sale) => sale.eventId === event.id).reduce((sum, sale) => sum + saleQuantity(sale, event), 0);
    return `<div class="event-card ${event.id === selectedEventId ? "is-selected" : ""}" data-select-event="${event.id}" role="button" tabindex="0" aria-pressed="${event.id === selectedEventId}"><span class="calendar"><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><span class="event-info"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.place)}${hasRole("door") ? "" : ` · ${priceLabel(event)}`}</small></span><span class="event-count">${eventSold}/${eventCapacity(event)}</span></div>`;
  }).join("") : `<div class="empty">Nenhum evento cadastrado ainda.</div>`;
  const canManageSales = hasRole("admin", "seller");
  const paymentControl = (sale) => `<span class="payment-display">${canManageSales ? `<button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button>` : `<span class="payment ${sale.paid ? "paid" : ""}">${sale.paid ? "✓ Pago" : "Pendente"}</span>`}${paymentDetailsHtml(sale)}</span>`;
  const checkinControl = (sale) => `<button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button>`;
  const actionControl = (sale) => canManageSales ? `<button class="delete-button" data-delete-sale="${sale.id}">Excluir</button>` : `<span class="role-readonly">Somente consulta</span>`;
  $("salesList").innerHTML = visibleSales.length ? visibleSales.slice(0, 7).map((sale) => { const quantity = saleQuantity(sale, selectedEvent); const total = saleTotal(sale, selectedEvent); return `<tr class="sales-row" data-sale-row="${sale.id}"><td><span class="desktop-participant-content"><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small>${participantContactHtml(sale, selectedEvent?.name)}</span><span class="mobile-card-overview"><span class="mobile-overview-participant"><small class="mobile-field-label">Participante</small><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small></span><span class="mobile-overview-value mobile-financial"><small class="mobile-field-label">Valor</small><strong>${money.format(total)}</strong></span><span class="mobile-overview-contact"><span>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Sem telefone")}</span>${whatsappButtonHtml(sale, selectedEvent?.name)}</span><span class="mobile-overview-payment mobile-financial"><small class="mobile-field-label">Pagamento</small>${paymentControl(sale)}</span><span class="mobile-overview-entry"><small class="mobile-field-label">Entrada</small>${checkinControl(sale)}</span></span></td><td>${saleTicketBreakdownHtml(sale, selectedEvent)}</td><td class="sale-observation">${escapeHtml(sale.notes || "Sem observação")}</td><td class="financial-column mobile-detail-original">${money.format(total)}</td><td class="financial-column mobile-detail-original">${paymentControl(sale)}</td><td class="mobile-detail-original">${checkinControl(sale)}</td><td>${actionControl(sale)}</td></tr>`; }).join("") : `<tr><td colspan="7" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhuma venda neste evento."}</td></tr>`;
  $("allSalesList").innerHTML = visibleSales.length ? visibleSales.map((sale) => { const quantity = saleQuantity(sale, selectedEvent); const rowTotal = filteredTicketType ? saleTypeTotal(sale, filteredTicketType, selectedEvent) : saleTotal(sale, selectedEvent); return `<tr class="sales-row" data-sale-row="${sale.id}"><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small></td><td>${saleTicketBreakdownHtml(sale, selectedEvent)}</td><td class="sale-note"><span class="phone-line"><strong>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Não informado")}</strong>${whatsappButtonHtml(sale, selectedEvent?.name)}</span>${sale.notes ? `<small>${escapeHtml(sale.notes)}</small>` : ""}</td><td>${escapeHtml(selectedEvent?.name || "Evento removido")}</td><td class="financial-column">${money.format(rowTotal)}</td><td class="financial-column">${paymentControl(sale)}</td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td>${actionControl(sale)}</td></tr>`; }).join("") : `<tr><td colspan="8" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhum participante neste evento."}</td></tr>`;
  addSaleEditButtons();
  const currentEvent = $("saleEvent").value; $("saleEvent").innerHTML = `<option value="">Selecione o evento</option>${events.map((event) => `<option value="${event.id}">${escapeHtml(event.name)} — ${priceLabel(event)}</option>`).join("")}`; if (events.some((event) => event.id === currentEvent)) $("saleEvent").value = currentEvent; populateSaleTicketItemOptions($("saleEvent").value);
  renderAuditHistory();
  syncApplicationPage();
}

async function saveEvent(data, id = "") {
  if (!hasRole("admin")) throw new Error("Somente administradores podem criar ou editar eventos.");
  const eventSales = state.sales.filter((sale) => sale.eventId === id);
  if (id) {
    const keptIds = new Set(data.ticketTypes.map((item) => item.id));
    const removedWithSales = eventSales.flatMap((sale) => saleStockItems(sale)).find((item) => item.ticketTypeId && !keptIds.has(item.ticketTypeId));
    if (removedWithSales) throw new Error(`Não é possível remover o tipo “${removedWithSales.ticketTypeName}” porque ele já possui vendas.`);
    const keptPackageIds = new Set((data.packages || []).map((item) => item.id));
    const removedPackageWithSales = eventSales.flatMap((sale) => saleItems(sale)).find((item) => item.kind === "package" && !keptPackageIds.has(item.packageId));
    if (removedPackageWithSales) throw new Error(`Não é possível remover o pacote “${removedPackageWithSales.packageName}” porque ele já possui vendas.`);
    for (const type of data.ticketTypes) {
      const alreadySold = soldForTicket(id, type);
      if (alreadySold > type.capacity) throw new Error(`O tipo “${type.name}” já possui ${alreadySold} vendidos. Informe uma quantidade igual ou maior.`);
    }
  }
  const capacity = data.ticketTypes.reduce((sum, item) => sum + Number(item.capacity), 0);
  const eventData = { name: data.name.trim(), date: data.date, place: data.place.trim(), capacity, ticketTypes: data.ticketTypes, packages: data.packages || [], updatedAt: Date.now() };
  if (isDemo) { if (id) state.events = state.events.map((item) => item.id === id ? { ...item, ...eventData } : item); else { selectedEventId = crypto.randomUUID(); state.events.push({ id: selectedEventId, ...eventData, createdAt: Date.now() }); } persistDemo(); render(); }
  else if (id) await update(ref(db, `events/${id}`), eventData); else { const eventRef = push(ref(db, "events")); selectedEventId = eventRef.key; await set(eventRef, { ...eventData, createdAt: Date.now() }); }
  toast(id ? "Evento atualizado." : "Evento criado com sucesso.");
}
async function saveSale(data, id = "") {
  if (!hasRole("admin", "seller")) throw new Error("Seu perfil não permite criar ou editar vendas.");
  const event = state.events.find((item) => item.id === data.eventId); if (!event) throw new Error("Selecione um evento.");
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error("Adicione pelo menos um ingresso à venda.");
  const requestedStock = saleStockItems({ eventId: event.id, items }, event);
  for (const requested of requestedStock) {
    const ticketType = ticketTypesFor(event).find((type) => type.id === requested.ticketTypeId);
    if (!ticketType) throw new Error("Um dos ingressos do pacote não está mais disponível neste evento.");
    const soldForType = soldForTicket(event.id, ticketType, id);
    const remaining = Math.max(0, Number(ticketType.capacity) - soldForType);
    if (requested.quantity > remaining) throw new Error(`Restam apenas ${remaining} ingressos do tipo “${ticketType.name}”. Esta venda precisa de ${requested.quantity}.`);
  }
  const quantity = requestedStock.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const primaryTicket = items[0];
  const current = state.sales.find((sale) => sale.id === id);
  const paid = data.paymentStatus === "paid";
  const paymentMethod = paid ? String(data.paymentMethod || "") : "";
  const paymentDate = paid ? String(data.paymentDate || "") : "";
  if (paid && !PAYMENT_METHOD_LABELS[paymentMethod]) throw new Error("Selecione a forma de pagamento.");
  if (paid && !paymentDate) throw new Error("Informe a data do pagamento.");
  const timestamp = isDemo ? Date.now() : serverTimestamp();
  const saleData = { eventId: event.id, ticketTypeId: items.length === 1 ? primaryTicket.ticketTypeId : "multiple", ticketTypeName: items.length === 1 ? primaryTicket.ticketTypeName : "Vários ingressos", items, buyerName: String(data.buyerName || "").trim(), buyerPhone: String(data.buyerPhone || "").trim(), buyerEmail: String(data.buyerEmail || "").trim(), notes: String(data.notes || "").trim(), paid, paymentMethod, paymentDate, quantity, total, checkedIn: current?.checkedIn || false, updatedAt: timestamp };
  if (isDemo) {
    if (id) {
      const updatedSale = { ...current, ...saleData };
      state.sales = state.sales.map((item) => item.id === id ? updatedSale : item);
      appendDemoAudit("edited", updatedSale, auditChangeSummary(current, updatedSale));
    } else {
      const createdSale = { id: crypto.randomUUID(), ...saleData, createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp };
      state.sales.push(createdSale);
      appendDemoAudit("created", createdSale, `Criou a venda com ${saleTicketSummary(createdSale, event)}, pagamento ${createdSale.paid ? `${paymentMethodLabel(createdSale.paymentMethod)} em ${paymentDateLabel(createdSale.paymentDate)}` : "pendente"}.`);
    }
    persistDemo(); render();
  } else {
    const saleId = id || push(ref(db, "sales")).key;
    const storedSale = { ...current, id: saleId, ...saleData };
    if (!id) Object.assign(storedSale, { createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp });
    const logId = push(ref(db, "auditLogs")).key;
    const action = id ? "edited" : "created";
    const details = id ? auditChangeSummary(current, storedSale) : `Criou a venda com ${saleTicketSummary(storedSale, event)}, pagamento ${storedSale.paid ? `${paymentMethodLabel(storedSale.paymentMethod)} em ${paymentDateLabel(storedSale.paymentDate)}` : "pendente"}.`;
    await update(ref(db), { [`sales/${saleId}`]: Object.fromEntries(Object.entries(storedSale).filter(([key]) => key !== "id")), [`auditLogs/${logId}`]: auditLogData(action, storedSale, details, timestamp) });
  }
  toast(id ? "Participante atualizado." : "Venda registrada.");
}
async function toggleCheckin(id) {
  if (!requireRole(["admin", "seller", "door"])) return;
  const sale = state.sales.find((item) => item.id === id); if (!sale) return;
  const value = !sale.checkedIn;
  const details = value ? "Realizou o check-in do participante." : "Desfez o check-in do participante.";
  if (isDemo) { sale.checkedIn = value; appendDemoAudit("checkin", sale, details); persistDemo(); render(); }
  else { const logId = push(ref(db, "auditLogs")).key; await update(ref(db), { [`sales/${id}/checkedIn`]: value, [`auditLogs/${logId}`]: auditLogData("checkin", sale, details) }); }
}
async function togglePayment(id) {
  if (!requireRole(["admin", "seller"])) return;
  const sale = state.sales.find((item) => item.id === id); if (!sale) return;
  if (!sale.paid) {
    const form = $("paymentConfirmationForm");
    form.reset();
    form.elements.saleId.value = id;
    form.elements.paymentDate.value = todayInputValue();
    $("paymentConfirmationParticipant").textContent = sale.buyerName;
    $("paymentConfirmationModal").showModal();
    return;
  }
  if (!confirm(`Marcar o pagamento de ${sale.buyerName} como pendente? A forma e a data do pagamento serão removidas.`)) return;
  const details = "Alterou o pagamento para pendente.";
  if (isDemo) { sale.paid = false; sale.paymentMethod = ""; sale.paymentDate = ""; sale.updatedAt = Date.now(); appendDemoAudit("payment", sale, details); persistDemo(); render(); }
  else { const logId = push(ref(db, "auditLogs")).key; await update(ref(db), { [`sales/${id}/paid`]: false, [`sales/${id}/paymentMethod`]: null, [`sales/${id}/paymentDate`]: null, [`sales/${id}/updatedAt`]: serverTimestamp(), [`auditLogs/${logId}`]: auditLogData("payment", sale, details) }); }
}
async function confirmSalePayment(data) {
  if (!requireRole(["admin", "seller"])) return;
  const sale = state.sales.find((item) => item.id === data.saleId); if (!sale) throw new Error("Venda não encontrada.");
  if (!PAYMENT_METHOD_LABELS[data.paymentMethod]) throw new Error("Selecione a forma de pagamento.");
  if (!data.paymentDate) throw new Error("Informe a data do pagamento.");
  const details = `Confirmou o pagamento por ${paymentMethodLabel(data.paymentMethod)} em ${paymentDateLabel(data.paymentDate)}.`;
  if (isDemo) { sale.paid = true; sale.paymentMethod = data.paymentMethod; sale.paymentDate = data.paymentDate; sale.updatedAt = Date.now(); appendDemoAudit("payment", sale, details); persistDemo(); render(); }
  else { const logId = push(ref(db, "auditLogs")).key; await update(ref(db), { [`sales/${sale.id}/paid`]: true, [`sales/${sale.id}/paymentMethod`]: data.paymentMethod, [`sales/${sale.id}/paymentDate`]: data.paymentDate, [`sales/${sale.id}/updatedAt`]: serverTimestamp(), [`auditLogs/${logId}`]: auditLogData("payment", sale, details) }); }
}
async function deleteSale(id) {
  if (!requireRole(["admin", "seller"])) return;
  const sale = state.sales.find((item) => item.id === id); if (!sale || !confirm(`Excluir a venda de ${sale.buyerName}?`)) return;
  const quantity = saleQuantity(sale);
  const details = `Excluiu a venda com ${quantity} ${quantity === 1 ? "ingresso" : "ingressos"}: ${saleTicketSummary(sale)}.`;
  if (isDemo) { appendDemoAudit("deleted", sale, details); state.sales = state.sales.filter((item) => item.id !== id); persistDemo(); render(); }
  else { const logId = push(ref(db, "auditLogs")).key; await update(ref(db), { [`sales/${id}`]: null, [`auditLogs/${logId}`]: auditLogData("deleted", sale, details) }); }
  toast("Venda excluída.");
}
async function deleteEvent(id) { if (!requireRole(["admin"], "Somente administradores podem excluir eventos.")) return; const event = state.events.find((item) => item.id === id); if (!event || !confirm(`Excluir o evento “${event.name}” e todas as vendas e históricos dele? Esta ação não pode ser desfeita.`)) return; const changes = { [`events/${id}`]: null }; state.sales.filter((sale) => sale.eventId === id).forEach((sale) => { changes[`sales/${sale.id}`] = null; }); state.auditLogs.filter((log) => log.eventId === id).forEach((log) => { changes[`auditLogs/${log.id}`] = null; }); if (isDemo) { state.events = state.events.filter((item) => item.id !== id); state.sales = state.sales.filter((sale) => sale.eventId !== id); state.auditLogs = state.auditLogs.filter((log) => log.eventId !== id); persistDemo(); render(); } else { await update(ref(db), changes); } toast("Evento, vendas e históricos vinculados excluídos."); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("visible"); setTimeout(() => el.classList.remove("visible"), 3200); }
function syncSalePaymentFields(useToday = false) {
  const form = $("saleForm");
  const paid = form.elements.paymentStatus.value === "paid";
  const method = form.elements.paymentMethod;
  const date = form.elements.paymentDate;
  method.disabled = !paid; date.disabled = !paid;
  method.required = paid; date.required = paid;
  form.classList.toggle("payment-is-pending", !paid);
  if (!paid) { method.value = ""; date.value = ""; }
  else if (useToday && !date.value) date.value = todayInputValue();
}

function openNewEvent() { if (!requireRole(["admin"], "Somente administradores podem criar eventos.")) return; const form = $("eventForm"); form.reset(); form.dataset.editId = ""; $("eventModalTitle").textContent = "Novo evento"; $("eventSubmitButton").textContent = "Criar evento"; resetPackages(); resetTicketTypes(); $("eventModal").showModal(); }
function openEditEvent(id) { if (!requireRole(["admin"], "Somente administradores podem editar eventos.")) return; const item = state.events.find((event) => event.id === id); if (!item) return; const form = $("eventForm"); form.reset(); form.dataset.editId = id; form.elements.name.value = item.name || ""; form.elements.date.value = item.date || ""; form.elements.place.value = item.place || ""; resetPackages(); $("ticketTypesList").innerHTML = ""; ticketTypesFor(item).forEach((type) => addTicketTypeRow(type.name, type.price, type.capacity, type.id)); packagesFor(item).forEach((packageItem) => addPackageRow(packageItem)); renderPackagesEmptyState(); $("eventModalTitle").textContent = "Editar evento"; $("eventSubmitButton").textContent = "Salvar alterações"; $("eventModal").showModal(); }
function openNewSale(eventId = "") { if (!requireRole(["admin", "seller"])) return; if (!state.events.length) return toast("Cadastre um evento antes de registrar uma venda."); const form = $("saleForm"); form.reset(); form.dataset.editId = ""; $("saleModalTitle").textContent = "Registrar ingressos"; $("saleSubmitButton").textContent = "Confirmar venda"; $("saleEvent").value = eventId; setSaleTicketItems(eventId); syncSalePaymentFields(true); $("saleModal").showModal(); }
function openEditSale(id) { if (!requireRole(["admin", "seller"])) return; const sale = state.sales.find((item) => item.id === id); if (!sale) return; if ($("allSalesModal").open) $("allSalesModal").close(); const form = $("saleForm"); form.reset(); form.dataset.editId = id; $("saleEvent").value = sale.eventId; setSaleTicketItems(sale.eventId, saleItems(sale)); form.elements.buyerName.value = sale.buyerName || ""; form.elements.buyerPhone.value = sale.buyerPhone || ""; form.elements.buyerEmail.value = sale.buyerEmail || ""; form.elements.paymentStatus.value = sale.paid ? "paid" : "pending"; form.elements.paymentMethod.value = sale.paymentMethod || ""; form.elements.paymentDate.value = sale.paymentDate || ""; form.elements.notes.value = sale.notes || ""; syncSalePaymentFields(false); $("saleModalTitle").textContent = "Editar participante e ingressos"; $("saleSubmitButton").textContent = "Salvar alterações"; $("saleModal").showModal(); }

document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.open === "eventModal") return openNewEvent(); if (button.dataset.open === "saleModal") return openNewSale(selectedEventId); $(button.dataset.open).showModal(); }));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
$("addTicketType").addEventListener("click", () => addTicketTypeRow());
$("addPackage").addEventListener("click", () => addPackageRow());
$("ticketTypesList").addEventListener("input", refreshPackageTicketOptions);
$("packagesList").addEventListener("input", (event) => { const packageRow = event.target.closest(".package-row"); if (packageRow) updatePackageSummary(packageRow); });
$("packagesList").addEventListener("change", (event) => { if (event.target.matches(".package-component-type")) refreshPackageTicketOptions(); });
$("addSaleTicketItem").addEventListener("click", () => { const event = state.events.find((item) => item.id === $("saleEvent").value); if (!event) return toast("Selecione o evento primeiro."); if (document.querySelectorAll(".sale-ticket-item-row").length >= saleOptionsFor(event, $("saleForm").dataset.editId || "").length) return toast("Todos os ingressos e pacotes disponíveis já foram adicionados."); addSaleTicketItemRow(); populateSaleTicketItemOptions(event.id); });
$("saleEvent").addEventListener("change", () => setSaleTicketItems($("saleEvent").value));
$("saleTicketItemsList").addEventListener("change", (event) => { if (event.target.matches(".sale-item-type")) populateSaleTicketItemOptions(); else updateSaleItemsSummary(); });
$("saleTicketItemsList").addEventListener("input", updateSaleItemsSummary);
$("saleForm").elements.paymentStatus.addEventListener("change", () => syncSalePaymentFields(true));
$("saleForm").elements.buyerPhone.addEventListener("blur", (event) => { event.currentTarget.value = formatPhoneDisplay(event.currentTarget.value); });
$("applyParticipantFilters").addEventListener("click", () => { selectedTicketTypeFilter = $("ticketTypeFilter").value; selectedPaymentFilter = $("paymentStatusFilter").value; selectedEntryFilter = $("entryStatusFilter").value; document.querySelector(".ticket-filter").open = false; render(); });
$("openFinancialReport").addEventListener("click", () => { if (!requireRole(["admin"], "O relatório financeiro é exclusivo para administradores.")) return; if (!selectedEventId) return toast("Selecione um evento para abrir o relatório financeiro."); location.hash = "relatorio-financeiro"; });
$("backToDashboard").addEventListener("click", () => { history.replaceState(null, "", location.href.split("#")[0]); syncApplicationPage(); window.scrollTo({ top: 0, behavior: "smooth" }); });
$("sellerClosingStart").addEventListener("change", render);
$("sellerClosingEnd").addEventListener("change", render);
$("sellerClosingToday").addEventListener("click", () => { const today = todayInputValue(); $("sellerClosingStart").value = today; $("sellerClosingEnd").value = today; render(); });
$("sellerClosingAll").addEventListener("click", () => { $("sellerClosingStart").value = ""; $("sellerClosingEnd").value = ""; render(); });
$("accessModal").addEventListener("cancel", (event) => event.preventDefault());
$("accessForm").addEventListener("submit", async (event) => { event.preventDefault(); if (!auth) return; const button = $("accessSubmitButton"); button.disabled = true; button.textContent = "Entrando..."; $("accessError").textContent = ""; try { await signInWithEmailAndPassword(auth, $("accessEmail").value.trim(), $("accessPassword").value); $("accessPassword").value = ""; } catch (error) { $("accessError").textContent = authErrorMessage(error); } finally { button.disabled = false; button.textContent = "Entrar no painel"; } });
$("resetPasswordButton").addEventListener("click", async () => { const email = $("accessEmail").value.trim(); if (!auth) { $("accessError").textContent = "O Firebase ainda está carregando. Tente novamente."; return; } if (!email) { $("accessError").textContent = "Digite seu e-mail para redefinir a senha."; $("accessEmail").focus(); return; } try { await sendPasswordResetEmail(auth, email); $("accessError").textContent = "Enviamos as instruções para o seu e-mail."; } catch (error) { $("accessError").textContent = authErrorMessage(error); } });
$("logoutButton").addEventListener("click", async () => { $("userMenu").open = false; if (isDemo) { toast("O modo local usa um perfil de demonstração."); return; } await signOut(auth); });
$("manageUsersButton").addEventListener("click", () => { if (!requireRole(["admin"])) return; $("userMenu").open = false; renderUsers(); $("userManagementModal").showModal(); });
document.querySelector('#createUserForm [name="role"]').addEventListener("change", syncCreateUserEventAccess);
$("createUserForm").addEventListener("reset", () => setTimeout(renderCreateUserEventOptions));
$("createUserForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const button = $("createUserButton"); button.disabled = true; button.textContent = "Criando..."; try { await createManagedUser(Object.fromEntries(new FormData(form))); form.reset(); toast("Usuário criado com sucesso."); } catch (error) { toast(authErrorMessage(error)); } finally { button.disabled = false; button.textContent = "+ Criar usuário"; } });
$("usersList").addEventListener("change", async (event) => { const select = event.target.closest("[data-user-role]"); if (!select) return; try { await updateManagedUserRole(select.dataset.userRole, select.value); } catch (error) { toast(error.message); renderUsers(); } });
$("usersList").addEventListener("click", async (event) => { const toggle = event.target.closest("[data-toggle-user]"); const reset = event.target.closest("[data-reset-user]"); try { if (toggle) await toggleManagedUser(toggle.dataset.toggleUser); if (reset) await resetManagedUserPassword(reset.dataset.resetUser); } catch (error) { toast(authErrorMessage(error)); } });
$("usersList").addEventListener("click", async (event) => {
  const save = event.target.closest("[data-save-user-events]");
  if (!save) return;
  const editor = save.closest("[data-event-access-user]");
  const eventIds = [...editor.querySelectorAll("input:checked")].map((input) => input.value);
  save.disabled = true;
  try { await updateManagedUserEvents(save.dataset.saveUserEvents, eventIds); }
  catch (error) { toast(error.message); }
  finally { save.disabled = false; }
});
$("participantSearch").addEventListener("input", (event) => { participantSearchQuery = event.currentTarget.value; render(); });
$("participantSearch").addEventListener("keydown", (event) => { if (event.key === "Escape") { participantSearchQuery = ""; render(); event.currentTarget.focus(); } });
document.querySelectorAll("[data-clear-participant-filters]").forEach((button) => button.addEventListener("click", () => { resetParticipantFilters(); document.querySelector(".ticket-filter").open = false; render(); $("participantSearch").focus(); }));
$("eventsList").addEventListener("click", (event) => { if (event.target.closest("[data-select-event]")) resetParticipantFilters(); });
$("eventForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); data.ticketTypes = getTicketTypes(); if (!data.ticketTypes.length) throw new Error("Informe ao menos um tipo ou lote com valor e quantidade."); data.packages = getPackages(data.ticketTypes); await saveEvent(data, form.dataset.editId); form.reset(); resetPackages(); resetTicketTypes(); $("eventModal").close(); } catch (error) { toast(error.message); } });
$("saleForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); data.items = getSaleTicketItems(); await saveSale(data, form.dataset.editId); form.reset(); $("saleTicketItemsList").innerHTML = ""; $("saleModal").close(); } catch (error) { toast(error.message); } });
$("paymentConfirmationForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true; try { await confirmSalePayment(Object.fromEntries(new FormData(form))); form.reset(); $("paymentConfirmationModal").close(); toast("Pagamento confirmado."); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
document.addEventListener("click", (event) => { const whatsappTrigger = event.target.closest("[data-whatsapp]"); if (whatsappTrigger) { event.preventDefault(); openWhatsappChooser(whatsappTrigger); return; } const whatsappApp = event.target.closest("[data-whatsapp-app]"); if (whatsappApp) { launchWhatsapp(whatsappApp.dataset.whatsappApp); return; } const addPackageComponent = event.target.closest("[data-add-package-component]"); if (addPackageComponent) { const packageRow = addPackageComponent.closest(".package-row"); if (packageRow.querySelectorAll(".package-component-row").length >= draftTicketTypes().filter((item) => item.name).length) return toast("Todos os tipos de ingresso já estão neste pacote."); addPackageComponentRow(packageRow); refreshPackageTicketOptions(); return; } const removePackageComponent = event.target.closest("[data-remove-package-component]"); if (removePackageComponent) { const packageRow = removePackageComponent.closest(".package-row"); if (packageRow.querySelectorAll(".package-component-row").length === 1) return toast("O pacote precisa ter pelo menos um ingresso."); removePackageComponent.closest(".package-component-row").remove(); refreshPackageTicketOptions(); return; } const removePackage = event.target.closest("[data-remove-package]"); if (removePackage) { removePackage.closest(".package-row").remove(); refreshPackageTicketOptions(); return; } const removeTicket = event.target.closest("[data-remove-ticket]"); if (removeTicket) { if (document.querySelectorAll(".ticket-type-row").length === 1) return toast("O evento precisa de pelo menos um tipo de ingresso."); removeTicket.closest(".ticket-type-row").remove(); refreshPackageTicketOptions(); return; } const removeSaleTicket = event.target.closest("[data-remove-sale-ticket]"); if (removeSaleTicket) { const rows = document.querySelectorAll(".sale-ticket-item-row"); if (rows.length === 1) return toast("A venda precisa de pelo menos um item."); removeSaleTicket.closest(".sale-ticket-item-row").remove(); populateSaleTicketItemOptions(); return; } const selectedAction = event.target.closest("[data-selected-action]"); if (selectedAction) { const action = selectedAction.dataset.selectedAction; if (action === "sale") openNewSale(selectedEventId); if (action === "edit") openEditEvent(selectedEventId); if (action === "history") openAuditHistory(selectedEventId); if (action === "export" && requireRole(["admin", "seller"])) window.exportSalesXlsx(state.sales, state.events, selectedEventId); if (action === "delete") deleteEvent(selectedEventId); return; } const selectEvent = event.target.closest("[data-select-event]"); if (selectEvent) { selectedEventId = selectEvent.dataset.selectEvent; render(); return; } const editSaleButton = event.target.closest("[data-edit-sale]"); if (editSaleButton) { openEditSale(editSaleButton.dataset.editSale); return; } const deleteSaleButton = event.target.closest("[data-delete-sale]"); if (deleteSaleButton) { deleteSale(deleteSaleButton.dataset.deleteSale); return; } const checkin = event.target.closest("[data-checkin]"); if (checkin) { toggleCheckin(checkin.dataset.checkin); return; } const paid = event.target.closest("[data-paid]"); if (paid) { togglePayment(paid.dataset.paid); return; } const saleRow = event.target.closest("[data-sale-row]"); if (saleRow && hasRole("admin", "seller")) { openEditSale(saleRow.dataset.saleRow); return; } });
document.addEventListener("click", (event) => { const toggle = event.target.closest?.("[data-toggle-package-discount]"); if (!toggle) return; event.preventDefault(); event.stopImmediatePropagation(); togglePackageDiscountType(toggle.closest(".package-row")); }, true);
// O cartão do participante é somente informativo; edição acontece apenas pelo botão Editar.
document.addEventListener("click", (event) => { const row = event.target.closest?.("[data-sale-row]"); if (row && !event.target.closest("button, a, input, select, textarea")) event.stopImmediatePropagation(); }, true);
document.addEventListener("keydown", (event) => { const card = event.target.closest?.("[data-select-event]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedEventId = card.dataset.selectEvent; resetParticipantFilters(); render(); } });
window.addEventListener("hashchange", () => { syncApplicationPage(); window.scrollTo({ top: 0, behavior: "smooth" }); });
window.addEventListener("popstate", syncApplicationPage);
start();
resetTicketTypes();
resetPackages();
setSaleTicketItems("");
syncSalePaymentFields(true);
