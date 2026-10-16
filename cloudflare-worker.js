const ALLOWED_ORIGINS = new Set(["https://le-beef.github.io", "http://localhost", "http://127.0.0.1"]);
const NOTIFICATION_TEXT = {
  new_sale: "Nova venda registrada.",
  reservation_created: "Nova reserva de mesa registrada.",
  payment_changed: "O status de um pagamento foi alterado.",
  sale_deleted: "Uma venda foi excluída.",
  reservation_deleted: "Uma reserva de mesa foi excluída.",
  table_occupied: "Uma mesa foi marcada como ocupada.",
  table_released: "Uma mesa foi liberada.",
  event_updated: "Data, horário, local ou mapa do evento foram atualizados."
};

let googleKeys = { expiresAt: 0, values: {} };
let accessToken = { expiresAt: 0, value: "" };

function json(data, status = 200, origin = "") {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (origin && allowedOrigin(origin)) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function publicKeys() {
  if (googleKeys.expiresAt > Date.now()) return googleKeys.values;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Não foi possível validar o token do Firebase.");
  const document = await response.json();
  const values = Object.fromEntries((document.keys || []).filter((key) => key.kid).map((key) => [key.kid, key]));
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 300);
  googleKeys = { values, expiresAt: Date.now() + Math.max(60, maxAge - 30) * 1000 };
  return values;
}

async function verifyFirebaseToken(token, projectId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Token de acesso inválido.");
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  const jwk = (await publicKeys())[header.kid];
  if (!jwk || header.alg !== "RS256") throw new Error("Token de acesso inválido.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  if (!verified || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || !payload.sub || payload.exp <= now || payload.iat > now + 60) throw new Error("Token de acesso expirado ou inválido.");
  return payload;
}

function serviceAccount(env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error("Credencial do Firebase não configurada.");
  return account;
}

async function serviceAccessToken(env) {
  if (accessToken.value && accessToken.expiresAt > Date.now() + 60000) return accessToken.value;
  const account = serviceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const payload = encodeJson({
    iss: account.client_email,
    sub: account.client_email,
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/userinfo.email",
    iat: now,
    exp: now + 3600
  });
  const keyData = Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}` })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Não foi possível autenticar o Worker no Firebase.");
  accessToken = { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 };
  return accessToken.value;
}

async function firebaseGet(env, path) {
  const account = serviceAccount(env);
  const databaseUrl = account.database_url || `https://${account.project_id}-default-rtdb.firebaseio.com`;
  const response = await fetch(`${databaseUrl}/${path}.json`, { headers: { Authorization: `Bearer ${await serviceAccessToken(env)}` } });
  if (!response.ok) throw new Error(`Firebase respondeu ${response.status}.`);
  return response.json();
}

async function authorizedContext(request, env, eventId, roles = null) {
  const account = serviceAccount(env);
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const identity = await verifyFirebaseToken(token, account.project_id);
  const profile = await firebaseGet(env, `users/${identity.sub}`);
  if (!profile?.active || !profile.role) throw new Error("Usuário sem permissão ativa.");
  if (roles && !roles.includes(profile.role)) throw new Error("Seu perfil não permite esta ação.");
  const allowed = profile.role === "admin" || profile.eventIds?.[eventId] === true;
  if (!allowed) throw new Error("Usuário sem acesso a este evento.");
  const event = await firebaseGet(env, `events/${eventId}`);
  if (!event) throw new Error("Evento não encontrado.");
  return { identity, profile, event, account };
}

async function body(request) {
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Dados inválidos.");
  return value;
}

function requiredText(value, label, maximum) {
  const text = String(value || "").trim();
  if (!text || text.length > maximum) throw new Error(`${label} inválido.`);
  return text;
}

async function saveSubscription(request, env, origin) {
  const data = await body(request);
  const eventId = requiredText(data.eventId, "Evento", 160);
  const deviceId = requiredText(data.deviceId, "Aparelho", 160);
  const enabled = data.enabled === true;
  const { identity } = await authorizedContext(request, env, eventId, ["admin", "event_manager"]);
  if (enabled) {
    const fcmToken = requiredText(data.fcmToken, "Token de notificação", 4096);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM push_subscriptions WHERE event_id = ? AND fcm_token = ? AND NOT (user_uid = ? AND device_id = ?)").bind(eventId, fcmToken, identity.sub, deviceId),
      env.DB.prepare(`INSERT INTO push_subscriptions (event_id, user_uid, device_id, fcm_token, enabled, updated_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(event_id, user_uid, device_id) DO UPDATE SET fcm_token = excluded.fcm_token, enabled = 1, updated_at = CURRENT_TIMESTAMP`)
        .bind(eventId, identity.sub, deviceId, fcmToken)
    ]);
  } else {
    await env.DB.prepare("UPDATE push_subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE event_id = ? AND user_uid = ? AND device_id = ?").bind(eventId, identity.sub, deviceId).run();
  }
  return json({ ok: true, enabled }, 200, origin);
}

