import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";

export const NOTIFICATION_WORKER_URL = "https://le-beef-notificacoes.albano-tiago-esteves.workers.dev";
export const NOTIFICATION_VAPID_KEY = "BLV6o28xkBfW3MCXOa3Hft8agHn2VjtEy8OVXzJotZykRx0QNJNM91LFy2wKU-gNy1SMeXngo9Wm0BJnPtyb_u4";

const DEVICE_ID_KEY = "le-beef-notification-device";
const ENABLED_EVENTS_KEY = "le-beef-notification-events";

function readEnabledEventsByUser() {
  try {
    const value = JSON.parse(localStorage.getItem(ENABLED_EVENTS_KEY) || "[]");
    return value && !Array.isArray(value) && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function deviceId() {
  let value = localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}

export function createEventNotificationManager({ getApp, getUser, getProfile, toast, changed }) {
  let enabledEvents = new Set();
  let enabledUserId = "";
  let messaging = null;
  let foregroundUnsubscribe = null;
  let syncing = null;
  let lastSyncSignature = "";
  let lastSyncAt = 0;

  const syncEnabledUser = () => {
    const userId = String(getUser()?.uid || "");
    if (userId === enabledUserId) return;
    const stored = readEnabledEventsByUser();
    enabledEvents = new Set(Array.isArray(stored[userId]) ? stored[userId].map(String) : []);
    enabledUserId = userId;
  };
  const persist = () => {
    const stored = readEnabledEventsByUser();
    stored[enabledUserId] = [...enabledEvents];
    localStorage.setItem(ENABLED_EVENTS_KEY, JSON.stringify(stored));
  };
  const canManage = () => Boolean(getApp()) && ["admin", "event_manager"].includes(getProfile()?.role);
  const isEnabled = (eventId) => { syncEnabledUser(); return enabledEvents.has(String(eventId)); };

  async function firebaseMessaging() {
    if (messaging) return messaging;
    if (!(await isSupported())) throw new Error("Este navegador não oferece suporte às notificações do aplicativo.");
    messaging = getMessaging(getApp());
    if (!foregroundUnsubscribe) {
      foregroundUnsubscribe = onMessage(messaging, (payload) => {
        const title = payload?.data?.title || "Le Beef";
        const body = payload?.data?.body || "Há uma atualização em um evento.";
        toast(`${title}: ${body}`);
      });
    }
    return messaging;
  }

  async function registrationToken({ requestPermission = false } = {}) {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Este navegador não oferece suporte às notificações do aplicativo.");
    let permission = Notification.permission;
    if (requestPermission && permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(permission === "denied" ? "As notificações estão bloqueadas nas configurações do navegador." : "Autorize as notificações para ativar o sino.");
    const serviceWorkerRegistration = await navigator.serviceWorker.ready;
    return getToken(await firebaseMessaging(), { vapidKey: NOTIFICATION_VAPID_KEY, serviceWorkerRegistration });
  }

  async function request(path, body) {
    const user = getUser();
    if (!user) throw new Error("Entre novamente para configurar as notificações.");
    const token = await user.getIdToken();
    const response = await fetch(`${NOTIFICATION_WORKER_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível configurar as notificações.");
    return result;
  }

  async function setEnabled(eventId, enabled, { requestPermission = false } = {}) {
    syncEnabledUser();
    const id = String(eventId || "");
    if (!id || !canManage()) throw new Error("Seu perfil não pode configurar notificações deste evento.");
    let fcmToken = "";
    if (enabled) {
      fcmToken = await registrationToken({ requestPermission });
      if (!fcmToken) throw new Error("O Firebase não conseguiu registrar este aparelho.");
    }
    await request("/api/subscriptions", { eventId: id, deviceId: deviceId(), fcmToken, enabled });
    if (enabled) enabledEvents.add(id); else enabledEvents.delete(id);
    persist();
    changed();
    return enabled;
  }

  async function toggle(eventId) {
    const enabled = !isEnabled(eventId);
    await setEnabled(eventId, enabled, { requestPermission: enabled });
    toast(enabled ? "Notificações ativadas para este evento." : "Notificações silenciadas para este evento.");
  }

  async function sync(eventIds = []) {
    syncEnabledUser();
    if (syncing || !canManage() || !("Notification" in window) || Notification.permission !== "granted" || !enabledEvents.size) return syncing;
    const allowed = new Set(eventIds.map(String));
    const active = [...enabledEvents].filter((eventId) => allowed.has(eventId));
    if (!active.length) return null;
    const signature = active.sort().join("|");
    if (signature === lastSyncSignature && Date.now() - lastSyncAt < 300000) return null;
    syncing = (async () => {
      try {
        const fcmToken = await registrationToken();
        await Promise.all(active.map((eventId) => request("/api/subscriptions", { eventId, deviceId: deviceId(), fcmToken, enabled: true })));
        lastSyncSignature = signature;
        lastSyncAt = Date.now();
      } catch (error) {
        console.warn("Não foi possível renovar as inscrições de notificação:", error);
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }

  async function notify(eventId, type, reference = "") {
    if (!eventId || typeof getUser()?.getIdToken !== "function" || !type) return;
    try {
      await request("/api/notify", {
        eventId: String(eventId),
        type: String(type),
        dedupeKey: `${type}:${eventId}:${reference || crypto.randomUUID()}`
      });
    } catch (error) {
      console.warn("A alteração foi salva, mas o aviso push não pôde ser enviado:", error);
    }
  }

  return { canManage, isEnabled, toggle, sync, notify };
}
