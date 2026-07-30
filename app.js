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
let tableReservationSearchQuery = "";
let tableReservationAreaFilter = "all";
let tableReservationPaymentFilter = "all";
let eventMapDraft = { areas: [], furniture: [] };
let activeMapEditorArea = "";
let activeMapViewerArea = "";
let activeMapTool = "";
let selectedMapFurnitureId = "";
let mapPointerAction = null;
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
const PAYMENT_METHOD_LABELS = { pix: "Pix", cash: "Dinheiro", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", bank_transfer: "Transferência", other: "Outro", courtesy: "Cortesia" };

function roleLabel(role) { return ROLE_LABELS[role] || "Sem perfil"; }
function paymentMethodLabel(method) { return PAYMENT_METHOD_LABELS[method] || "Forma não informada"; }
function todayInputValue() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 10); }
function paymentDateLabel(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Data não informada"; }
function paymentDetailsHtml(sale) { if (sale.courtesy || sale.paymentMethod === "courtesy") return `<small class="payment-details">Sem cobrança</small>`; return sale.paid ? `<small class="payment-details">${escapeHtml(paymentMethodLabel(sale.paymentMethod))} · ${escapeHtml(paymentDateLabel(sale.paymentDate))}</small>` : ""; }
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
    currentUser = null; currentUserProfile = null; state = { events: [], sales: [], users: [], auditLogs: [] }; $("connectionDot").classList.remove("online"); $("connectionText").textContent = "Desconectado"; if ($("userManagementModal").open) $("userManagementModal").close(); applyRolePermissions(); render(); showAccessModal(); return;
  }
  try {
    const profileSnapshot = await get(ref(db, `users/${user.uid}`));
    const profile = profileSnapshot.val();
    if (!profile || !profile.active || !ROLE_LABELS[profile.role]) { await signOut(auth); showAccessModal("Sua conta ainda não possui permissão ativa. Fale com o administrador."); return; }
    currentUser = user; currentUserProfile = { ...profile, active: profile.active === true }; hideAccessModal(); applyRolePermissions();
    $("connectionDot").classList.add("online"); $("connectionText").textContent = "Conectado";
    attachRealtimeListeners();
  } catch (error) { console.error(error); await signOut(auth); showAccessModal("Não foi possível carregar suas permissões. Confira as regras do Firebase."); }
}
async function start() {
  if (isDemo) {
    currentUser = { uid: "local-demo", email: "demo@local" }; currentUserProfile = { name: "Administrador local", email: "demo@local", role: "admin", active: true };
    state = { events: JSON.parse(localStorage.getItem("ingressa-events") || "null") || demoEvents, sales: JSON.parse(localStorage.getItem("ingressa-sales") || "null") || demoSales, users: [{ id: "local-demo", ...currentUserProfile }], auditLogs: JSON.parse(localStorage.getItem("ingressa-audit-logs") || "null") || [] };
    $("connectionText").textContent = "Desconectado"; applyRolePermissions(); render(); return;
  }
  try {
    showAccessModal();
    $("connectionText").textContent = "Desconectado";
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
function isTableReservation(sale) { return sale?.reservationType === "table" && Boolean(sale.furnitureId); }
function eventUsesTableMap(event) { return event?.eventMode === "mixed" && normalizeTableMap(event?.tableMap).areas.length > 0; }
function mapAreaLabel(area) { return area === "mezanino" ? "Mezanino" : "Salão"; }
function furnitureKindLabel(kind) { return kind === "bistro" ? "Bistrô" : "Mesa"; }
function normalizeTableMap(value) {
  const sourceAreas = Array.isArray(value?.areas) ? value.areas : Object.values(value?.areas || {});
  const areas = [...new Set(sourceAreas.map(String).filter((area) => area === "salao" || area === "mezanino"))];
  const sourceFurniture = Array.isArray(value?.furniture) ? value.furniture : Object.values(value?.furniture || {});
  const furniture = sourceFurniture.map((item) => ({
    id: String(item.id || newEntityId("movel")),
    area: item.area === "mezanino" ? "mezanino" : "salao",
    kind: item.kind === "bistro" ? "bistro" : "table",
    number: Math.max(1, Number(item.number || 1)),
    x: Math.min(96, Math.max(4, Number(item.x || 50))),
    y: Math.min(96, Math.max(4, Number(item.y || 50))),
    width: Math.min(24, Math.max(5, Number(item.width || (item.kind === "bistro" ? 9 : 11)))),
    height: Math.min(24, Math.max(5, Number(item.height || (item.kind === "bistro" ? 7 : 11))))
  })).filter((item) => areas.includes(item.area));
  return { areas, furniture };
}
function packagesFor(event) {
  const original = Array.isArray(event?.packages) ? event.packages : Object.values(event?.packages || {});
  return original.map((item) => {
    const packageItems = (Array.isArray(item.items) ? item.items : Object.values(item.items || {})).map((component) => ({ ticketTypeId: component.ticketTypeId || "", quantity: Math.max(0, Number(component.quantity || 0)) })).filter((component) => component.ticketTypeId && component.quantity > 0);
    const regularPrice = packageItems.reduce((sum, component) => { const type = ticketTypesFor(event).find((ticket) => ticket.id === component.ticketTypeId); return sum + Number(type?.price || 0) * component.quantity; }, 0);
    const packageKind = item.packageKind === "courtesy" || item.kind === "courtesy" ? "courtesy" : "package";
    const discountType = packageKind === "courtesy" ? "percent" : item.discountType === "fixed" ? "fixed" : "percent";
    const legacyPercent = Math.min(100, Math.max(0, Number(item.discountPercent || 0)));
    const discountValue = packageKind === "courtesy" ? 100 : Math.max(0, Number(item.discountValue ?? (discountType === "fixed" ? item.discountAmount : legacyPercent) ?? 0));
    const discountAmount = packageKind === "courtesy" ? regularPrice : discountType === "fixed" ? Math.min(regularPrice, discountValue) : regularPrice * Math.min(100, discountValue) / 100;
    const discountPercent = regularPrice > 0 ? discountAmount / regularPrice * 100 : 0;
    const price = packageKind === "courtesy" ? 0 : Math.max(0, Number(item.price ?? regularPrice - discountAmount));
    return { ...item, id: item.id || "", name: item.name || (packageKind === "courtesy" ? "Cortesia" : "Pacote"), packageKind, items: packageItems, regularPrice: Number(item.regularPrice ?? regularPrice), discountType, discountValue, discountAmount, discountPercent, price };
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
      const packageKind = item.packageKind === "courtesy" || packageItem?.packageKind === "courtesy" ? "courtesy" : "package";
      const packageName = item.packageName || packageItem?.name || String(item.ticketTypeName || (packageKind === "courtesy" ? "Cortesia" : "Pacote")).replace(/^(?:Pacote|Cortesia):\s*/i, "");
      const unitPrice = Number(item.unitPrice ?? packageItem?.price ?? 0);
      return { kind: "package", packageKind, packageId: item.packageId || packageItem?.id || "", packageName, ticketTypeId: `package:${item.packageId || packageItem?.id || ""}`, ticketTypeName: `${packageKind === "courtesy" ? "Cortesia" : "Pacote"}: ${packageName}`, unitPrice, quantity, subtotal: Number(item.subtotal ?? unitPrice * quantity), components };
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
function saleTicketSummary(sale, event) { return saleItems(sale, event).map((item) => item.kind === "package" ? `${item.quantity}× ${item.packageKind === "courtesy" ? "Cortesia" : "Pacote"} ${item.packageName} (${item.components.map((component) => `${component.quantity}× ${component.ticketTypeName}`).join(" + ")})` : `${item.quantity}× ${item.ticketTypeName}`).join(" + ") || "Ingresso padrão"; }
function saleTicketBreakdownHtml(sale, event) { return `<span class="sale-ticket-breakdown">${saleItems(sale, event).map((item) => item.kind === "package" ? `<span><b>${item.quantity}×</b><span class="package-item-name ${item.packageKind === "courtesy" ? "courtesy-item-name" : ""}">${item.packageKind === "courtesy" ? "Cortesia" : "Pacote"} ${escapeHtml(item.packageName)}</span><em>${money.format(item.subtotal)}</em></span><small class="package-composition">${escapeHtml(item.components.map((component) => `${component.quantity}× ${component.ticketTypeName}`).join(" + "))}</small>` : `<span><b>${item.quantity}×</b><span>${escapeHtml(item.ticketTypeName)}</span><em>${money.format(item.subtotal)}</em></span>`).join("")}</span>`; }
function saleIsCourtesy(sale, event) { const items = saleItems(sale, event); return Boolean(items.length && items.every((item) => item.kind === "package" && item.packageKind === "courtesy") && saleTotal(sale, event) === 0); }
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
function matchesTableReservationSearch(sale) {
  const query = tableReservationSearchQuery.trim();
  if (!query) return true;
  const occupants = Array.isArray(sale.occupants) ? sale.occupants : Object.values(sale.occupants || {});
  const text = [sale.reservationLabel, sale.buyerName, ...occupants].map(normalizedSearch).join(" ");
  const queryDigits = query.replace(/\D/g, "");
  return text.includes(normalizedSearch(query)) || Boolean(queryDigits && String(sale.buyerPhone || "").replace(/\D/g, "").includes(queryDigits));
}
function matchesTableReservationFilters(sale) {
  const matchesArea = tableReservationAreaFilter === "all" || sale.reservationArea === tableReservationAreaFilter;
  const matchesPayment = tableReservationPaymentFilter === "all" || (tableReservationPaymentFilter === "paid" ? sale.paid : !sale.paid);
  return matchesArea && matchesPayment && matchesTableReservationSearch(sale);
}
function resetTableReservationFilters() {
  tableReservationSearchQuery = "";
  tableReservationAreaFilter = "all";
  tableReservationPaymentFilter = "all";
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
function renderPackagesEmptyState() { if (!document.querySelector(".package-row")) $("packagesList").innerHTML = `<div class="packages-empty">Nenhum pacote ou cortesia criado. Use “+ Pacote” ou “+ Cortesia” para começar.</div>`; }
function addPackageComponentRow(packageRow, ticketTypeId = "", quantity = 1) {
  const row = document.createElement("div");
  row.className = "package-component-row";
  row.innerHTML = `<label>Ingresso<select class="package-component-type" required></select></label><label>Quantidade<input class="package-component-quantity" type="number" min="1" step="1" value="${Math.max(1, Number(quantity || 1))}" required /></label><button class="close" type="button" data-remove-package-component aria-label="Remover ingresso do pacote">×</button>`;
  row.querySelector(".package-component-type").dataset.selectedValue = ticketTypeId;
  packageRow.querySelector(".package-components").append(row);
}
function addPackageRow(packageData = {}, requestedKind = "package") {
  if (!document.querySelector(".package-row")) $("packagesList").innerHTML = "";
  const row = document.createElement("div");
  const packageKind = packageData.packageKind === "courtesy" || packageData.kind === "courtesy" || requestedKind === "courtesy" ? "courtesy" : "package";
  row.className = `package-row${packageKind === "courtesy" ? " is-courtesy" : ""}`;
  row.dataset.packageKind = packageKind;
  row.dataset.packageId = packageData.id || newEntityId("pacote");
  const discountType = packageKind === "courtesy" ? "percent" : packageData.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = packageKind === "courtesy" ? 100 : Number(packageData.discountValue ?? (discountType === "fixed" ? packageData.discountAmount : packageData.discountPercent) ?? 0);
  row.dataset.discountType = discountType;
  const kindLabel = packageKind === "courtesy" ? "cortesia" : "pacote";
  row.innerHTML = `<div class="package-kind-badge">${packageKind === "courtesy" ? "CORTESIA" : "PACOTE PROMOCIONAL"}</div><div class="package-row-heading"><label>Nome da ${kindLabel}<input class="package-name" required placeholder="${packageKind === "courtesy" ? "Ex.: Cortesia imprensa" : "Ex.: Combo casal"}" value="${escapeHtml(packageData.name || "")}" /></label><label class="package-discount-label"><span>Desconto <button class="package-discount-toggle" type="button" data-toggle-package-discount title="Alternar entre porcentagem e reais" aria-label="Alterar desconto para ${discountType === "fixed" ? "porcentagem" : "valor em reais"}">${discountType === "fixed" ? "R$" : "%"}</button></span><input class="package-discount" type="number" min="0" step="0.01" value="${discountValue}" required /></label><button class="close" type="button" data-remove-package aria-label="Remover ${kindLabel}">×</button></div><div class="package-components"></div><div class="package-actions"><button class="package-add-component" type="button" data-add-package-component>+ Adicionar ingresso à ${kindLabel}</button><div class="package-summary"><span>Normal: <strong data-package-regular>R$ 0,00</strong></span><span>${packageKind === "courtesy" ? "Cortesia" : "Pacote"}: <strong data-package-price>R$ 0,00</strong></span><span class="package-saving" data-package-saving>${packageKind === "courtesy" ? "Valor liberado" : "Economia"} R$ 0,00</span></div></div>`;
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
  const isCourtesy = packageRow.dataset.packageKind === "courtesy";
  const isFixed = packageRow.dataset.discountType === "fixed";
  const input = packageRow.querySelector(".package-discount");
  const toggle = packageRow.querySelector("[data-toggle-package-discount]");
  const { regularPrice } = packageDraftDetails(packageRow);
  if (isCourtesy) { packageRow.dataset.discountType = "percent"; input.value = "100"; input.max = "100"; toggle.textContent = "%"; toggle.disabled = true; return; }
  input.max = isFixed ? String(Math.max(0, regularPrice)) : "100";
  toggle.textContent = isFixed ? "R$" : "%";
  toggle.setAttribute("aria-label", `Alterar desconto para ${isFixed ? "porcentagem" : "valor em reais"}`);
}
function togglePackageDiscountType(packageRow) {
  if (packageRow.dataset.packageKind === "courtesy") return;
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
  const isCourtesy = packageRow.dataset.packageKind === "courtesy";
  const discountValue = isCourtesy ? 100 : Math.max(0, Number(packageRow.querySelector(".package-discount").value || 0));
  const isFixed = packageRow.dataset.discountType === "fixed";
  const discountAmount = isCourtesy ? regularPrice : isFixed ? Math.min(regularPrice, discountValue) : regularPrice * Math.min(100, discountValue) / 100;
  const price = Math.round(Math.max(0, regularPrice - discountAmount) * 100) / 100;
  syncPackageDiscountControl(packageRow);
  packageRow.querySelector("[data-package-regular]").textContent = money.format(regularPrice);
  packageRow.querySelector("[data-package-price]").textContent = money.format(price);
  packageRow.querySelector("[data-package-saving]").textContent = `${isCourtesy ? "Valor liberado" : "Economia"} ${money.format(regularPrice - price)}`;
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
    const packageKind = row.dataset.packageKind === "courtesy" ? "courtesy" : "package";
    const discountType = packageKind === "courtesy" ? "percent" : row.dataset.discountType === "fixed" ? "fixed" : "percent";
    const discountValue = packageKind === "courtesy" ? 100 : Number(row.querySelector(".package-discount").value);
    if (!name) throw new Error("Informe o nome de todos os pacotes e cortesias.");
    const normalizedName = normalizedSearch(name);
    if (packageNames.has(normalizedName)) throw new Error(`O nome “${name}” foi cadastrado mais de uma vez entre os pacotes e cortesias.`);
    packageNames.add(normalizedName);
    if (!Number.isFinite(discountValue) || discountValue < 0) throw new Error(`Informe um desconto válido para “${name}”.`);
    if (discountType === "percent" && discountValue > 100) throw new Error(`Informe um desconto entre 0% e 100% para “${name}”.`);
    const usedTypes = new Set();
    const items = [...row.querySelectorAll(".package-component-row")].map((componentRow) => {
      const ticketTypeId = componentRow.querySelector(".package-component-type").value;
      const type = ticketTypes.find((item) => item.id === ticketTypeId);
      if (!type) throw new Error(`Selecione todos os ingressos de “${name}”.`);
      if (usedTypes.has(type.id)) throw new Error(`O ingresso “${type.name}” está repetido em “${name}”.`);
      usedTypes.add(type.id);
      const quantity = Number(componentRow.querySelector(".package-component-quantity").value);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`Informe uma quantidade válida para “${type.name}” em “${name}”.`);
      if (quantity > Number(type.capacity || 0)) throw new Error(`“${name}” usa ${quantity} ingressos “${type.name}”, mas somente ${type.capacity} estão disponíveis no evento.`);
      return { ticketTypeId: type.id, quantity };
    });
    const regularPrice = items.reduce((sum, component) => sum + Number(ticketTypes.find((type) => type.id === component.ticketTypeId)?.price || 0) * component.quantity, 0);
    if (packageKind !== "courtesy" && discountType === "fixed" && discountValue > regularPrice) throw new Error(`O desconto em reais do pacote “${name}” não pode ser maior que ${money.format(regularPrice)}.`);
    const discountAmount = packageKind === "courtesy" ? regularPrice : discountType === "fixed" ? discountValue : regularPrice * discountValue / 100;
    const discountPercent = regularPrice > 0 ? discountAmount / regularPrice * 100 : 0;
    const price = packageKind === "courtesy" ? 0 : Math.round(Math.max(0, regularPrice - discountAmount) * 100) / 100;
    return { id: row.dataset.packageId, name, packageKind, discountType, discountValue, discountAmount, discountPercent, regularPrice, price, items };
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
  const selectedOptions = [];
  document.querySelectorAll(".sale-ticket-item-row").forEach((row) => {
    const option = options.find((item) => item.key === row.querySelector(".sale-item-type").value);
    const itemQuantity = Math.max(0, Number(row.querySelector(".sale-item-quantity").value || 0));
    if (option && Number.isInteger(itemQuantity)) { selectedOptions.push(option); quantity += (option.kind === "package" ? packageTicketCount(option.item) : 1) * itemQuantity; total += Number(option.item.price || 0) * itemQuantity; }
  });
  const courtesyOnly = Boolean(selectedOptions.length && selectedOptions.length === document.querySelectorAll(".sale-ticket-item-row").length && selectedOptions.every((option) => option.kind === "package" && option.item.packageKind === "courtesy"));
  $("saleForm").classList.toggle("sale-is-courtesy", courtesyOnly);
  syncSalePaymentFields(false);
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
    const packageOptions = options.filter((option) => option.kind === "package" && option.item.packageKind !== "courtesy").map((option) => { const disabled = selectedValues.some((value, index) => index !== rowIndex && value === option.key) || (option.available === 0 && selectedValue !== option.key); return `<option value="${option.key}" ${disabled ? "disabled" : ""}>PACOTE · ${escapeHtml(option.item.name)} — ${money.format(option.item.price)} — ${packageTicketCount(option.item)} ingressos — ${option.available} pacotes disponíveis</option>`; }).join("");
    const courtesyOptions = options.filter((option) => option.kind === "package" && option.item.packageKind === "courtesy").map((option) => { const disabled = selectedValues.some((value, index) => index !== rowIndex && value === option.key) || (option.available === 0 && selectedValue !== option.key); return `<option value="${option.key}" ${disabled ? "disabled" : ""}>CORTESIA · ${escapeHtml(option.item.name)} — R$ 0,00 — ${packageTicketCount(option.item)} ingressos — ${option.available} disponíveis</option>`; }).join("");
    select.innerHTML = event ? `<option value="">Selecione o item</option><optgroup label="Ingressos avulsos">${ticketOptions}</optgroup>${packageOptions ? `<optgroup label="Pacotes promocionais">${packageOptions}</optgroup>` : ""}${courtesyOptions ? `<optgroup label="Cortesias">${courtesyOptions}</optgroup>` : ""}` : `<option value="">Selecione primeiro o evento</option>`;
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
    return { kind: "package", packageKind: option.item.packageKind || "package", packageId: option.item.id, packageName: option.item.name, ticketTypeId: `package:${option.item.id}`, ticketTypeName: `${option.item.packageKind === "courtesy" ? "Cortesia" : "Pacote"}: ${option.item.name}`, unitPrice: Number(option.item.price || 0), quantity, subtotal: Number(option.item.price || 0) * quantity, components };
  });
}
function addSaleEditButtons() { if (!hasRole("admin", "seller")) return; document.querySelectorAll("[data-sale-row]").forEach((row) => { const actions = row.lastElementChild; if (!actions?.querySelector("[data-edit-sale]")) { const button = document.createElement("button"); button.type = "button"; button.className = "edit-button"; button.dataset.editSale = row.dataset.saleRow; button.textContent = "Editar"; actions.prepend(button); } }); }
function toggleParticipantCard(row) { if (!row) return; const expanded = row.classList.toggle("is-expanded"); row.setAttribute("aria-expanded", String(expanded)); const button = row.querySelector("[data-toggle-sale-details]"); if (button) button.textContent = expanded ? "Ocultar detalhes" : "Detalhar"; }
function toggleTableReservationCard(card) { if (!card) return; const expanded = card.classList.toggle("is-expanded"); card.setAttribute("aria-expanded", String(expanded)); const button = card.querySelector("[data-toggle-table-reservation-details]"); if (button) button.textContent = expanded ? "Ocultar detalhes" : "Detalhar"; }
function toggleMetricDetails(button) { const details = $(button.dataset.toggleMetricDetails); if (!details) return; const expanded = details.hidden; details.hidden = !expanded; button.setAttribute("aria-expanded", String(expanded)); button.textContent = expanded ? "Ocultar" : "Detalhar"; }
function toggleSellerTicketReport() { const report = $("sellerTicketReport"); const button = $("sellerDetailsToggle"); const expanded = report.hidden; report.hidden = !expanded; button.setAttribute("aria-expanded", String(expanded)); button.textContent = expanded ? "Ocultar" : "Detalhar"; }

function presetSlotsFor(area) {
  const slots = [];
  const add = (x, y, width = 7.2, height = 7.2) => slots.push({ id: `slot-${area}-${String(slots.length + 1).padStart(2, "0")}`, area, x, y, width, height });
  if (area === "salao") {
    [8.4, 22, 31.5, 41.1, 50.5, 60.2].forEach((x) => add(x, 14.4));
    [12.3, 22, 31.5, 41.1, 50.5, 60.2].forEach((x) => add(x, 23.2));
    [34.4, 44, 53.6, 63.4].forEach((y) => [22, 31.5, 41.1, 50.5, 60.2].forEach((x) => add(x, y)));
  } else {
    [15.2, 25.8, 36.4, 47.1, 57.8, 68.5].forEach((y) => add(56.5, y, 7, 7));
    [28.8, 38.9, 48.4].forEach((x) => add(x, 77.6, 7, 7));
    [36.2, 45.9, 56.5].forEach((x) => add(x, 88.4, 7, 7));
  }
  return slots;
}

function migrateFurnitureToPreset(tableMap) {
  const normalized = normalizeTableMap(tableMap);
  const used = new Set();
  const furniture = [...normalized.furniture].sort((a, b) => Number(a.number || 0) - Number(b.number || 0)).map((item) => {
    const presets = presetSlotsFor(item.area);
    let preset = presets.find((slot) => slot.id === item.id && !used.has(slot.id));
    if (!preset) preset = presets.filter((slot) => !used.has(slot.id)).sort((a, b) => Math.hypot(a.x - Number(item.x || 0), a.y - Number(item.y || 0)) - Math.hypot(b.x - Number(item.x || 0), b.y - Number(item.y || 0)))[0];
    if (!preset) return item;
    used.add(preset.id);
    return { ...preset, id: item.id, slotId: preset.id, kind: item.kind === "bistro" ? "bistro" : "table", number: Number(item.number || 0) };
  });
  return { areas: normalized.areas, furniture };
}

function mapFurnitureHtml(item, editor = false, reservation = null) {
  const label = `${furnitureKindLabel(item.kind)} ${String(item.number).padStart(2, "0")} — ${mapAreaLabel(item.area)}`;
  const status = reservation ? (reservation.paid ? "is-paid" : "is-pending") : "is-free";
  const occupancy = reservation ? `<span class="map-furniture-occupancy">${reservation.occupants?.length || reservation.quantity || 1}</span>` : "";
  const content = `<img src="${item.kind === "bistro" ? "bistro-icon.png" : "mesa-icon.png"}" alt="" /><span class="map-furniture-number">${String(item.number).padStart(2, "0")}</span>${occupancy}`;
  const style = `left:${item.x}%;top:${item.y}%;width:${item.width}%;height:${item.height}%`;
  return editor
    ? `<button class="map-furniture map-preset-slot kind-${item.kind} is-active" type="button" data-map-slot="${item.slotId || item.id}" style="${style}" aria-label="${escapeHtml(label)}">${content}</button>`
    : `<button class="map-furniture kind-${item.kind} ${status}" type="button" data-reserve-furniture="${item.id}" style="${style}" aria-label="${escapeHtml(`${label}${reservation ? `, reservada para ${reservation.buyerName}` : ", livre"}`)}">${content}</button>`;
}

function updateMapEditorTabs() {
  const tabs = $("mapEditorAreaTabs");
  if (!eventMapDraft.areas.includes(activeMapEditorArea)) activeMapEditorArea = eventMapDraft.areas[0] || "";
  tabs.innerHTML = eventMapDraft.areas.map((area) => `<button class="${area === activeMapEditorArea ? "is-active" : ""}" type="button" data-editor-map-area="${area}" role="tab" aria-selected="${area === activeMapEditorArea}">${mapAreaLabel(area)}</button>`).join("");
}

function renderMapEditor() {
  updateMapEditorTabs();
  const stage = $("tableMapEditor");
  document.querySelectorAll("[data-map-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.mapTool === activeMapTool));
  if (!activeMapEditorArea) {
    stage.removeAttribute("data-area");
    stage.innerHTML = `<div class="map-empty-hint">Selecione Salão ou Mezanino para começar.</div>`;
    return;
  }
  stage.dataset.area = activeMapEditorArea;
  const furniture = eventMapDraft.furniture.filter((item) => item.area === activeMapEditorArea);
  stage.innerHTML = presetSlotsFor(activeMapEditorArea).map((slot) => {
    const active = furniture.find((item) => (item.slotId || item.id) === slot.id);
    if (active) return mapFurnitureHtml(active, true);
    const style = `left:${slot.x}%;top:${slot.y}%;width:${slot.width}%;height:${slot.height}%`;
    return `<button class="map-furniture map-preset-slot is-inactive" type="button" data-map-slot="${slot.id}" style="${style}" aria-label="Ativar esta posição"><span class="map-slot-plus">+</span></button>`;
  }).join("");
}

function syncEventMapSettings() {
  const mixed = $("eventMode").value === "mixed";
  $("eventMapSettings").hidden = !mixed;
  $("chairPrice").required = mixed;
  if (mixed && !eventMapDraft.areas.length) {
    const salon = document.querySelector('#eventForm [name="mapArea"][value="salao"]');
    if (salon) salon.checked = true;
    eventMapDraft.areas = ["salao"];
    activeMapEditorArea = "salao";
  }
  if (mixed && !activeMapTool) activeMapTool = "table";
  renderMapEditor();
}

function resetEventMapDraft(event = null) {
  eventMapDraft = migrateFurnitureToPreset(event?.tableMap);
  activeMapEditorArea = eventMapDraft.areas[0] || "";
  activeMapTool = "table";
  selectedMapFurnitureId = "";
  document.querySelectorAll('#eventForm [name="mapArea"]').forEach((input) => { input.checked = eventMapDraft.areas.includes(input.value); });
  renderMapEditor();
}

function togglePresetSlot(slotId) {
  if (!activeMapTool) return toast("Selecione primeiro Mesa ou Bistrô.");
  const slot = presetSlotsFor(activeMapEditorArea).find((item) => item.id === slotId);
  if (!slot) return;
  const existingIndex = eventMapDraft.furniture.findIndex((item) => (item.slotId || item.id) === slotId);
  if (existingIndex >= 0) {
    const existing = eventMapDraft.furniture[existingIndex];
    if (existing.kind !== activeMapTool) existing.kind = activeMapTool;
    else {
      const editingEventId = $("eventForm").dataset.editId;
      if (editingEventId && tableReservationsFor(editingEventId).some((sale) => sale.furnitureId === slotId)) return toast("Esta posição possui uma reserva e não pode ser desativada.");
      eventMapDraft.furniture.splice(existingIndex, 1);
      eventMapDraft.furniture.sort((a, b) => Number(a.number || 0) - Number(b.number || 0)).forEach((item, index) => { item.number = index + 1; });
    }
  } else {
    const number = Math.max(0, ...eventMapDraft.furniture.map((item) => Number(item.number || 0))) + 1;
    eventMapDraft.furniture.push({ ...slot, kind: activeMapTool, number });
  }
  renderMapEditor();
}

function addFurnitureAtPointer(pointerEvent) {
  if (!activeMapTool || !activeMapEditorArea) return;
  const stage = $("tableMapEditor");
  const rect = stage.getBoundingClientRect();
  const x = Math.min(96, Math.max(4, (pointerEvent.clientX - rect.left) / rect.width * 100));
  const y = Math.min(96, Math.max(4, (pointerEvent.clientY - rect.top) / rect.height * 100));
  const sameKind = eventMapDraft.furniture.filter((item) => item.area === activeMapEditorArea && item.kind === activeMapTool);
  const number = Math.max(0, ...sameKind.map((item) => Number(item.number || 0))) + 1;
  const item = { id: newEntityId("movel"), area: activeMapEditorArea, kind: activeMapTool, number, x, y, width: activeMapTool === "bistro" ? 9 : 11, height: activeMapTool === "bistro" ? 7 : 11 };
  eventMapDraft.furniture.push(item);
  selectedMapFurnitureId = item.id;
  renderMapEditor();
}

function handleMapPointerDown(event) {
  const furnitureElement = event.target.closest("[data-map-furniture]");
  if (!furnitureElement) {
    if (event.target.closest(".map-empty-hint") || event.target === $("tableMapEditor")) addFurnitureAtPointer(event);
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  selectedMapFurnitureId = furnitureElement.dataset.mapFurniture;
  const item = eventMapDraft.furniture.find((entry) => entry.id === selectedMapFurnitureId);
  if (!item) return;
  document.querySelectorAll("#tableMapEditor .map-furniture").forEach((element) => element.classList.toggle("is-selected", element.dataset.mapFurniture === selectedMapFurnitureId));
  const rect = $("tableMapEditor").getBoundingClientRect();
  mapPointerAction = { type: event.target.closest("[data-map-resize]") ? "resize" : "move", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, rect, item, initial: { x: item.x, y: item.y, width: item.width, height: item.height }, element: furnitureElement };
  furnitureElement.setPointerCapture?.(event.pointerId);
}

function handleMapPointerMove(event) {
  if (!mapPointerAction || mapPointerAction.pointerId !== event.pointerId) return;
  event.preventDefault();
  const deltaX = (event.clientX - mapPointerAction.startX) / mapPointerAction.rect.width * 100;
  const deltaY = (event.clientY - mapPointerAction.startY) / mapPointerAction.rect.height * 100;
  const { item, initial, element } = mapPointerAction;
  if (mapPointerAction.type === "move") {
    item.x = Math.min(96, Math.max(4, initial.x + deltaX));
    item.y = Math.min(96, Math.max(4, initial.y + deltaY));
    element.style.left = `${item.x}%`;
    element.style.top = `${item.y}%`;
  } else {
    item.width = Math.min(24, Math.max(5, initial.width + deltaX * 2));
    item.height = Math.min(24, Math.max(5, initial.height + deltaY * 2));
    element.style.width = `${item.width}%`;
    element.style.height = `${item.height}%`;
  }
}

function handleMapPointerUp(event) {
  if (!mapPointerAction || mapPointerAction.pointerId !== event.pointerId) return;
  mapPointerAction.element.releasePointerCapture?.(event.pointerId);
  mapPointerAction = null;
  renderMapEditor();
}

function tableReservationsFor(eventId) { return state.sales.filter((sale) => sale.eventId === eventId && isTableReservation(sale)); }

function renderTableMapPanel(event, eventSales) {
  const panel = $("tableMapPanel");
  const tableMap = migrateFurnitureToPreset(event?.tableMap);
  const visible = Boolean(event && eventUsesTableMap(event));
  panel.hidden = !visible;
  if (!visible) return;
  if (!tableMap.areas.includes(activeMapViewerArea)) activeMapViewerArea = tableMap.areas[0];
  $("tableMapAreaTabs").innerHTML = tableMap.areas.map((area) => `<button class="${area === activeMapViewerArea ? "is-active" : ""}" type="button" data-view-map-area="${area}" role="tab" aria-selected="${area === activeMapViewerArea}">${mapAreaLabel(area)}</button>`).join("");
  const reservations = eventSales.filter(isTableReservation);
  const stage = $("tableMapViewer");
  stage.dataset.area = activeMapViewerArea;
  const furniture = tableMap.furniture.filter((item) => item.area === activeMapViewerArea);
  stage.innerHTML = furniture.map((item) => mapFurnitureHtml(item, false, reservations.find((sale) => sale.furnitureId === item.id))).join("") || `<div class="map-empty-hint">Nenhuma mesa ou bistrô configurado nesta área.</div>`;
  const occupied = furniture.filter((item) => reservations.some((sale) => sale.furnitureId === item.id)).length;
  const paid = furniture.filter((item) => reservations.some((sale) => sale.furnitureId === item.id && sale.paid)).length;
  $("tableMapSummary").innerHTML = `<span>${furniture.length} móveis</span><span>${occupied} reservados</span><span>${Math.max(0, furniture.length - occupied)} livres</span><span>${paid} pagos</span>`;
  renderMapZoom(event, eventSales);
}

function renderMapZoom(event, eventSales) {
  if (!event || !eventUsesTableMap(event)) return;
  const tableMap = migrateFurnitureToPreset(event.tableMap);
  if (!tableMap.areas.includes(activeMapViewerArea)) activeMapViewerArea = tableMap.areas[0];
  $("mapZoomTitle").textContent = `Mapa de ${event.name}`;
  $("tableMapZoomAreaTabs").innerHTML = tableMap.areas.map((area) => `<button class="${area === activeMapViewerArea ? "is-active" : ""}" type="button" data-zoom-map-area="${area}" role="tab" aria-selected="${area === activeMapViewerArea}">${mapAreaLabel(area)}</button>`).join("");
  const reservations = eventSales.filter(isTableReservation);
  const stage = $("tableMapZoomViewer");
  stage.dataset.area = activeMapViewerArea;
  const furniture = tableMap.furniture.filter((item) => item.area === activeMapViewerArea);
  stage.innerHTML = furniture.map((item) => mapFurnitureHtml(item, false, reservations.find((sale) => sale.furnitureId === item.id))).join("") || `<div class="map-empty-hint">Nenhuma mesa ou bistrô configurado nesta área.</div>`;
}

function renderTableReservationsList(event, eventSales) {
  const panel = $("tableReservationsPanel");
  const visible = Boolean(event && eventUsesTableMap(event));
  panel.hidden = !visible;
  if (!visible) return;
  $("tableReservationSearch").value = tableReservationSearchQuery;
  $("tableReservationAreaFilter").value = tableReservationAreaFilter;
  $("tableReservationPaymentFilter").value = tableReservationPaymentFilter;
  const allReservations = eventSales.filter(isTableReservation).sort((a, b) => String(a.reservationLabel || "").localeCompare(String(b.reservationLabel || ""), "pt-BR", { numeric: true }));
  const reservations = allReservations.filter(matchesTableReservationFilters);
  const filteredPeople = reservations.reduce((sum, sale) => sum + saleQuantity(sale, event), 0);
  const filterCount = Number(tableReservationAreaFilter !== "all") + Number(tableReservationPaymentFilter !== "all");
  const filterLabel = tableReservationPaymentFilter === "paid" ? "Pago" : tableReservationPaymentFilter === "pending" ? "Pendente" : tableReservationAreaFilter === "salao" ? "Salão" : tableReservationAreaFilter === "mezanino" ? "Mezanino" : "Todos";
  $("tableReservationFilterLabel").textContent = filterCount > 1 ? `${filterCount} filtros` : filterLabel;
  $("tableReservationCount").textContent = `${reservations.length} ${reservations.length === 1 ? "reservada" : "reservadas"} • ${filteredPeople} ${filteredPeople === 1 ? "pessoa" : "pessoas"}`;
  $("clearTableReservationSearch").hidden = !tableReservationSearchQuery;
  const canManage = hasRole("admin", "seller");
  $("tableReservationsList").innerHTML = reservations.length ? reservations.map((sale) => {
    const occupants = Array.isArray(sale.occupants) ? sale.occupants : Object.values(sale.occupants || {});
    const payment = sale.paid ? `<span class="payment paid">✓ Pago</span>${paymentDetailsHtml(sale)}` : `<span class="payment">Pendente</span>`;
    const actions = canManage ? `<button class="delete-button table-reservation-delete" type="button" data-delete-sale="${sale.id}">Excluir</button>` : "";
    const peopleCount = occupants.length || sale.quantity || 1;
    const details = `<div class="table-reservation-expanded"><div><small>Mesa / bistrô</small><strong>${escapeHtml(sale.reservationLabel || "Reserva")}</strong></div><div><small>Responsável</small><strong>${escapeHtml(sale.buyerName || "Sem responsável")}</strong></div><div><small>Quantidade de pessoas</small><strong>${peopleCount} ${peopleCount === 1 ? "pessoa" : "pessoas"}</strong></div><div class="table-reservation-expanded-contact"><small>Contato</small><span>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Não informado")}</span>${whatsappButtonHtml(sale, event.name)}</div><div><small>Ocupantes</small><span>${escapeHtml(occupants.join(", ") || "Nenhum ocupante informado")}</span></div><div><small>Pagamento</small>${payment}</div><div class="table-reservation-expanded-actions"><button class="edit-button" type="button" data-open-table-reservation="${sale.furnitureId}">Editar</button>${actions}</div></div>`;
    return `<article class="table-reservation-card" aria-expanded="false"><div class="table-reservation-main"><strong>${escapeHtml(sale.buyerName || "Sem responsável")}</strong><small>${escapeHtml(sale.reservationLabel || "Reserva")} · ${peopleCount} ${peopleCount === 1 ? "pessoa" : "pessoas"}</small></div><div class="table-reservation-total"><strong>${money.format(saleTotal(sale, event))}</strong></div><div class="table-reservation-contact">${whatsappButtonHtml(sale, event.name)}</div><div class="table-reservation-payment">${payment}</div><button class="participant-detail-toggle" type="button" data-toggle-table-reservation-details>Detalhar</button>${details}</article>`;
  }).join("") : `<div class="empty">${tableReservationSearchQuery ? "Nenhuma reserva encontrada." : "Nenhuma reserva registrada neste evento."}</div>`;
  const totalAllReservations = allReservations.reduce((sum, sale) => sum + saleTotal(sale, event), 0);
  const paymentForTableReservation = (sale) => sale.paid ? `<span class="payment paid">✓ Pago</span>${paymentDetailsHtml(sale)}` : `<span class="payment">Pendente</span>`;
  $("allTableReservationsTitle").textContent = `Reservas — ${event.name}`;
  $("allTableReservationsTotal").textContent = money.format(totalAllReservations);
  $("allTableReservationsList").innerHTML = allReservations.length ? allReservations.map((sale) => { const occupants = Array.isArray(sale.occupants) ? sale.occupants : Object.values(sale.occupants || {}); return `<tr class="sales-row table-reservation-all-row"><td data-label="Responsável"><strong>${escapeHtml(sale.buyerName || "Sem responsável")}</strong><small>${occupants.length || sale.quantity || 1} pessoas</small></td><td data-label="Mesa / bistrô"><strong>${escapeHtml(sale.reservationLabel || "Reserva")}</strong><small>${escapeHtml(mapAreaLabel(sale.reservationArea || ""))}</small></td><td class="sale-note" data-label="Contato / ocupantes"><span class="phone-line"><strong>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Não informado")}</strong>${whatsappButtonHtml(sale, event.name)}</span><small>${escapeHtml(occupants.join(", "))}</small></td><td data-label="Evento">${escapeHtml(event.name)}</td><td class="financial-column" data-label="Valor">${money.format(saleTotal(sale, event))}</td><td class="financial-column" data-label="Pagamento">${paymentForTableReservation(sale)}</td><td data-label="Ações"><button class="edit-button" type="button" data-open-table-reservation="${sale.furnitureId}">Editar</button>${canManage ? `<button class="delete-button" data-delete-sale="${sale.id}">Excluir</button>` : ""}</td></tr>`; }).join("") : `<tr><td colspan="7" class="empty">Nenhuma reserva neste evento.</td></tr>`;
}

function addTableOccupantRow(name = "") {
  const row = document.createElement("div");
  row.className = "table-occupant-row";
  row.innerHTML = `<input class="table-occupant-name" required placeholder="Nome do participante" value="${escapeHtml(name)}" /><button class="close" type="button" data-remove-table-occupant aria-label="Remover participante">×</button>`;
  $("tableOccupantsList").append(row);
  updateTableReservationTotal();
}

function tableReservationNames() {
  const responsible = String($("tableReservationForm").elements.buyerName.value || "").trim();
  const others = [...document.querySelectorAll(".table-occupant-name")].map((input) => input.value.trim()).filter(Boolean);
  return [responsible, ...others].filter(Boolean);
}

function updateTableReservationTotal() {
  const form = $("tableReservationForm");
  const event = state.events.find((item) => item.id === form.elements.eventId.value);
  const people = Math.max(1, 1 + document.querySelectorAll(".table-occupant-row").length);
  const chairPrice = Math.max(0, Number(event?.chairPrice || 0));
  $("tableReservationPeople").textContent = people;
  $("tableReservationUnitPrice").textContent = money.format(chairPrice);
  $("tableReservationTotal").textContent = money.format(people * chairPrice);
}

function syncTableReservationPaymentFields(useToday = false) {
  const form = $("tableReservationForm");
  const paid = form.elements.paymentStatus.value === "paid";
  form.elements.paymentMethod.disabled = !paid;
  form.elements.paymentDate.disabled = !paid;
  form.elements.paymentMethod.required = paid;
  form.elements.paymentDate.required = paid;
  form.classList.toggle("payment-is-pending", !paid);
  if (!paid) { form.elements.paymentMethod.value = ""; form.elements.paymentDate.value = ""; }
  else if (useToday && !form.elements.paymentDate.value) form.elements.paymentDate.value = todayInputValue();
}

function openTableReservation(furnitureId) {
  if ($("allSalesModal").open) $("allSalesModal").close();
  if ($("allTableReservationsModal").open) $("allTableReservationsModal").close();
  if (!requireRole(["admin", "seller"], "Seu perfil permite consultar o mapa, mas não alterar reservas.")) return;
  const event = state.events.find((item) => item.id === selectedEventId);
  const furniture = normalizeTableMap(event?.tableMap).furniture.find((item) => item.id === furnitureId);
  if (!event || !furniture) return toast("Mesa ou bistrô não encontrado.");
  const reservation = tableReservationsFor(event.id).find((sale) => sale.furnitureId === furnitureId);
  const form = $("tableReservationForm");
  form.reset();
  form.elements.eventId.value = event.id;
  form.elements.furnitureId.value = furniture.id;
  form.elements.saleId.value = reservation?.id || "";
  form.elements.buyerName.value = reservation?.buyerName || "";
  form.elements.buyerPhone.value = reservation?.buyerPhone || "";
  form.elements.buyerEmail.value = reservation?.buyerEmail || "";
  form.elements.paymentStatus.value = reservation?.paid ? "paid" : "pending";
  form.elements.paymentMethod.value = reservation?.paymentMethod || "";
  form.elements.paymentDate.value = reservation?.paymentDate || "";
  form.elements.notes.value = reservation?.notes || "";
  $("tableOccupantsList").innerHTML = "";
  (reservation?.occupants || []).slice(1).forEach((name) => addTableOccupantRow(name));
  $("tableReservationTitle").textContent = `${furnitureKindLabel(furniture.kind)} ${String(furniture.number).padStart(2, "0")}`;
  $("tableReservationArea").textContent = `${mapAreaLabel(furniture.area)} · ${money.format(Number(event.chairPrice || 0))} por pessoa`;
  $("deleteTableReservation").hidden = !reservation;
  syncTableReservationPaymentFields(!reservation);
  updateTableReservationTotal();
  $("tableReservationModal").showModal();
}

async function saveTableReservation(data) {
  if (!hasRole("admin", "seller")) throw new Error("Seu perfil não permite criar ou editar reservas.");
  const event = state.events.find((item) => item.id === data.eventId);
  const furniture = normalizeTableMap(event?.tableMap).furniture.find((item) => item.id === data.furnitureId);
  if (!event || !furniture) throw new Error("Mesa ou bistrô não encontrado.");
  const names = tableReservationNames();
  if (!names[0]) throw new Error("Informe o nome do responsável.");
  if (!String(data.buyerPhone || "").trim()) throw new Error("Informe o telefone do responsável.");
  const current = state.sales.find((sale) => sale.id === data.saleId);
  const occupiedByAnother = tableReservationsFor(event.id).find((sale) => sale.furnitureId === furniture.id && sale.id !== data.saleId);
  if (occupiedByAnother) throw new Error("Esta mesa já possui uma reserva.");
  const chairPrice = Math.max(0, Number(event.chairPrice || 0));
  const quantity = names.length;
  const total = chairPrice * quantity;
  const paid = data.paymentStatus === "paid";
  const paymentMethod = paid ? String(data.paymentMethod || "") : "";
  const paymentDate = paid ? String(data.paymentDate || "") : "";
  if (paid && !PAYMENT_METHOD_LABELS[paymentMethod]) throw new Error("Selecione a forma de pagamento.");
  if (paid && !paymentDate) throw new Error("Informe a data do pagamento.");
  const timestamp = isDemo ? Date.now() : serverTimestamp();
  const label = `${furnitureKindLabel(furniture.kind)} ${String(furniture.number).padStart(2, "0")} — ${mapAreaLabel(furniture.area)}`;
  const items = [{ kind: "ticket", ticketTypeId: `chair:${furniture.area}`, ticketTypeName: `Cadeira — ${mapAreaLabel(furniture.area)}`, unitPrice: chairPrice, quantity, subtotal: total }];
  const saleData = { eventId: event.id, reservationType: "table", furnitureId: furniture.id, furnitureKind: furniture.kind, furnitureNumber: furniture.number, mapArea: furniture.area, reservationLabel: label, occupants: names, ticketTypeId: `chair:${furniture.area}`, ticketTypeName: `Cadeira — ${mapAreaLabel(furniture.area)}`, items, buyerName: names[0], buyerPhone: String(data.buyerPhone || "").trim(), buyerEmail: String(data.buyerEmail || "").trim(), notes: String(data.notes || "").trim(), courtesy: false, paid, paymentMethod, paymentDate, quantity, total, checkedIn: current?.checkedIn || false, updatedAt: timestamp };
  if (isDemo) {
    if (current) {
      const updated = { ...current, ...saleData };
      state.sales = state.sales.map((sale) => sale.id === current.id ? updated : sale);
      appendDemoAudit("edited", updated, `Atualizou a reserva da ${label} para ${quantity} pessoas.`);
    } else {
      const created = { id: crypto.randomUUID(), ...saleData, createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp };
      state.sales.push(created);
      appendDemoAudit("created", created, `Criou a reserva da ${label} para ${quantity} pessoas.`);
    }
    persistDemo();
    render();
  } else {
    const saleId = current?.id || push(ref(db, "sales")).key;
    const stored = { ...current, id: saleId, ...saleData };
    if (!current) Object.assign(stored, { createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp });
    const logId = push(ref(db, "auditLogs")).key;
    const action = current ? "edited" : "created";
    await update(ref(db), { [`sales/${saleId}`]: Object.fromEntries(Object.entries(stored).filter(([key]) => key !== "id")), [`auditLogs/${logId}`]: auditLogData(action, stored, `${current ? "Atualizou" : "Criou"} a reserva da ${label} para ${quantity} pessoas.`, timestamp) });
  }
  toast(current ? "Reserva atualizada." : "Reserva criada.");
}

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
function renderSellerClosing(eventSales, event) {
  const start = $("sellerClosingStart").value;
  const end = $("sellerClosingEnd").value;
  const periodSales = eventSales.filter((sale) => { const date = saleCreatedDate(sale); return (!start || (date && date >= start)) && (!end || (date && date <= end)); });
  const groups = new Map();
  const sellerTicketGroups = new Map();
  const ticketTypes = event ? ticketTypesFor(event) : [];
  periodSales.forEach((sale) => {
    const seller = sellerForSale(sale);
    const current = groups.get(seller.id) || { ...seller, sales: 0, tickets: 0, total: 0, received: 0, pending: 0 };
    current.sales += 1;
    current.tickets += saleQuantity(sale);
    current.total += saleTotal(sale);
    if (sale.paid) current.received += saleTotal(sale); else current.pending += saleTotal(sale);
    groups.set(seller.id, current);
    ticketTypes.forEach((type) => {
      const quantity = saleTypeQuantity(sale, type, event);
      if (!quantity) return;
      const total = saleTypeTotal(sale, type, event);
      const key = `${seller.id}::${type.id}`;
      const typeRow = sellerTicketGroups.get(key) || { ...seller, ticketTypeId: type.id, ticketTypeName: type.name, sales: 0, tickets: 0, total: 0, received: 0, pending: 0 };
      typeRow.sales += 1;
      typeRow.tickets += quantity;
      typeRow.total += total;
      if (sale.paid) typeRow.received += total; else typeRow.pending += total;
      sellerTicketGroups.set(key, typeRow);
    });
    if (isTableReservation(sale)) {
      const quantity = saleQuantity(sale, event);
      const total = saleTotal(sale, event);
      const typeId = `chair:${sale.mapArea || "salao"}`;
      const typeName = `Cadeira — ${mapAreaLabel(sale.mapArea)}`;
      const key = `${seller.id}::${typeId}`;
      const typeRow = sellerTicketGroups.get(key) || { ...seller, ticketTypeId: typeId, ticketTypeName: typeName, sales: 0, tickets: 0, total: 0, received: 0, pending: 0 };
      typeRow.sales += 1;
      typeRow.tickets += quantity;
      typeRow.total += total;
      if (sale.paid) typeRow.received += total; else typeRow.pending += total;
      sellerTicketGroups.set(key, typeRow);
    }
  });
  const rows = [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  const totals = rows.reduce((sum, row) => ({ sales: sum.sales + row.sales, tickets: sum.tickets + row.tickets, total: sum.total + row.total, received: sum.received + row.received, pending: sum.pending + row.pending }), { sales: 0, tickets: 0, total: 0, received: 0, pending: 0 });
  $("sellerClosingPeriodLabel").textContent = start || end ? `${start ? paymentDateLabel(start) : "Início"} até ${end ? paymentDateLabel(end) : "hoje"}` : "Todo o evento";
  $("sellerClosingBreakdown").innerHTML = rows.length ? `${rows.map((row) => `<tr><td data-label="Vendedor"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email)}</small></td><td data-label="Vendas">${row.sales}</td><td data-label="Ingressos">${row.tickets}</td><td data-label="Total vendido">${money.format(row.total)}</td><td data-label="Recebido">${money.format(row.received)}</td><td data-label="Pendente">${money.format(row.pending)}</td></tr>`).join("")}<tr class="seller-closing-total"><td data-label="Vendedor"><strong>Total do período</strong></td><td data-label="Vendas">${totals.sales}</td><td data-label="Ingressos">${totals.tickets}</td><td data-label="Total vendido">${money.format(totals.total)}</td><td data-label="Recebido">${money.format(totals.received)}</td><td data-label="Pendente">${money.format(totals.pending)}</td></tr>` : `<tr><td class="financial-empty" colspan="6">Nenhuma venda registrada neste período.</td></tr>`;
  const sellerTicketRows = [...sellerTicketGroups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || b.tickets - a.tickets || a.ticketTypeName.localeCompare(b.ticketTypeName, "pt-BR"));
  $("sellerTicketBreakdown").innerHTML = sellerTicketRows.length ? sellerTicketRows.map((row) => `<tr><td data-label="Vendedor"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email)}</small></td><td data-label="Tipo de ingresso">${escapeHtml(row.ticketTypeName)}</td><td data-label="Vendas">${row.sales}</td><td data-label="Ingressos">${row.tickets}</td><td data-label="Total">${money.format(row.total)}</td><td data-label="Recebido">${money.format(row.received)}</td><td data-label="Pendente">${money.format(row.pending)}</td></tr>`).join("") : `<tr><td class="financial-empty" colspan="7">Nenhum ingresso vendido por vendedores neste período.</td></tr>`;
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
    const capacity = Number(type.capacity || 0);
    const available = Math.max(0, capacity - quantity);
    const occupancy = capacity ? Math.min(100, Math.round(quantity / capacity * 100)) : 0;
    return `<tr><td data-label="Tipo de ingresso">${escapeHtml(type.name)}</td><td data-label="Vendas">${typeSales.length}</td><td data-label="Vendidos">${quantity}</td><td data-label="Disponíveis">${available}</td><td data-label="Ocupação"><span class="occupancy-value">${occupancy}%</span></td><td data-label="Total">${money.format(total)}</td><td data-label="Recebido">${money.format(received)}</td><td data-label="Pendente">${money.format(total - received)}</td></tr>`;
  }).join("") : `<tr><td class="financial-empty" colspan="8">Nenhum tipo de ingresso disponível.</td></tr>`;
  const tableReservations = eventSales.filter(isTableReservation);
  if (tableReservations.length) {
    const reservationPeople = tableReservations.reduce((sum, sale) => sum + saleQuantity(sale, event), 0);
    const reservationTotal = tableReservations.reduce((sum, sale) => sum + saleTotal(sale, event), 0);
    const reservationReceived = tableReservations.filter((sale) => sale.paid).reduce((sum, sale) => sum + saleTotal(sale, event), 0);
    $("financialTicketBreakdown").insertAdjacentHTML("beforeend", `<tr><td data-label="Tipo de ingresso">Reservas de mesas/bistrôs</td><td data-label="Vendas">${tableReservations.length}</td><td data-label="Vendidos">${reservationPeople}</td><td data-label="Disponíveis">—</td><td data-label="Ocupação"><span class="occupancy-value">Mapa</span></td><td data-label="Total">${money.format(reservationTotal)}</td><td data-label="Recebido">${money.format(reservationReceived)}</td><td data-label="Pendente">${money.format(reservationTotal - reservationReceived)}</td></tr>`);
  }
  renderSellerClosing(eventSales, event);
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
  const unitSales = selectedSales.filter((sale) => !isTableReservation(sale));
  const tableReservations = selectedSales.filter(isTableReservation);
  const tablePeople = tableReservations.reduce((sum, sale) => sum + saleQuantity(sale, selectedEvent), 0);
  const availableTicketTypes = selectedEvent ? ticketTypesFor(selectedEvent) : [];
  if (selectedTicketTypeFilter !== "all" && !availableTicketTypes.some((type) => type.id === selectedTicketTypeFilter)) selectedTicketTypeFilter = "all";
  const selectedTypeName = availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter)?.name;
  const visibleSales = unitSales.filter((sale) => {
    const matchesTicketType = selectedTicketTypeFilter === "all" || saleItems(sale, selectedEvent).some((item) => item.ticketTypeId === selectedTicketTypeFilter || item.ticketTypeName === selectedTypeName);
    const matchesPayment = selectedPaymentFilter === "all" || (selectedPaymentFilter === "paid" ? sale.paid : !sale.paid);
    const matchesEntry = selectedEntryFilter === "all" || (selectedEntryFilter === "checked" ? sale.checkedIn : !sale.checkedIn);
    return matchesTicketType && matchesPayment && matchesEntry && matchesParticipantSearch(sale);
  });
  const filteredTicketType = availableTicketTypes.find((type) => type.id === selectedTicketTypeFilter);
  const visibleSold = visibleSales.reduce((sum, sale) => sum + (filteredTicketType ? saleTypeQuantity(sale, filteredTicketType, selectedEvent) : saleQuantity(sale, selectedEvent)), 0);
  const visibleSalesTotal = visibleSales.reduce((sum, sale) => sum + (filteredTicketType ? saleTypeTotal(sale, filteredTicketType, selectedEvent) : saleTotal(sale, selectedEvent)), 0);
  const sold = availableTicketTypes.reduce((total, type) => total + unitSales.reduce((sum, sale) => sum + saleTypeQuantity(sale, type, selectedEvent), 0), 0);
  const visibleAvailable = filteredTicketType ? Math.max(0, Number(filteredTicketType.capacity || 0) - soldForTicket(selectedEventId, filteredTicketType)) : Math.max(0, eventCapacity(selectedEvent) - sold);
  const revenuePaid = selectedSales.filter((sale) => sale.paid).reduce((sum, sale) => sum + saleTotal(sale, selectedEvent), 0);
  const revenuePending = selectedSales.filter((sale) => !sale.paid).reduce((sum, sale) => sum + saleTotal(sale, selectedEvent), 0);
  const revenueTotal = revenuePaid + revenuePending;
  const checkins = unitSales.filter((sale) => sale.checkedIn).reduce((sum, sale) => sum + saleQuantity(sale, selectedEvent), 0);
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
  $("filterCount").textContent = `${visibleSold} ${visibleSold === 1 ? "vendido" : "vendidos"} • ${visibleAvailable} ${visibleAvailable === 1 ? "disponível" : "disponíveis"}`;
  const allSalesModalTotal = visibleSalesTotal + tableReservations.reduce((sum, sale) => sum + saleTotal(sale, selectedEvent), 0);
  $("allSalesTotalLabel").textContent = participantSearchQuery || activeFilterCount ? "Total vendido — participantes filtrados + reservas" : "Total vendido — participantes e reservas";
  $("allSalesTotal").textContent = money.format(allSalesModalTotal);
  $("revenue").textContent = money.format(revenueTotal); $("revenuePaid").textContent = money.format(revenuePaid); $("revenuePending").textContent = money.format(revenuePending); $("sold").textContent = sold; $("available").textContent = Math.max(0, eventCapacity(selectedEvent) - sold); $("checkins").textContent = checkins;
  $("tableSalesMetric").hidden = !tableReservations.length;
  $("tableSalesMetric").textContent = tableReservations.length ? `+ ${tablePeople} em ${tableReservations.length} ${tableReservations.length === 1 ? "mesa/bistrô" : "mesas/bistrôs"}` : "";
  $("ticketStockBreakdown").innerHTML = `${availableTicketTypes.map((type) => {
    const typeSold = selectedSales.reduce((sum, sale) => sum + saleTypeQuantity(sale, type, selectedEvent), 0);
    const typeAvailable = Math.max(0, Number(type.capacity || 0) - typeSold);
    return `<div class="ticket-stock-row"><strong title="${escapeHtml(type.name)}">${escapeHtml(type.name)}</strong><span><b>${typeSold}</b> ${typeSold === 1 ? "vendido" : "vendidos"} <i aria-hidden="true">•</i> <b>${typeAvailable}</b> ${typeAvailable === 1 ? "disponível" : "disponíveis"}</span></div>`;
  }).join("")}${tableReservations.length ? `<div class="ticket-stock-row table-stock-row"><strong>Mesas/bistrôs</strong><span><b>${tableReservations.length}</b> reservas <i aria-hidden="true">•</i> <b>${tablePeople}</b> pessoas</span></div>` : ""}`;
  $("ticketCheckinBreakdown").innerHTML = availableTicketTypes.map((type) => {
    const typeSold = selectedSales.reduce((sum, sale) => sum + saleTypeQuantity(sale, type, selectedEvent), 0);
    const typeCheckins = selectedSales.filter((sale) => sale.checkedIn).reduce((sum, sale) => sum + saleTypeQuantity(sale, type, selectedEvent), 0);
    const typeWaiting = Math.max(0, typeSold - typeCheckins);
    return `<div class="ticket-stock-row"><strong title="${escapeHtml(type.name)}">${escapeHtml(type.name)}</strong><span><b>${typeCheckins}</b> check-in${typeCheckins === 1 ? "" : "s"} <i aria-hidden="true">•</i> <b>${typeWaiting}</b> aguardando</span></div>`;
  }).join("");
  renderFinancialReport(hasRole("admin") ? selectedEvent : undefined, hasRole("admin") ? selectedSales : []);
  renderTableMapPanel(selectedEvent, selectedSales);
  renderTableReservationsList(selectedEvent, selectedSales);
  if (selectedEvent) { $("selectedEventName").textContent = selectedEvent.name; $("selectedEventMeta").textContent = hasRole("door") ? `${selectedEvent.place} · ${dateText(selectedEvent.date)}` : `${selectedEvent.place} · ${dateText(selectedEvent.date)} · ${priceLabel(selectedEvent)}`; $("salesPanelTitle").textContent = `Vendas de ${selectedEvent.name}`; $("allSalesTitle").textContent = `${eventUsesTableMap(selectedEvent) ? "Vendas e reservas" : "Participantes"} — ${selectedEvent.name}`; }
  $("eventsList").innerHTML = events.length ? events.map((event) => {
    const eventSold = sales.filter((sale) => sale.eventId === event.id && !isTableReservation(sale)).reduce((sum, sale) => sum + saleQuantity(sale, event), 0);
    const deleteControl = hasRole("admin") ? `<button class="event-card-delete" type="button" data-delete-event="${event.id}" aria-label="Excluir o evento ${escapeHtml(event.name)}" title="Excluir evento">Excluir</button>` : "";
    return `<div class="event-card ${event.id === selectedEventId ? "is-selected" : ""}" data-select-event="${event.id}" role="button" tabindex="0" aria-pressed="${event.id === selectedEventId}"><span class="calendar"><b>${new Date(`${event.date}T12:00:00`).getDate()}</b><small>${new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span><span class="event-info"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(event.place)}${hasRole("door") ? "" : ` · ${priceLabel(event)}`}</small>${eventUsesTableMap(event) ? `<span class="event-card-mode">Mesas + unitários</span>` : ""}</span><span class="event-card-tools"><span class="event-count">${eventSold}/${eventCapacity(event)}</span>${deleteControl}</span></div>`;
  }).join("") : `<div class="empty">Nenhum evento cadastrado ainda.</div>`;
  const canManageSales = hasRole("admin", "seller");
  const paymentControl = (sale) => { const courtesy = saleIsCourtesy(sale, selectedEvent) || sale.courtesy; return `<span class="payment-display">${courtesy ? `<span class="payment paid courtesy-payment">Cortesia</span>` : canManageSales ? `<button class="payment ${sale.paid ? "paid" : ""}" data-paid="${sale.id}">${sale.paid ? "✓ Pago" : "Pendente"}</button>` : `<span class="payment ${sale.paid ? "paid" : ""}">${sale.paid ? "✓ Pago" : "Pendente"}</span>`}${paymentDetailsHtml(sale)}</span>`; };
  const checkinControl = (sale) => `<button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button>`;
  const actionControl = (sale) => canManageSales ? `<button class="delete-button" data-delete-sale="${sale.id}">Excluir</button>` : `<span class="role-readonly">Somente consulta</span>`;
  $("salesList").innerHTML = visibleSales.length ? visibleSales.map((sale) => { const quantity = saleQuantity(sale, selectedEvent); const total = saleTotal(sale, selectedEvent); return `<tr class="sales-row" data-sale-row="${sale.id}" aria-expanded="false"><td><span class="desktop-participant-content"><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small>${participantContactHtml(sale, selectedEvent?.name)}</span><span class="mobile-card-overview"><span class="mobile-overview-participant"><small class="mobile-field-label">Participante</small><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small></span><span class="mobile-overview-value mobile-financial"><small class="mobile-field-label">Valor</small><strong>${money.format(total)}</strong></span><span class="mobile-overview-contact"><span>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Sem telefone")}</span>${whatsappButtonHtml(sale, selectedEvent?.name)}</span><span class="mobile-overview-payment mobile-financial"><small class="mobile-field-label">Pagamento</small>${paymentControl(sale)}</span><span class="mobile-overview-entry"><small class="mobile-field-label">Entrada</small>${checkinControl(sale)}</span><button class="participant-detail-toggle" type="button" data-toggle-sale-details>Detalhar</button></span></td><td>${saleTicketBreakdownHtml(sale, selectedEvent)}</td><td class="sale-observation">${escapeHtml(sale.notes || "Sem observação")}</td><td class="financial-column mobile-detail-original">${money.format(total)}</td><td class="financial-column mobile-detail-original">${paymentControl(sale)}</td><td class="mobile-detail-original">${checkinControl(sale)}</td><td>${actionControl(sale)}</td></tr>`; }).join("") : `<tr><td colspan="7" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhuma venda neste evento."}</td></tr>`;
  $("allSalesList").innerHTML = visibleSales.length ? visibleSales.map((sale) => { const quantity = saleQuantity(sale, selectedEvent); const rowTotal = filteredTicketType ? saleTypeTotal(sale, filteredTicketType, selectedEvent) : saleTotal(sale, selectedEvent); return `<tr class="sales-row" data-sale-row="${sale.id}"><td><strong>${escapeHtml(sale.buyerName)}</strong><small>${quantity} ingresso${quantity > 1 ? "s" : ""}</small></td><td>${saleTicketBreakdownHtml(sale, selectedEvent)}</td><td class="sale-note"><span class="phone-line"><strong>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Não informado")}</strong>${whatsappButtonHtml(sale, selectedEvent?.name)}</span>${sale.notes ? `<small>${escapeHtml(sale.notes)}</small>` : ""}</td><td>${escapeHtml(selectedEvent?.name || "Evento removido")}</td><td class="financial-column">${money.format(rowTotal)}</td><td class="financial-column">${paymentControl(sale)}</td><td><button class="status ${sale.checkedIn ? "checked" : ""}" data-checkin="${sale.id}">${sale.checkedIn ? "✓ Check-in" : "Fazer check-in"}</button></td><td>${actionControl(sale)}</td></tr>`; }).join("") : `<tr><td colspan="8" class="empty">${participantSearchQuery || activeFilterCount ? "Nenhum participante encontrado com esses filtros." : "Nenhum participante neste evento."}</td></tr>`;
  if (tableReservations.length) {
    const reservationRows = tableReservations.map((sale) => { const occupants = Array.isArray(sale.occupants) ? sale.occupants : Object.values(sale.occupants || {}); return `<tr class="table-reservation-all-row"><td><strong>${escapeHtml(sale.buyerName || "Sem responsável")}</strong><small>${occupants.length || sale.quantity || 1} pessoas</small></td><td><strong>${escapeHtml(sale.reservationLabel || "Reserva")}</strong><small>${escapeHtml(mapAreaLabel(sale.reservationArea || ""))}</small></td><td class="sale-note"><span class="phone-line"><strong>${escapeHtml(formatPhoneDisplay(sale.buyerPhone) || "Não informado")}</strong>${whatsappButtonHtml(sale, selectedEvent?.name)}</span><small>${escapeHtml(occupants.join(", "))}</small></td><td>${escapeHtml(selectedEvent?.name || "Evento removido")}</td><td class="financial-column">${money.format(saleTotal(sale, selectedEvent))}</td><td class="financial-column">${paymentControl(sale)}</td><td><span class="role-readonly">Reserva</span></td><td><button class="edit-button" type="button" data-open-table-reservation="${sale.furnitureId}">Detalhar</button>${canManageSales ? `<button class="delete-button" data-delete-sale="${sale.id}">Excluir</button>` : ""}</td></tr>`; }).join("");
    if (visibleSales.length) $("allSalesList").insertAdjacentHTML("beforeend", reservationRows); else $("allSalesList").innerHTML = reservationRows;
  }
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
    if (removedPackageWithSales) throw new Error(`Não é possível remover “${removedPackageWithSales.packageName}” porque esse pacote ou cortesia já foi lançado.`);
    for (const type of data.ticketTypes) {
      const alreadySold = soldForTicket(id, type);
      if (alreadySold > type.capacity) throw new Error(`O tipo “${type.name}” já possui ${alreadySold} vendidos. Informe uma quantidade igual ou maior.`);
    }
    const reservedFurniture = eventSales.filter(isTableReservation);
    const keptFurnitureIds = new Set((data.tableMap?.furniture || []).map((item) => item.id));
    const removedReservedFurniture = reservedFurniture.find((sale) => !keptFurnitureIds.has(sale.furnitureId));
    if (removedReservedFurniture) throw new Error(`Não é possível remover ${removedReservedFurniture.reservationLabel || "uma mesa"} porque ela já possui reserva.`);
  }
  const capacity = data.ticketTypes.reduce((sum, item) => sum + Number(item.capacity), 0);
  const eventMode = data.eventMode === "mixed" ? "mixed" : "unit";
  const tableMap = eventMode === "mixed" ? normalizeTableMap(data.tableMap) : { areas: [], furniture: [] };
  const chairPrice = eventMode === "mixed" ? Math.max(0, Number(data.chairPrice || 0)) : 0;
  if (eventMode === "mixed" && !tableMap.areas.length) throw new Error("Selecione Salão, Mezanino ou ambos.");
  if (eventMode === "mixed" && !tableMap.furniture.length) throw new Error("Adicione pelo menos uma mesa ou bistrô ao mapa.");
  const eventData = { name: data.name.trim(), date: data.date, place: data.place.trim(), eventMode, chairPrice, tableMap, capacity, ticketTypes: data.ticketTypes, packages: data.packages || [], updatedAt: Date.now() };
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
    if (!ticketType) throw new Error("Um dos ingressos do pacote ou cortesia não está mais disponível neste evento.");
    const soldForType = soldForTicket(event.id, ticketType, id);
    const remaining = Math.max(0, Number(ticketType.capacity) - soldForType);
    if (requested.quantity > remaining) throw new Error(`Restam apenas ${remaining} ingressos do tipo “${ticketType.name}”. Esta venda precisa de ${requested.quantity}.`);
  }
  const quantity = requestedStock.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const primaryTicket = items[0];
  const current = state.sales.find((sale) => sale.id === id);
  const courtesy = Boolean(items.length && items.every((item) => item.kind === "package" && item.packageKind === "courtesy") && total === 0);
  const paid = courtesy || data.paymentStatus === "paid";
  const paymentMethod = courtesy ? "courtesy" : paid ? String(data.paymentMethod || "") : "";
  const paymentDate = courtesy ? "" : paid ? String(data.paymentDate || "") : "";
  if (paid && !courtesy && !PAYMENT_METHOD_LABELS[paymentMethod]) throw new Error("Selecione a forma de pagamento.");
  if (paid && !courtesy && !paymentDate) throw new Error("Informe a data do pagamento.");
  const timestamp = isDemo ? Date.now() : serverTimestamp();
  const saleData = { eventId: event.id, ticketTypeId: items.length === 1 ? primaryTicket.ticketTypeId : "multiple", ticketTypeName: items.length === 1 ? primaryTicket.ticketTypeName : "Vários ingressos", items, buyerName: String(data.buyerName || "").trim(), buyerPhone: String(data.buyerPhone || "").trim(), buyerEmail: String(data.buyerEmail || "").trim(), notes: String(data.notes || "").trim(), courtesy, paid, paymentMethod, paymentDate, quantity, total, checkedIn: current?.checkedIn || false, updatedAt: timestamp };
  if (isDemo) {
    if (id) {
      const updatedSale = { ...current, ...saleData };
      state.sales = state.sales.map((item) => item.id === id ? updatedSale : item);
      appendDemoAudit("edited", updatedSale, auditChangeSummary(current, updatedSale));
    } else {
      const createdSale = { id: crypto.randomUUID(), ...saleData, createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp };
      state.sales.push(createdSale);
      appendDemoAudit("created", createdSale, `Criou a venda com ${saleTicketSummary(createdSale, event)}, ${createdSale.courtesy ? "cortesia sem cobrança" : `pagamento ${createdSale.paid ? `${paymentMethodLabel(createdSale.paymentMethod)} em ${paymentDateLabel(createdSale.paymentDate)}` : "pendente"}`}.`);
    }
    persistDemo(); render();
  } else {
    const saleId = id || push(ref(db, "sales")).key;
    const storedSale = { ...current, id: saleId, ...saleData };
    if (!id) Object.assign(storedSale, { createdByUid: currentUser.uid, createdByName: currentUserProfile.name || currentUser.email, createdByEmail: currentUser.email || currentUserProfile.email || "", createdAt: timestamp });
    const logId = push(ref(db, "auditLogs")).key;
    const action = id ? "edited" : "created";
    const details = id ? auditChangeSummary(current, storedSale) : `Criou a venda com ${saleTicketSummary(storedSale, event)}, ${storedSale.courtesy ? "cortesia sem cobrança" : `pagamento ${storedSale.paid ? `${paymentMethodLabel(storedSale.paymentMethod)} em ${paymentDateLabel(storedSale.paymentDate)}` : "pendente"}`}.`;
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
  if (sale.courtesy || saleIsCourtesy(sale)) return toast("Cortesias não possuem cobrança para alterar.");
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
  if (!requireRole(["admin", "seller"])) return false;
  const sale = state.sales.find((item) => item.id === id); if (!sale || !confirm(isTableReservation(sale) ? `Excluir a reserva de ${sale.reservationLabel || sale.buyerName}?` : `Excluir a venda de ${sale.buyerName}?`)) return false;
  const quantity = saleQuantity(sale);
  const details = isTableReservation(sale) ? `Excluiu a reserva de ${sale.reservationLabel || "mesa"} com ${quantity} pessoas.` : `Excluiu a venda com ${quantity} ${quantity === 1 ? "ingresso" : "ingressos"}: ${saleTicketSummary(sale)}.`;
  if (isDemo) { appendDemoAudit("deleted", sale, details); state.sales = state.sales.filter((item) => item.id !== id); persistDemo(); render(); }
  else { const logId = push(ref(db, "auditLogs")).key; await update(ref(db), { [`sales/${id}`]: null, [`auditLogs/${logId}`]: auditLogData("deleted", sale, details) }); }
  toast(isTableReservation(sale) ? "Reserva excluída." : "Venda excluída.");
  return true;
}
async function deleteEvent(id) { if (!requireRole(["admin"], "Somente administradores podem excluir eventos.")) return; const event = state.events.find((item) => item.id === id); if (!event || !confirm(`Excluir o evento “${event.name}” e todas as vendas e históricos dele? Esta ação não pode ser desfeita.`)) return; const changes = { [`events/${id}`]: null }; state.sales.filter((sale) => sale.eventId === id).forEach((sale) => { changes[`sales/${sale.id}`] = null; }); state.auditLogs.filter((log) => log.eventId === id).forEach((log) => { changes[`auditLogs/${log.id}`] = null; }); if (isDemo) { state.events = state.events.filter((item) => item.id !== id); state.sales = state.sales.filter((sale) => sale.eventId !== id); state.auditLogs = state.auditLogs.filter((log) => log.eventId !== id); persistDemo(); render(); } else { await update(ref(db), changes); } toast("Evento, vendas e históricos vinculados excluídos."); }
function toast(message) { const el = $("toast"); el.textContent = message; el.classList.add("visible"); setTimeout(() => el.classList.remove("visible"), 3200); }
function syncSalePaymentFields(useToday = false) {
  const form = $("saleForm");
  const courtesy = form.classList.contains("sale-is-courtesy");
  const paid = form.elements.paymentStatus.value === "paid";
  const method = form.elements.paymentMethod;
  const date = form.elements.paymentDate;
  method.disabled = courtesy || !paid; date.disabled = courtesy || !paid;
  method.required = paid && !courtesy; date.required = paid && !courtesy;
  form.classList.toggle("payment-is-pending", !paid);
  if (courtesy || !paid) { method.value = ""; date.value = ""; }
  else if (useToday && !date.value) date.value = todayInputValue();
}