async function sendMessage(env, account, recipient, eventId, eventName, type) {
  const siteUrl = `https://le-beef.github.io/vendas/?eventoPainel=${encodeURIComponent(eventId)}#resumo`;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await serviceAccessToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: recipient.fcm_token,
        webpush: {
          headers: { Urgency: "high", TTL: "300" },
          data: {
            title: `Le Beef · ${String(eventName || "Evento").slice(0, 80)}`,
            body: NOTIFICATION_TEXT[type],
            eventId,
            type,
            url: siteUrl,
            icon: "https://le-beef.github.io/vendas/icon-192.png?v=19",
            badge: "https://le-beef.github.io/vendas/icon-192.png?v=19"
          }
        }
      }
    })
  });
  const result = await response.json().catch(() => ({}));
  const code = result?.error?.details?.find?.((detail) => detail.errorCode)?.errorCode || "";
  return { ok: response.ok, expired: ["UNREGISTERED", "INVALID_ARGUMENT"].includes(code), status: response.status };
}

async function dispatchNotification(request, env, origin) {
  const data = await body(request);
  const eventId = requiredText(data.eventId, "Evento", 160);
  const type = requiredText(data.type, "Tipo", 80);
  const actorDeviceId = requiredText(data.deviceId, "Aparelho", 160);
  const dedupeKey = requiredText(data.dedupeKey, "Identificador", 240);
  if (!NOTIFICATION_TEXT[type]) throw new Error("Tipo de notificação não permitido.");
  const { identity, event, account } = await authorizedContext(request, env, eventId, ["admin", "event_manager", "seller", "promoter"]);
  const inserted = await env.DB.prepare("INSERT OR IGNORE INTO notification_dispatches (dedupe_key, event_id, notification_type, actor_uid) VALUES (?, ?, ?, ?)").bind(dedupeKey, eventId, type, identity.sub).run();
  if (!inserted.meta?.changes) return json({ ok: true, duplicate: true, sent: 0 }, 200, origin);
  const recipients = await env.DB.prepare("SELECT id, user_uid, fcm_token FROM push_subscriptions WHERE event_id = ? AND enabled = 1 AND NOT (user_uid = ? AND device_id = ?)").bind(eventId, identity.sub, actorDeviceId).all();
  let sent = 0;
  for (const recipient of recipients.results || []) {
    const result = await sendMessage(env, account, recipient, eventId, event.name, type);
    if (result.ok) sent += 1;
    else if (result.expired) await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(recipient.id).run();
  }
  return json({ ok: true, sent }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS") return allowedOrigin(origin) ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
    if (origin && !allowedOrigin(origin)) return json({ error: "Origem não autorizada." }, 403);
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "le-beef-notificacoes" }, 200, origin);
      if (request.method === "POST" && url.pathname === "/api/subscriptions") return await saveSubscription(request, env, origin);
      if (request.method === "POST" && url.pathname === "/api/notify") return await dispatchNotification(request, env, origin);
      return json({ error: "Rota não encontrada." }, 404, origin);
    } catch (error) {
      console.error(error);
      const safeMessages = ["Token de acesso inválido.", "Token de acesso expirado ou inválido.", "Usuário sem permissão ativa.", "Seu perfil não permite esta ação.", "Usuário sem acesso a este evento.", "Evento não encontrado.", "Tipo de notificação não permitido.", "Dados inválidos."];
      const message = safeMessages.includes(error.message) || String(error.message || "").endsWith(" inválido.") ? error.message : "Não foi possível concluir a solicitação.";
      const status = message.includes("Token") ? 401 : message.includes("permiss") || message.includes("acesso") ? 403 : message.includes("inválid") || message.includes("não encontrado") ? 400 : 500;
      return json({ error: message }, status, origin);
    }
  }
};
