// server.js - Enhanced main entry point
require("dotenv").config();
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

// Import modules
const {
  startWebServer,
  updateBotStatus,
  setCurrentQR,
} = require("./src/webServer");
const { handleCommand } = require("./src/commands");
const { chatWithAI, extractMentionedUsers } = require("./src/groqIntegration");
const { deleteMessage, isUserAdmin, isBotAdmin } = require("./src/utils");
const {
  hasUnauthorizedContent,
  isModerationEnabled,
} = require("./src/moderation");
const { startRandomJokeScheduler } = require("./src/randomJokeScheduler");
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
    browser: ["WhatsApp Bot(Beta)", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR Code generated! Scan with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
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

      updateBotStatus({ connected: true });
      setCurrentQR(null);

      // Start random joke scheduler (1b)
      startRandomJokeScheduler(sock);
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
            text: `⚠️ @${senderNumber} Unauthorized content detected and removed.`,
            mentions: [senderId],
          });
        }
      }

      const hasCommand = messageText.includes("/");

      if (hasCommand) {
        await handleCommand(sock, message);
      } else if (messageText) {
        const mentionedJids =
          msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const botMentioned =
          mentionedJids.includes(BOT_JID) ||
          mentionedJids.some((jid) => jid.includes("145874957156514")) ||
          messageText.includes("@145874957156514");

        // 1f: Check if this is a reply to bot's message
        const quotedMessage =
          msg?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedParticipant =
          msg?.extendedTextMessage?.contextInfo?.participant;
        const isReplyToBot =
          quotedParticipant && quotedParticipant.includes("145874957156514");

        if ((botMentioned || isReplyToBot) && !hasCommand) {
          console.log("Bot mentioned/replied to, sending to AI");

          let cleanText = messageText.replace(/@\d+/g, "").trim();

          if (cleanText) {
            try {
              await sock.sendPresenceUpdate("composing", groupId);

              // 1g: Extract mentions for AI context
              const mentions = extractMentionedUsers(cleanText, mentionedJids);

              // 1g: Check if user wants bot to say something to someone
              let targetMention = null;
              const sayToPattern = /say (?:something )?to @?(\d+)/i;
              const match = cleanText.match(sayToPattern);
              if (match && mentionedJids.length > 0) {
                targetMention =
                  mentionedJids.find((jid) => jid.includes(match[1])) ||
                  mentionedJids[0];
              }

              const aiResponse = await chatWithAI(groupId, cleanText, {
                mentions,
                targetMention,
                isReply: isReplyToBot,
              });

              // 1g: Format response with mentions
              const senderNumber = senderId.split("@")[0];
              let responseText = `@${senderNumber} ${aiResponse}`;
              let responseMentions = [senderId];

              if (targetMention) {
                responseMentions.push(targetMention);
              }

              await sock.sendMessage(groupId, {
                text: responseText,
                mentions: responseMentions,
              });

              await sock.sendPresenceUpdate("paused", groupId);
            } catch (error) {
              console.error("Error in AI chat:", error);
              await sock.sendMessage(groupId, {
                text: "Arre yaar technical issue hai, baad mein baat karte hain 🙏",
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
