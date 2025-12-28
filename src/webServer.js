// src/webServer.js - Web server and endpoints
const express = require("express");
const QRCode = require("qrcode");

const app = express();

let currentQRCode = null;
let qrCodeExpiry = null;
let botStatus = {
  connected: false,
  lastActivity: new Date(),
  reconnectCount: 0,
};

// Update bot status
function updateBotStatus(updates) {
  if (updates.connected !== undefined) botStatus.connected = updates.connected;
  if (updates.reconnectCount === true) botStatus.reconnectCount++;
  botStatus.lastActivity = new Date();
}

// Get/Set QR code
function getCurrentQR() {
  return currentQRCode;
}

function setCurrentQR(qr) {
  currentQRCode = qr;
  if (qr) {
    qrCodeExpiry = Date.now() + 60000;
    setTimeout(() => {
      if (currentQRCode === qr) {
        currentQRCode = null;
        qrCodeExpiry = null;
      }
    }, 60000);
  } else {
    qrCodeExpiry = null;
  }
}

// Routes
app.get("/", (req, res) => {
  botStatus.lastActivity = new Date();
  res.send(
    `WhatsApp Bot Status: ${
      botStatus.connected ? "✅ Connected" : "❌ Disconnected"
    } | Uptime: ${Math.floor(process.uptime() / 60)}m`
  );
});

app.get("/health", (req, res) => {
  botStatus.lastActivity = new Date();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    connected: botStatus.connected,
    timestamp: new Date().toISOString(),
    reconnectCount: botStatus.reconnectCount,
  });
});

app.get("/ping", (req, res) => {
  botStatus.lastActivity = new Date();
  res.json({ pong: true, time: Date.now() });
});

app.get("/status", (req, res) => {
  botStatus.lastActivity = new Date();
  res.json({
    service: "whatsapp-bot",
    connected: botStatus.connected,
    uptime: process.uptime(),
    lastActivity: botStatus.lastActivity,
    reconnectCount: botStatus.reconnectCount,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/qr", async (req, res) => {
  botStatus.lastActivity = new Date();

  if (botStatus.connected) {
    res.send("Bot is already connected! No QR code needed.");
    return;
  }

  if (!currentQRCode) {
    res.send("Waiting for QR code... Please refresh in a few seconds.");
    return;
  }

  try {
    const qrImage = await QRCode.toDataURL(currentQRCode);
    const expiryTime = qrCodeExpiry
      ? Math.ceil((qrCodeExpiry - Date.now()) / 1000)
      : 60;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp QR Code</title>
        <meta http-equiv="refresh" content="30">
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #0a0a0a; color: white; }
          img { border: 5px solid #25D366; border-radius: 10px; }
        </style>
      </head>
      <body>
        <h1>📱 Scan QR Code</h1>
        <img src="${qrImage}" width="300" height="300">
        <p>Expires in ~${expiryTime}s</p>
        <p><small>Open WhatsApp > Settings > Linked Devices > Link a Device</small></p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error generating QR image:", error);
    res.status(500).send("Error generating QR code");
  }
});

// Self-ping mechanism
let selfPingInterval = null;
function startSelfPing(port) {
  if (selfPingInterval) return;

  selfPingInterval = setInterval(() => {
    const timeSinceActivity = Date.now() - botStatus.lastActivity.getTime();

    if (timeSinceActivity > 5 * 60 * 1000) {
      console.log("🔄 Self-ping to prevent sleep");
      botStatus.lastActivity = new Date();
    }
  }, 8 * 60 * 1000);
}

// Start web server
function startWebServer(port) {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📱 QR Code: http://localhost:${port}/qr`);
    console.log(`🔍 Health: http://localhost:${port}/health`);
    startSelfPing(port);
  });
}

module.exports = {
  startWebServer,
  updateBotStatus,
  getCurrentQR,
  setCurrentQR,
};
