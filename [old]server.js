const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode"); // Add this to package.json
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Store QR code data for web endpoint
let currentQRCode = null;
let qrCodeExpiry = null;
let botStatus = {
  connected: false,
  lastActivity: new Date(),
  uptime: 0,
  reconnectCount: 0
};

// Middleware for JSON
app.use(express.json());

// Keep-alive endpoints with variety
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp Bot Status</title>
      <meta http-equiv="refresh" content="30">
      <style>
        body { font-family: Arial; padding: 20px; background: #f5f5f5; }
        .status { padding: 20px; background: white; border-radius: 8px; margin: 10px 0; }
        .connected { color: green; }
        .disconnected { color: red; }
        a { display: inline-block; margin: 10px 0; padding: 10px 20px; background: #25D366; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🤖 WhatsApp Bot Status</h1>
      <div class="status">
        <p>Status: <strong class="${botStatus.connected ? 'connected' : 'disconnected'}">${botStatus.connected ? '✅ Connected' : '❌ Disconnected'}</strong></p>
        <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
        <p>Last Activity: ${botStatus.lastActivity.toLocaleTimeString()}</p>
        <p>Reconnect Count: ${botStatus.reconnectCount}</p>
      </div>
      ${!botStatus.connected ? '<a href="/qr">📱 View QR Code</a>' : ''}
      <a href="/health">🔍 Health Check</a>
    </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  botStatus.lastActivity = new Date();
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    connected: botStatus.connected,
    timestamp: new Date().toISOString(),
    reconnectCount: botStatus.reconnectCount
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
    timestamp: new Date().toISOString()
  });
});

