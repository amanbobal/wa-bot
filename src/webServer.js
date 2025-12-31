// src/webServer.js - Enhanced web server with admin panel
const express = require("express");
const QRCode = require("qrcode");
const { setupAdminPanel } = require("./adminPanel");

const app = express();
app.use(express.json());

let currentQRCode = null;
let qrCodeExpiry = null;
let botStatus = {
  connected: false,
  lastActivity: new Date(),
  reconnectCount: 0,
};

function updateBotStatus(updates) {
  if (updates.connected !== undefined) botStatus.connected = updates.connected;
  if (updates.reconnectCount === true) botStatus.reconnectCount++;
  botStatus.lastActivity = new Date();
}

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
    } | Uptime: ${Math.floor(process.uptime() / 60)}m | Admin Panel: /sys-admin`
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
    res.send("Bot is already connected!");
    return;
  }

  if (!currentQRCode) {
    res.send("Waiting for QR code... Refresh in a few seconds.");
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

// Setup admin panel routes
setupAdminPanel(app);

// Note: Self-ping removed, replaced with random joke scheduler

function startWebServer(port) {
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📱 QR Code: http://localhost:${port}/qr`);
    console.log(`🔍 Health: http://localhost:${port}/health`);
    console.log(`🔐 Admin: http://localhost:${port}/sys-admin`);
  });
}

module.exports = {
  startWebServer,
  updateBotStatus,
  getCurrentQR,
  setCurrentQR,
};