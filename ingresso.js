import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const status = document.getElementById("ticketStatus");
const id = new URLSearchParams(location.search).get("id") || "";
const unavailable = "Este link não está disponível. Confira se o ingresso ainda é válido ou peça um novo link ao organizador.";

function pdfBlob(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: "application/pdf" });
}

async function loadTicket() {
  if (!/^[a-f0-9]{64}$/.test(id) || !firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
    status.textContent = unavailable;
    return;
  }
  try {
    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app, firebaseConfig.databaseURL);
    const snapshot = await get(ref(db, `ticketLinks/${id}`));
    if (!snapshot.exists()) throw new Error("Link inexistente.");
    const data = snapshot.val();
    if (typeof data.pdfBase64 !== "string" || data.pdfBase64.length > 2500000) throw new Error("PDF inválido.");
    const blob = pdfBlob(data.pdfBase64);
    const url = URL.createObjectURL(blob);
    const filename = String(data.filename || "ingresso.pdf").replace(/[\\/\r\n]/g, "_");
    const open = document.getElementById("openTicket");
    const download = document.getElementById("downloadTicket");
    open.href = url;
    download.href = url;
    download.download = filename;
    document.getElementById("ticketPreview").src = url;
    document.getElementById("ticketPreview").hidden = false;
    document.getElementById("ticketActions").hidden = false;
    status.textContent = "Ingresso disponível. Abra ou baixe o PDF para apresentar o QR Code na entrada.";
    window.addEventListener("pagehide", () => URL.revokeObjectURL(url), { once: true });
  } catch (error) {
    console.error(error);
    status.textContent = unavailable;
  }
}

loadTicket();
