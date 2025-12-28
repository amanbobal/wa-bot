// server.js - Main entry point
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const express = require("express");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");

// Import modules
const {
  startWebServer,
  updateBotStatus,
  getCurrentQR,
  setCurrentQR,
} = require("./src/webServer");
const { handleCommand } = require("./src/commands");
const { chatWithTobias } = require("./src/groqIntegration");
const { deleteMessage, isUserAdmin, isBotAdmin } = require("./src/utils");
const {
  hasUnauthorizedContent,
  isModerationEnabled,
} = require("./src/moderation");
const { BOT_JID } = require("./src/config");

// Start web server
const PORT = process.env.PORT || 3000;
startWebServer(PORT);

// Main bot function
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["WhatsApp Bot", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR Code generated! Scan with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
      console.log(
        "\nOpen WhatsApp > Settings > Linked Devices > Link a Device"
      );
      console.log(`\n🌐 Or visit: http://localhost:${PORT}/qr\n`);

      setCurrentQR(qr);
    }

    if (connection === "close") {
      updateBotStatus({ connected: false });
      setCurrentQR(null);

      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        updateBotStatus({ reconnectCount: true });
        setTimeout(() => startBot(), 5000);
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
      console.log("Bot JID:", BOT_JID);
      console.log("Bot user ID from socket:", sock.user.id);

      updateBotStatus({ connected: true });
      setCurrentQR(null);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      if (!message.key.remoteJid.endsWith("@g.us")) continue;

      const groupId = message.key.remoteJid;
      const senderId = message.key.participant || message.key.remoteJid;
      const msg = message.message;

      let messageText = "";
      if (msg?.conversation) {
        messageText = msg.conversation;
      } else if (msg?.extendedTextMessage?.text) {
        messageText = msg.extendedTextMessage.text;
      } else if (msg?.imageMessage?.caption) {
        messageText = msg.imageMessage.caption;
      } else if (msg?.videoMessage?.caption) {
        messageText = msg.videoMessage.caption;
      }

      // Auto-moderation
      if (
        messageText &&
        hasUnauthorizedContent(messageText) &&
        isModerationEnabled(groupId)
      ) {
        const botAdmin = await isBotAdmin(sock, groupId);
        const senderAdmin = await isUserAdmin(sock, groupId, senderId);

        if (botAdmin && !senderAdmin) {
          console.log("Deleting unauthorized message from:", senderId);
          await deleteMessage(sock, groupId, message.key);

          const senderNumber = senderId.split("@")[0];
          await sock.sendMessage(groupId, {
            text: `⚠️ @${senderNumber} Unauthorized content detected and removed.\nPlease avoid posting unsolicited links or spam.`,
            mentions: [senderId],
          });
        }
      }

      // Check if message is a command
      const hasCommand = messageText.includes("/");

      if (hasCommand) {
        await handleCommand(sock, message);
      } else if (messageText) {
        // Check if bot was mentioned for AI chat
        const mentionedJids =
          msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botMentioned =
          mentionedJids.includes(BOT_JID) ||
          mentionedJids.some((jid) => jid.includes("145874957156514")) ||
          messageText.includes("@145874957156514");

        if (botMentioned && !hasCommand) {
          console.log("Bot mentioned for chat, sending to Groq AI");

          let cleanText = messageText.replace(/@\d+/g, "").trim();

          if (cleanText) {
            try {
              await sock.sendPresenceUpdate("composing", groupId);
              const aiResponse = await chatWithTobias(groupId, cleanText);

              const senderNumber = senderId.split("@")[0];
              await sock.sendMessage(groupId, {
                text: `@${senderNumber} ${aiResponse}`,
                mentions: [senderId],
              });

              await sock.sendPresenceUpdate("paused", groupId);
            } catch (error) {
              console.error("Error in AI chat:", error);
              await sock.sendMessage(groupId, {
                text: "My apologies. I am temporarily unavailable.",
              });
            }
          }
        }
      }
    }
  });
}

// Start the bot
startBot().catch((err) => console.error("Error starting bot:", err));