function openNewEvent() { if (!requireRole(["admin"], "Somente administradores podem criar eventos.")) return; const form = $("eventForm"); form.reset(); form.dataset.editId = ""; form.elements.eventMode.value = "unit"; form.elements.chairPrice.value = ""; resetEventMapDraft(); syncEventMapSettings(); $("eventModalTitle").textContent = "Novo evento"; $("eventSubmitButton").textContent = "Criar evento"; resetPackages(); resetTicketTypes(); $("eventModal").showModal(); }
function openEditEvent(id) { if (!requireRole(["admin"], "Somente administradores podem editar eventos.")) return; const item = state.events.find((event) => event.id === id); if (!item) return; const form = $("eventForm"); form.reset(); form.dataset.editId = id; form.elements.name.value = item.name || ""; form.elements.date.value = item.date || ""; form.elements.place.value = item.place || ""; form.elements.eventMode.value = item.eventMode === "mixed" ? "mixed" : "unit"; form.elements.chairPrice.value = Number(item.chairPrice || 0); resetEventMapDraft(item); syncEventMapSettings(); resetPackages(); $("ticketTypesList").innerHTML = ""; ticketTypesFor(item).forEach((type) => addTicketTypeRow(type.name, type.price, type.capacity, type.id)); packagesFor(item).forEach((packageItem) => addPackageRow(packageItem)); renderPackagesEmptyState(); $("eventModalTitle").textContent = "Editar evento"; $("eventSubmitButton").textContent = "Salvar alterações"; $("eventModal").showModal(); }
function openNewSale(eventId = "") { if (!requireRole(["admin", "seller"])) return; if (!state.events.length) return toast("Cadastre um evento antes de registrar uma venda."); const form = $("saleForm"); form.reset(); form.dataset.editId = ""; $("saleModalTitle").textContent = "Registrar ingressos"; $("saleSubmitButton").textContent = "Confirmar venda"; $("saleEvent").value = eventId; setSaleTicketItems(eventId); syncSalePaymentFields(true); $("saleModal").showModal(); }
function openEditSale(id) { if (!requireRole(["admin", "seller"])) return; const sale = state.sales.find((item) => item.id === id); if (!sale) return; if ($("allSalesModal").open) $("allSalesModal").close(); const form = $("saleForm"); form.reset(); form.dataset.editId = id; $("saleEvent").value = sale.eventId; setSaleTicketItems(sale.eventId, saleItems(sale)); form.elements.buyerName.value = sale.buyerName || ""; form.elements.buyerPhone.value = sale.buyerPhone || ""; form.elements.buyerEmail.value = sale.buyerEmail || ""; form.elements.paymentStatus.value = sale.paid ? "paid" : "pending"; form.elements.paymentMethod.value = sale.paymentMethod || ""; form.elements.paymentDate.value = sale.paymentDate || ""; form.elements.notes.value = sale.notes || ""; syncSalePaymentFields(false); $("saleModalTitle").textContent = "Editar participante e ingressos"; $("saleSubmitButton").textContent = "Salvar alterações"; $("saleModal").showModal(); }

