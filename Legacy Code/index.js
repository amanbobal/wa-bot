import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Globals to hold latest QR data URL (so the /qr endpoint can serve it)
let latestQrDataUrl = null;
let lastQrAt = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    syncFullHistory: false,
    // do NOT pass printQRInTerminal
  });

  sock.ev.on("creds.update", saveCreds);

  // Listen for connection updates (including qr)
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Convert QR string to a PNG data URL (so the browser can display it)
      try {
        const dataUrl = await qrcode.toDataURL(qr);
        latestQrDataUrl = dataUrl;
        lastQrAt = new Date().toISOString();
        console.log(
          "Received QR — visit /qr to scan it. (QR stored as data URL)"
        );
      } catch (err) {
        console.error("Failed to generate QR data URL:", err);
      }
    }

    if (connection === "open") {
      console.log("Connection open — authenticated.");
      // Once authenticated we can clear QR
      latestQrDataUrl = null;
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        "Connection closed. Reconnect?",
        shouldReconnect,
        lastDisconnect?.error?.output
      );
      if (shouldReconnect) {
        console.log("Attempting reconnect...");
        // small delay before reconnecting avoids tight loop
        setTimeout(startBot, 2000);
      } else {
        console.log(
          "Logged out — remove auth/ and re-scan if you want a new session."
        );
      }
    }
  });

  // messages handler (simple)
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg || !msg.message) return;
      // keep your existing message handling logic here...
    } catch (e) {
      console.error("messages.upsert error:", e);
    }
  });

  console.log("Bot logic initialized.");
}

// start the bot
startBot().catch((err) => {
  console.error("Failed to start bot:", err);
});

// Simple web UI for QR
app.get("/", (req, res) => {
  res.send(
    `<h3>Bot running</h3><p>Visit <a href="/qr">/qr</a> to scan QR (if available).</p>`
  );
});

app.get("/qr", (req, res) => {
  if (!latestQrDataUrl) {
    return res.send(`<h3>No QR available</h3>
      <p>Either the bot is already authenticated, or no QR has been generated yet.</p>
      <p>Last QR: ${lastQrAt || "never"}</p>`);
  }
  // Serve a minimal page with the QR image
  res.send(`
    <h3>Scan this QR with WhatsApp → Settings → Linked devices → Link a device</h3>
    <img src="${latestQrDataUrl}" alt="WhatsApp QR" />
    <p>Tip: If QR expires, restart the service or refresh logs to see a new QR.</p>
  `);
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});