// QR Code endpoint with auto-refresh
app.get("/qr", async (req, res) => {
  botStatus.lastActivity = new Date();
  
  if (botStatus.connected) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bot Already Connected</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
          .message { background: white; padding: 30px; border-radius: 8px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="message">
          <h2>✅ Bot is Already Connected!</h2>
          <p>No QR code needed.</p>
          <a href="/">← Back to Status</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (!currentQRCode) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Waiting for QR Code</title>
        <meta http-equiv="refresh" content="3">
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
          .loading { background: white; padding: 30px; border-radius: 8px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="loading">
          <h2>⏳ Waiting for QR Code...</h2>
          <p>The bot is starting up. Page will auto-refresh.</p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const qrImage = await QRCode.toDataURL(currentQRCode);
    const expiryTime = qrCodeExpiry ? Math.ceil((qrCodeExpiry - Date.now()) / 1000) : 60;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - QR Code</title>
        <meta http-equiv="refresh" content="${expiryTime > 10 ? 30 : 5}">
        <style>
          body { 
            font-family: Arial; 
            text-align: center; 
            padding: 20px; 
            background: #f5f5f5; 
          }
          .container { 
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            display: inline-block; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .qr-image { 
            border: 10px solid #25D366; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .expiry { 
            color: #ff6b6b; 
            font-weight: bold; 
          }
          .instructions { 
            text-align: left; 
            margin: 20px 0; 
            padding: 15px; 
            background: #f8f9fa; 
            border-radius: 8px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 Scan QR Code</h1>
          <img src="${qrImage}" alt="QR Code" class="qr-image" width="300" height="300">
          <p class="expiry">⏱️ Expires in ~${expiryTime} seconds</p>
          <p><small>Page auto-refreshes</small></p>
          
          <div class="instructions">
            <h3>📋 Instructions:</h3>
            <ol>
              <li>Open WhatsApp on your phone</li>
              <li>Tap Menu (⋮) or Settings</li>
              <li>Tap "Linked Devices"</li>
              <li>Tap "Link a Device"</li>
              <li>Scan this QR code</li>
            </ol>
          </div>
          
          <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #25D366; color: white; text-decoration: none; border-radius: 5px;">← Back to Status</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Error generating QR image:", error);
    res.status(500).send("Error generating QR code");
  }
});

// Internal self-ping to prevent sleep (backup mechanism)
let selfPingInterval = null;
function startSelfPing() {
  if (selfPingInterval) return;
  
  selfPingInterval = setInterval(async () => {
    try {
      // Only self-ping if external pings haven't happened recently
      const timeSinceActivity = Date.now() - botStatus.lastActivity.getTime();
      
      if (timeSinceActivity > 5 * 60 * 1000) { // 5 minutes
        console.log("🔄 Self-ping to prevent sleep");
        botStatus.lastActivity = new Date();
        
        // Make internal health check
        await axios.get(`http://localhost:${PORT}/health`).catch(() => {});
      }
    } catch (error) {
      console.error("Self-ping error:", error.message);
    }
  }, 8 * 60 * 1000); // Every 8 minutes
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 QR Code will be available at: http://localhost:${PORT}/qr`);
  console.log(`🔍 Health check at: http://localhost:${PORT}/health`);
  startSelfPing();
});

// Scheduled messages storage
const scheduledMessages = new Map();

// Get random meme
async function getRandomMeme() {
  try {
    const response = await axios.get("https://meme-api.com/gimme");
    return {
      url: response.data.url,
      title: response.data.title,
    };
  } catch (error) {
    console.error("Error fetching meme:", error);
    return null;
  }
}

// Tag all members
async function tagAll(sock, groupId, message = "") {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    const participants = groupMetadata.participants
      .map((p) => p.id)
      .filter((id) => id !== BOT_JID && !id.includes("145874957156514"));

    const text = message || "Attention everyone! 📢";
    let mentionText = text + "\n\n";
    participants.forEach((participant) => {
      const number = participant.split("@")[0];
      mentionText += `@${number} `;
    });

    await sock.sendMessage(groupId, {
      text: mentionText.trim(),
      mentions: participants,
    });
  } catch (error) {
    console.error("Error tagging all:", error);
  }
}

// Schedule message
function scheduleMessage(sock, groupId, message, delayMinutes) {
  const delayMs = delayMinutes * 60 * 1000;
  const scheduleId = Date.now();

  const timeout = setTimeout(async () => {
    await tagAll(sock, groupId, message);
    scheduledMessages.delete(scheduleId);
  }, delayMs);

  scheduledMessages.set(scheduleId, timeout);
  return scheduleId;
}

// Send meme
async function sendMeme(sock, groupId) {
  try {
    const meme = await getRandomMeme();
    if (meme) {
      await sock.sendMessage(groupId, {
        image: { url: meme.url },
        caption: `😂 ${meme.title}`,
      });
    } else {
      await sock.sendMessage(groupId, {
        text: "❌ Could not fetch meme. Try again!",
      });
    }
  } catch (error) {
    console.error("Error sending meme:", error);
  }
}

// Send abuse message
async function sayToUser(sock, groupId, targetJid) {
  try {
    const textMessages = [
      "19 min wale kaale darinde se teri gend marwa dunga! 🙏🏿",
      "chutchamgadar ki shakal ke🗣️",
      "aaja apne lode se teri gend ki gehrai naapu💦",
      "Lodu, muft ke chodu, AUKAAT ME REH SAMJHA😡",
      "tere sir mein negro da lauda fek kar, teri yaddaasht mita dunga🙏🏿",
      "अपना के मूस से चोद लीं🗣️",
      "bkl teri shakal aisi hai jisse GB road ki randi dekhkr wahi thuk de😂",
      "sarso ka tel lagakr tyaar reh chote.....aara hu tere ghar khudai krne👍💦",
      "dalle teri chulbuli gend pr hayabhosda chadha dunga🚴",
    ];

    let audioFiles = [];
    try {
      audioFiles = fs
        .readdirSync(AUDIO_FOLDER)
        .filter((file) => file.toLowerCase().endsWith(".m4a"))
        .map((file) => path.join(AUDIO_FOLDER, file));
    } catch (error) {
      console.log("Error reading audio folder:", error);
    }

    const number = targetJid.split("@")[0];
    const totalOptions = textMessages.length + audioFiles.length;

    if (totalOptions === 0) {
      await sock.sendMessage(groupId, {
        text: `@${number} Hello! 👋`,
        mentions: [targetJid],
      });
      return;
    }

    const randomIndex = Math.floor(Math.random() * totalOptions);

    if (randomIndex < textMessages.length) {
      const randomMessage = textMessages[randomIndex];
      await sock.sendMessage(groupId, {
        text: `@${number} ${randomMessage}`,
        mentions: [targetJid],
      });
    } else {
      const audioIndex = randomIndex - textMessages.length;
      const audioPath = audioFiles[audioIndex];

      console.log("Sending audio file:", path.basename(audioPath));

      await sock.sendMessage(groupId, {
        audio: { url: audioPath },
        mimetype: "audio/mp4",
        ptt: true,
        mentions: [targetJid],
      });

      await sock.sendMessage(groupId, {
        text: `@${number} 🎵`,
        mentions: [targetJid],
      });
    }
  } catch (error) {
    console.error("Error in sayToUser:", error);
  }
}

// Check admin status
async function isUserAdmin(sock, groupId, userId) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    const participant = groupMetadata.participants.find((p) => p.id === userId);
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

async function isBotAdmin(sock, groupId) {
  return await isUserAdmin(sock, groupId, BOT_JID);
}

// Delete message
async function deleteMessage(sock, groupId, messageKey) {
  try {
    await sock.sendMessage(groupId, { delete: messageKey });
    console.log("Message deleted successfully");
  } catch (error) {
    console.error("Error deleting message:", error);
  }
}

// Check unauthorized content
function hasUnauthorizedContent(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-z0-9]+\.(com|net|org|io|co|in|me|xyz|info)[^\s]*)/gi;
  const spamKeywords = [
    "click here", "buy now", "limited offer", "free money",
    "earn money", "work from home", "get rich", "make money online",
  ];

  if (urlPattern.test(text)) {
    console.log("Detected URL in message");
    return true;
  }

  for (const keyword of spamKeywords) {
    if (lowerText.includes(keyword)) {
      console.log("Detected spam keyword:", keyword);
      return true;
    }
  }

  return false;
}