document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.open === "eventModal") return openNewEvent(); if (button.dataset.open === "saleModal") return openNewSale(selectedEventId); $(button.dataset.open).showModal(); }));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
$("addTicketType").addEventListener("click", () => addTicketTypeRow());
$("addPackage").addEventListener("click", () => addPackageRow());
$("addCourtesy").addEventListener("click", () => addPackageRow({}, "courtesy"));
$("ticketTypesList").addEventListener("input", refreshPackageTicketOptions);
$("packagesList").addEventListener("input", (event) => { const packageRow = event.target.closest(".package-row"); if (packageRow) updatePackageSummary(packageRow); });
$("packagesList").addEventListener("change", (event) => { if (event.target.matches(".package-component-type")) refreshPackageTicketOptions(); });
$("addSaleTicketItem").addEventListener("click", () => { const event = state.events.find((item) => item.id === $("saleEvent").value); if (!event) return toast("Selecione o evento primeiro."); if (document.querySelectorAll(".sale-ticket-item-row").length >= saleOptionsFor(event, $("saleForm").dataset.editId || "").length) return toast("Todos os ingressos, pacotes e cortesias disponíveis já foram adicionados."); addSaleTicketItemRow(); populateSaleTicketItemOptions(event.id); });
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
$("sellerDetailsToggle").addEventListener("click", toggleSellerTicketReport);
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
$("tableReservationSearch").addEventListener("input", (event) => { tableReservationSearchQuery = event.currentTarget.value; render(); });
$("tableReservationSearch").addEventListener("keydown", (event) => { if (event.key === "Escape") { tableReservationSearchQuery = ""; render(); event.currentTarget.focus(); } });
$("clearTableReservationSearch").addEventListener("click", () => { tableReservationSearchQuery = ""; render(); $("tableReservationSearch").focus(); });
$("applyTableReservationFilters").addEventListener("click", () => { tableReservationAreaFilter = $("tableReservationAreaFilter").value; tableReservationPaymentFilter = $("tableReservationPaymentFilter").value; document.querySelector(".table-reservation-filter").open = false; render(); });
$("clearTableReservationFiltersMenu").addEventListener("click", () => { resetTableReservationFilters(); document.querySelector(".table-reservation-filter").open = false; render(); });
$("openAllTableReservations").addEventListener("click", () => $("allTableReservationsModal").showModal());
document.querySelectorAll("[data-clear-participant-filters]").forEach((button) => button.addEventListener("click", () => { resetParticipantFilters(); document.querySelector(".ticket-filter").open = false; render(); $("participantSearch").focus(); }));
$("eventsList").addEventListener("click", (event) => { if (event.target.closest("[data-select-event]")) resetParticipantFilters(); });
$("eventMode").addEventListener("change", syncEventMapSettings);
document.querySelectorAll('#eventForm [name="mapArea"]').forEach((input) => input.addEventListener("change", () => {
  if (input.checked) {
    if (!eventMapDraft.areas.includes(input.value)) eventMapDraft.areas.push(input.value);
    activeMapEditorArea = input.value;
  } else {
    const hasFurniture = eventMapDraft.furniture.some((item) => item.area === input.value);
    if (hasFurniture && !confirm(`Remover todas as mesas e bistrôs do ${mapAreaLabel(input.value)}?`)) { input.checked = true; return; }
    eventMapDraft.areas = eventMapDraft.areas.filter((area) => area !== input.value);
    eventMapDraft.furniture = eventMapDraft.furniture.filter((item) => item.area !== input.value);
    if (activeMapEditorArea === input.value) activeMapEditorArea = eventMapDraft.areas[0] || "";
    selectedMapFurnitureId = "";
  }
  renderMapEditor();
}));
document.querySelectorAll("[data-map-tool]").forEach((button) => button.addEventListener("click", () => { activeMapTool = activeMapTool === button.dataset.mapTool ? "" : button.dataset.mapTool; renderMapEditor(); }));
$("tableMapEditor").addEventListener("click", (event) => { const slot = event.target.closest("[data-map-slot]"); if (slot) togglePresetSlot(slot.dataset.mapSlot); });
$("mapEditorAreaTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-editor-map-area]"); if (!button) return; activeMapEditorArea = button.dataset.editorMapArea; selectedMapFurnitureId = ""; renderMapEditor(); });
$("tableMapAreaTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-view-map-area]"); if (!button) return; activeMapViewerArea = button.dataset.viewMapArea; const selectedEvent = state.events.find((item) => item.id === selectedEventId); renderTableMapPanel(selectedEvent, state.sales.filter((sale) => sale.eventId === selectedEventId)); });
$("tableMapViewer").addEventListener("click", (event) => { const furniture = event.target.closest("[data-reserve-furniture]"); if (furniture) openTableReservation(furniture.dataset.reserveFurniture); });
$("openMapZoom").addEventListener("click", () => { const selectedEvent = state.events.find((item) => item.id === selectedEventId); renderMapZoom(selectedEvent, state.sales.filter((sale) => sale.eventId === selectedEventId)); $("mapZoomModal").showModal(); requestAnimationFrame(() => { const canvas = $("mapZoomCanvas"); canvas.scrollLeft = 0; canvas.scrollTop = 0; }); });
$("tableMapZoomAreaTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-zoom-map-area]"); if (!button) return; activeMapViewerArea = button.dataset.zoomMapArea; const selectedEvent = state.events.find((item) => item.id === selectedEventId); renderTableMapPanel(selectedEvent, state.sales.filter((sale) => sale.eventId === selectedEventId)); });
$("tableMapZoomViewer").addEventListener("click", (event) => { const furniture = event.target.closest("[data-reserve-furniture]"); if (!furniture) return; $("mapZoomModal").close(); openTableReservation(furniture.dataset.reserveFurniture); });
$("tableReservationsList").addEventListener("click", (event) => { if (event.target.closest("[data-delete-sale], [data-whatsapp]")) return; const edit = event.target.closest("[data-open-table-reservation]"); if (edit) return openTableReservation(edit.dataset.openTableReservation); const toggle = event.target.closest("[data-toggle-table-reservation-details]"); if (toggle) toggleTableReservationCard(toggle.closest(".table-reservation-card")); });
$("tableReservationsList").addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-toggle-table-reservation-details]")) { event.preventDefault(); toggleTableReservationCard(event.target.closest(".table-reservation-card")); } });
$("allSalesList").addEventListener("click", (event) => { const reservation = event.target.closest("[data-open-table-reservation]"); if (reservation) openTableReservation(reservation.dataset.openTableReservation); });
$("allTableReservationsList").addEventListener("click", (event) => { const reservation = event.target.closest("[data-open-table-reservation]"); if (reservation) openTableReservation(reservation.dataset.openTableReservation); });
$("exportTableReservations").addEventListener("click", () => { if (requireRole(["admin", "seller"])) window.exportSalesXlsx(state.sales, state.events, selectedEventId, "tables"); });
$("addTableOccupant").addEventListener("click", () => addTableOccupantRow());
$("tableOccupantsList").addEventListener("click", (event) => { const remove = event.target.closest("[data-remove-table-occupant]"); if (!remove) return; remove.closest(".table-occupant-row").remove(); updateTableReservationTotal(); });
$("tableReservationForm").elements.paymentStatus.addEventListener("change", () => syncTableReservationPaymentFields(true));
$("tableReservationForm").elements.buyerPhone.addEventListener("blur", (event) => { event.currentTarget.value = formatPhoneDisplay(event.currentTarget.value); });
$("deleteTableReservation").addEventListener("click", async () => { const id = $("tableReservationForm").elements.saleId.value; if (!id) return; if (await deleteSale(id)) $("tableReservationModal").close(); });
$("eventForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); data.ticketTypes = getTicketTypes(); if (!data.ticketTypes.length) throw new Error("Informe ao menos um tipo ou lote com valor e quantidade."); data.packages = getPackages(data.ticketTypes); data.tableMap = { areas: [...eventMapDraft.areas], furniture: eventMapDraft.furniture.map((item) => ({ ...item })) }; await saveEvent(data, form.dataset.editId); form.reset(); resetPackages(); resetTicketTypes(); resetEventMapDraft(); $("eventModal").close(); } catch (error) { toast(error.message); } });
$("saleForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); data.items = getSaleTicketItems(); await saveSale(data, form.dataset.editId); form.reset(); $("saleTicketItemsList").innerHTML = ""; $("saleModal").close(); } catch (error) { toast(error.message); } });
$("tableReservationForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; try { const data = Object.fromEntries(new FormData(form)); await saveTableReservation(data); form.reset(); $("tableOccupantsList").innerHTML = ""; $("tableReservationModal").close(); } catch (error) { toast(error.message); } });
$("paymentConfirmationForm").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); button.disabled = true; try { await confirmSalePayment(Object.fromEntries(new FormData(form))); form.reset(); $("paymentConfirmationModal").close(); toast("Pagamento confirmado."); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
document.addEventListener("click", (event) => { const whatsappTrigger = event.target.closest("[data-whatsapp]"); if (whatsappTrigger) { event.preventDefault(); openWhatsappChooser(whatsappTrigger); return; } const whatsappApp = event.target.closest("[data-whatsapp-app]"); if (whatsappApp) { launchWhatsapp(whatsappApp.dataset.whatsappApp); return; } const metricDetails = event.target.closest("[data-toggle-metric-details]"); if (metricDetails) { toggleMetricDetails(metricDetails); return; } const participantDetails = event.target.closest("[data-toggle-sale-details]"); if (participantDetails) { toggleParticipantCard(participantDetails.closest("[data-sale-row]")); return; } const addPackageComponent = event.target.closest("[data-add-package-component]"); if (addPackageComponent) { const packageRow = addPackageComponent.closest(".package-row"); if (packageRow.querySelectorAll(".package-component-row").length >= draftTicketTypes().filter((item) => item.name).length) return toast("Todos os tipos de ingresso já foram adicionados aqui."); addPackageComponentRow(packageRow); refreshPackageTicketOptions(); return; } const removePackageComponent = event.target.closest("[data-remove-package-component]"); if (removePackageComponent) { const packageRow = removePackageComponent.closest(".package-row"); if (packageRow.querySelectorAll(".package-component-row").length === 1) return toast("O pacote ou cortesia precisa ter pelo menos um ingresso."); removePackageComponent.closest(".package-component-row").remove(); refreshPackageTicketOptions(); return; } const removePackage = event.target.closest("[data-remove-package]"); if (removePackage) { removePackage.closest(".package-row").remove(); refreshPackageTicketOptions(); return; } const removeTicket = event.target.closest("[data-remove-ticket]"); if (removeTicket) { if (document.querySelectorAll(".ticket-type-row").length === 1) return toast("O evento precisa de pelo menos um tipo de ingresso."); removeTicket.closest(".ticket-type-row").remove(); refreshPackageTicketOptions(); return; } const removeSaleTicket = event.target.closest("[data-remove-sale-ticket]"); if (removeSaleTicket) { const rows = document.querySelectorAll(".sale-ticket-item-row"); if (rows.length === 1) return toast("A venda precisa de pelo menos um item."); removeSaleTicket.closest(".sale-ticket-item-row").remove(); populateSaleTicketItemOptions(); return; } const deleteEventButton = event.target.closest("[data-delete-event]"); if (deleteEventButton) { event.preventDefault(); event.stopPropagation(); deleteEvent(deleteEventButton.dataset.deleteEvent); return; } const selectedAction = event.target.closest("[data-selected-action]"); if (selectedAction) { const action = selectedAction.dataset.selectedAction; if (action === "sale") openNewSale(selectedEventId); if (action === "edit") openEditEvent(selectedEventId); if (action === "history") openAuditHistory(selectedEventId); if (action === "export" && requireRole(["admin", "seller"])) window.exportSalesXlsx(state.sales, state.events, selectedEventId, "unit"); if (action === "delete") deleteEvent(selectedEventId); return; } const selectEvent = event.target.closest("[data-select-event]"); if (selectEvent) { selectedEventId = selectEvent.dataset.selectEvent; render(); return; } const editSaleButton = event.target.closest("[data-edit-sale]"); if (editSaleButton) { openEditSale(editSaleButton.dataset.editSale); return; } const deleteSaleButton = event.target.closest("[data-delete-sale]"); if (deleteSaleButton) { deleteSale(deleteSaleButton.dataset.deleteSale); return; } const checkin = event.target.closest("[data-checkin]"); if (checkin) { toggleCheckin(checkin.dataset.checkin); return; } const paid = event.target.closest("[data-paid]"); if (paid) { togglePayment(paid.dataset.paid); return; } });
document.addEventListener("click", (event) => { const toggle = event.target.closest?.("[data-toggle-package-discount]"); if (!toggle) return; event.preventDefault(); event.stopImmediatePropagation(); togglePackageDiscountType(toggle.closest(".package-row")); }, true);
// O cartão do participante é somente informativo; edição acontece apenas pelo botão Editar.
document.addEventListener("click", (event) => { const row = event.target.closest?.("#salesList [data-sale-row]"); if (!row || event.target.closest("button, a, input, select, textarea")) return; if (window.matchMedia("(max-width: 700px)").matches) toggleParticipantCard(row); event.stopImmediatePropagation(); }, true);
document.addEventListener("keydown", (event) => { const card = event.target.closest?.("[data-select-event]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectedEventId = card.dataset.selectEvent; resetParticipantFilters(); render(); } });
window.addEventListener("hashchange", () => { syncApplicationPage(); window.scrollTo({ top: 0, behavior: "smooth" }); });
window.addEventListener("popstate", syncApplicationPage);
start();
resetTicketTypes();
resetPackages();
setSaleTicketItems("");
syncSalePaymentFields(true);