const BOT_JID = "145874957156514@lid";
let botNumber = BOT_JID;

const AUDIO_FOLDER = path.join(__dirname, "audio_files");

if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER);
  console.log("📁 Created audio_files folder.");
}

const MODERATION_ENABLED_GROUPS = [];

const ADMIN_ONLY_COMMANDS = ["/tagall", "/reminder", "/groupid"];
const GENERAL_COMMANDS = ["/help", "/meme", "/abuse"];

const GROUP_COMMAND_CONFIG = {
  "120363344697037274@g.us": {
    allowed: ["/tagall", "/meme", "/abuse", "/help", "/reminder", "/groupid"],
    adminOnly: ["/reminder", "/groupid"],
  },
  "120363420376125136@g.us": {
    allowed: ["/tagall", "/meme", "/abuse", "/help"],
    adminOnly: ["/reminder"],
  },
};

function isModerationEnabled(groupId) {
  if (MODERATION_ENABLED_GROUPS.length === 0) return false;
  return MODERATION_ENABLED_GROUPS.includes(groupId);
}

function isCommandAllowed(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  if (!groupConfig) return GENERAL_COMMANDS.includes(command);
  return groupConfig.allowed.includes(command) || GENERAL_COMMANDS.includes(command);
}

function isAdminRequired(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  if (groupConfig && groupConfig.adminOnly) {
    if (groupConfig.adminOnly.includes(command)) return true;
  }
  return ADMIN_ONLY_COMMANDS.includes(command);
}

function getAllowedCommands(groupId) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  if (!groupConfig) return GENERAL_COMMANDS;
  return [...new Set([...groupConfig.allowed, ...GENERAL_COMMANDS])];
}

function getAdminOnlyCommands(groupId) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  const adminCommands = [];

  if (groupConfig && groupConfig.adminOnly) {
    adminCommands.push(...groupConfig.adminOnly);
  }

  const allowedCommands = getAllowedCommands(groupId);
  ADMIN_ONLY_COMMANDS.forEach((cmd) => {
    if (allowedCommands.includes(cmd) && !adminCommands.includes(cmd)) {
      adminCommands.push(cmd);
    }
  });

  return [...new Set(adminCommands)];
}

// Command handler
async function handleCommand(sock, message) {
  const { key, message: msg } = message;
  const groupId = key.remoteJid;

  let text = "";
  if (msg?.conversation) {
    text = msg.conversation;
  } else if (msg?.extendedTextMessage?.text) {
    text = msg.extendedTextMessage.text;
  } else if (msg?.imageMessage?.caption) {
    text = msg.imageMessage.caption;
  } else if (msg?.videoMessage?.caption) {
    text = msg.videoMessage.caption;
  }

  if (!text) return;

  console.log("Received message:", text);
  console.log("From:", key.participant || key.remoteJid);

  const mentionedJids = msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const botMentioned = mentionedJids.includes(BOT_JID) ||
    mentionedJids.includes(botNumber) ||
    mentionedJids.some((jid) => jid.includes("145874957156514")) ||
    text.includes("@145874957156514");

  console.log("Bot mentioned:", botMentioned);

  const hasCommand = text.includes("/");
  if (!hasCommand) return;

  if (text.includes("@") && !botMentioned) {
    console.log("Bot not mentioned, ignoring");
    return;
  }

  let cleanText = text.replace(/@\d+/g, "").trim();
  const parts = cleanText.split(" ");
  const commandIndex = parts.findIndex((part) => part.startsWith("/"));

  if (commandIndex === -1) return;

  const command = parts[commandIndex];
  const args = parts.slice(commandIndex + 1);

  console.log("Processing command:", command, "with args:", args);

  if (!isCommandAllowed(groupId, command)) {
    await sock.sendMessage(groupId, {
      text: `⛔ *Command Not Available*\n\nThe command ${command} is not available in this group.\n\nUse /help to see available commands.`,
    });
    return;
  }

  if (isAdminRequired(groupId, command)) {
    const senderId = key.participant || key.remoteJid;
    const isAdmin = await isUserAdmin(sock, groupId, senderId);

    if (!isAdmin) {
      await sock.sendMessage(groupId, {
        text: `🔒 *Access Denied*\n\nThe command ${command} is restricted to group admins only.`,
      });
      return;
    }
  }

  switch (command.toLowerCase()) {
    case "/tagall":
      const customMessage = args.join(" ");
      await tagAll(sock, groupId, customMessage);
      break;

    case "/reminder":
      const minutes = parseInt(args[0]);
      const reminderMsg = args.slice(1).join(" ");

      if (isNaN(minutes) || minutes <= 0) {
        await sock.sendMessage(groupId, {
          text: "❌ Usage: /reminder <minutes> <message>\nExample: /reminder 30 Meeting reminder!",
        });
        return;
      }

      scheduleMessage(sock, groupId, reminderMsg, minutes);
      await sock.sendMessage(groupId, {
        text: `✅ Reminder scheduled for ${minutes} minute(s) from now!`,
      });
      break;

    case "/meme":
      await sendMeme(sock, groupId);
      break;

    case "/abuse":
      const targetJids = msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetUsers = targetJids.filter(
        (jid) => jid !== BOT_JID && !jid.includes("145874957156514")
      );

      if (targetUsers.length === 0) {
        await sock.sendMessage(groupId, {
          text: "❌ Usage: @bot /abuse @person\nYou need to tag someone!",
        });
        return;
      }

      await sayToUser(sock, groupId, targetUsers[0]);
      break;

    case "/help":
      const moderationStatus = isModerationEnabled(groupId) ? "✅ Enabled" : "❌ Disabled";
      const senderId = key.participant || key.remoteJid;
      const isUserAdminStatus = await isUserAdmin(sock, groupId, senderId);

      const allowedCommands = getAllowedCommands(groupId);
      const adminOnlyCommands = getAdminOnlyCommands(groupId);
      const publicCommands = allowedCommands.filter(
        (cmd) => !adminOnlyCommands.includes(cmd)
      );

      let helpText = `🤖 *Bot Commands*\n\n` +
        `💡 *Usage:* Mention the bot with a command\n` +
        `Example: @bot /tagall or just /tagall\n\n`;

      if (adminOnlyCommands.length > 0) {
        helpText += `🔒 *Admin Only Commands:*\n`;
        if (adminOnlyCommands.includes("/tagall")) {
          helpText += `📢 /tagall [message] - Tag everyone in the group\n`;
        }
        if (adminOnlyCommands.includes("/reminder")) {
          helpText += `⏰ /reminder <minutes> <message> - Schedule a tagged message\n`;
        }
        helpText += `\n`;
      }

      if (publicCommands.length > 0) {
        helpText += `👥 *Everyone Can Use:*\n`;
        if (publicCommands.includes("/tagall")) {
          helpText += `📢 /tagall [message] - Tag everyone in the group\n`;
        }
        if (publicCommands.includes("/reminder")) {
          helpText += `⏰ /reminder <minutes> <message> - Schedule a tagged message\n`;
        }
        if (publicCommands.includes("/meme")) {
          helpText += `😂 /meme - Get a random meme\n`;
        }
        if (publicCommands.includes("/abuse")) {
          helpText += `💬 /abuse @person - Send abusive message to someone\n`;
        }
        if (publicCommands.includes("/groupid")) {
          helpText += `🆔 /groupid - Get this group's ID\n`;
        }
        if (publicCommands.includes("/help")) {
          helpText += `❓ /help - Show this help message\n`;
        }
        helpText += `\n`;
      }

      helpText += `_Tip: Commands shown are available in this group_\n\n`;

      if (isUserAdminStatus) {
        helpText += `👑 *Your Status:* Admin\n`;
      } else {
        helpText += `👤 *Your Status:* Member\n`;
      }

      helpText += `🛡️ *Auto-Moderation:* ${moderationStatus} for this group\n` +
        `(Removes unauthorized links when bot is admin)`;

      await sock.sendMessage(groupId, { text: helpText });
      break;

    case "/groupid":
      await sock.sendMessage(groupId, {
        text: `🆔 *Group ID:*\n\`${groupId}\`\n\nCopy this to enable moderation in code.`,
      });
      break;
  }
}

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

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR Code generated! Scan with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
      console.log("\nOpen WhatsApp > Settings > Linked Devices > Link a Device");
      console.log(`\n🌐 Or visit: http://localhost:${PORT}/qr\n`);
      
      // Store QR for web endpoint
      currentQRCode = qr;
      qrCodeExpiry = Date.now() + 60000; // 60 seconds
      
      // Clear QR after expiry
      setTimeout(() => {
        if (currentQRCode === qr) {
          currentQRCode = null;
          qrCodeExpiry = null;
        }
      }, 60000);
    }

    if (connection === "close") {
      botStatus.connected = false;
      currentQRCode = null;
      
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        botStatus.reconnectCount++;
        setTimeout(() => startBot(), 5000); // 5 second delay before reconnect
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
      console.log("Bot JID:", BOT_JID);
      console.log("Bot user ID from socket:", sock.user.id);
      
      botStatus.connected = true;
      botStatus.lastActivity = new Date();
      currentQRCode = null;
      qrCodeExpiry = null;

      try {
        const audioFiles = fs
          .readdirSync(AUDIO_FOLDER)
          .filter((f) => f.toLowerCase().endsWith(".m4a"));
        console.log(`🎵 Found ${audioFiles.length} audio file(s) for /abuse command`);
        if (audioFiles.length > 0) {
          console.log("   Files:", audioFiles.join(", "));
        }
      } catch (err) {
        console.log("📁 audio_files folder is empty or not accessible");
      }
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

      if (messageText && hasUnauthorizedContent(messageText) && isModerationEnabled(groupId)) {
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

      await handleCommand(sock, message);
    }
  });
}

// Start the bot
startBot().catch((err) => console.error("Error starting bot:", err));