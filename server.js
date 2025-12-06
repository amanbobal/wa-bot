// server.js
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
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Keep-alive endpoint for Render
app.get("/", (req, res) => {
  res.send("WhatsApp Bot is running!");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Scheduled messages storage (in-memory, resets on restart)
const scheduledMessages = new Map();

// Function to get random meme from API
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

// Tag all members in group
async function tagAll(sock, groupId, message = "") {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    // Filter out the bot itself from participants
    const participants = groupMetadata.participants
      .map((p) => p.id)
      .filter((id) => id !== BOT_JID && !id.includes("145874957156514"));

    const text = message || "Attention everyone! 📢";

    // Create mentions text with @ symbols
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

// Schedule a message
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

// Send meme to group
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

// Send custom message to tagged person
async function sayToUser(sock, groupId, targetJid) {
  try {
    const textMessages = [
      "19 min wale kaale darinde se teri gend marwa dunga! 🙍🏿",
      "chutchamgadar ki shakal ke🗣️",
      "aaja apne lode se teri gend ki gehrai naapu💦",
      "Lodu, muft ke chodu, AUKAAT ME REH SAMJHA😡",
      "tere sir mein negro da lauda fek kar, teri yaddaasht mita dunga🙍🏿",
      "अपना के मूस से चोद लीं🗣️",
      "bkl teri shakal aisi hai jisse GB road ki randi dekhkr wahi thuk de😝",
      "sarso ka tel lagakr tyaar reh chote.....aara hu tere ghar khudai krne🍑💦",
      "dalle teri chulbuli gend pr hayabhosda chadha dunga🚴",
    ];

    // Get all .m4a files from audio_files folder
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

    // Decide randomly: send text message or audio (if audio files exist)
    const totalOptions = textMessages.length + audioFiles.length;

    if (totalOptions === 0) {
      // Fallback if no messages or audio files
      await sock.sendMessage(groupId, {
        text: `@${number} Hello! 👋`,
        mentions: [targetJid],
      });
      return;
    }

    const randomIndex = Math.floor(Math.random() * totalOptions);

    if (randomIndex < textMessages.length) {
      // Send text message
      const randomMessage = textMessages[randomIndex];
      await sock.sendMessage(groupId, {
        text: `@${number} ${randomMessage}`,
        mentions: [targetJid],
      });
    } else {
      // Send audio file
      const audioIndex = randomIndex - textMessages.length;
      const audioPath = audioFiles[audioIndex];

      console.log("Sending audio file:", path.basename(audioPath));

      await sock.sendMessage(groupId, {
        audio: { url: audioPath },
        mimetype: "audio/mp4",
        ptt: true, // Play as voice note
        mentions: [targetJid],
      });

      // Send a text mention along with audio for notification
      await sock.sendMessage(groupId, {
        text: `@${number} 🎵`,
        mentions: [targetJid],
      });
    }
  } catch (error) {
    console.error("Error in sayToUser:", error);
  }
}

// Check if user is admin
async function isUserAdmin(sock, groupId, userId) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    const participant = groupMetadata.participants.find((p) => p.id === userId);
    return (
      participant?.admin === "admin" || participant?.admin === "superadmin"
    );
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Check if bot is admin
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

// Check for unauthorized content
function hasUnauthorizedContent(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // URL patterns
  const urlPattern =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-z0-9]+\.(com|net|org|io|co|in|me|xyz|info)[^\s]*)/gi;

  // Spam keywords
  const spamKeywords = [
    "click here",
    "buy now",
    "limited offer",
    "free money",
    "earn money",
    "work from home",
    "get rich",
    "make money online",
  ];

  // Check for URLs
  if (urlPattern.test(text)) {
    console.log("Detected URL in message");
    return true;
  }

  // Check for spam keywords
  for (const keyword of spamKeywords) {
    if (lowerText.includes(keyword)) {
      console.log("Detected spam keyword:", keyword);
      return true;
    }
  }

  return false;
}

// Get bot's phone number - HARDCODED for reliability
const BOT_JID = "145874957156514@lid"; // Your bot's JID
let botNumber = BOT_JID;

// Audio files folder path
const AUDIO_FOLDER = path.join(__dirname, "audio_files");

// Ensure audio folder exists
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER);
  console.log(
    "📁 Created audio_files folder. Add .m4a files here for /abuse command."
  );
}

// Moderation settings - Add group JIDs where you want auto-moderation
const MODERATION_ENABLED_GROUPS = [
  // Add your group JIDs here - example format:
  // '1234567890-1234567890@g.us',
  // '9876543210-9876543210@g.us',
];

// Admin-only commands - commands that only group admins can use (works in ALL groups)
const ADMIN_ONLY_COMMANDS = [
  "/tagall",
  "/reminder",
  "/groupid",
  // Add more commands here that should be admin-only globally
];

// General commands - Available in ALL groups to everyone
const GENERAL_COMMANDS = [
  "/help",
  "/meme",
  "/abuse",
  // These commands work everywhere
];

// Group-specific command control
// Define which commands are allowed in specific groups
const GROUP_COMMAND_CONFIG = {
  // Sablog wala group:
  "120363344697037274@g.us": {
    allowed: ["/tagall", "/meme", "/abuse", "/help", "/reminder", "/groupid"], // Only these commands work in this group
    adminOnly: ["/reminder", "/groupid"], // These are admin-only in THIS group (overrides global)
  },
  // krishna admin group:
  "120363420376125136@g.us": {
    allowed: ["/tagall", "/meme", "/abuse", "/help"], // Only these commands work in this group
    adminOnly: ["/reminder"], // These are admin-only in THIS group (overrides global)
  },
  // '120363987654321098@g.us': {
  //   allowed: ['/abuse', '/meme', '/reminder'],
  //   adminOnly: ['/reminder'],
  // },
};

// Helper function to check if moderation is enabled for a group
function isModerationEnabled(groupId) {
  if (MODERATION_ENABLED_GROUPS.length === 0) {
    return false;
  }
  return MODERATION_ENABLED_GROUPS.includes(groupId);
}

// Helper function to check if command is allowed in a group
function isCommandAllowed(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];

  // If no specific config for this group, check general commands
  if (!groupConfig) {
    return GENERAL_COMMANDS.includes(command);
  }

  // Check if command is in allowed list for this group
  // OR if it's a general command (general commands work everywhere)
  return (
    groupConfig.allowed.includes(command) || GENERAL_COMMANDS.includes(command)
  );
}

// Helper function to check if command requires admin in a specific group
function isAdminRequired(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];

  // Check group-specific admin requirements first
  if (groupConfig && groupConfig.adminOnly) {
    if (groupConfig.adminOnly.includes(command)) {
      return true;
    }
  }

  // Fall back to global admin-only commands
  return ADMIN_ONLY_COMMANDS.includes(command);
}

// Get all allowed commands for a group
function getAllowedCommands(groupId) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];

  if (!groupConfig) {
    // No specific config, return general commands
    return GENERAL_COMMANDS;
  }

  // Combine group-specific allowed commands with general commands
  const allCommands = [
    ...new Set([...groupConfig.allowed, ...GENERAL_COMMANDS]),
  ];
  return allCommands;
}

// Get admin-only commands for a group
function getAdminOnlyCommands(groupId) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  const adminCommands = [];

  // Add group-specific admin commands
  if (groupConfig && groupConfig.adminOnly) {
    adminCommands.push(...groupConfig.adminOnly);
  }

  // Add global admin commands that are allowed in this group
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

  // Get text from different message types
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

  // Check if bot was mentioned - check multiple places
  const mentionedJids =
    msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  // Also check for @lid format in text
  const botMentioned =
    mentionedJids.includes(BOT_JID) ||
    mentionedJids.includes(botNumber) ||
    mentionedJids.some((jid) => jid.includes("145874957156514")) ||
    text.includes("@145874957156514");

  console.log("Bot mentioned:", botMentioned);
  console.log("Mentioned JIDs:", mentionedJids);
  console.log("Bot JID:", BOT_JID);

  // Check if message contains a command
  const hasCommand = text.includes("/");
  if (!hasCommand) return;

  // If there's an @ mention in the original text but bot wasn't mentioned, ignore
  if (text.includes("@") && !botMentioned) {
    console.log("Bot not mentioned, ignoring");
    return;
  }

  // Clean up the text - remove @mentions to get clean command
  let cleanText = text.replace(/@\d+/g, "").trim();

  // Extract command
  const parts = cleanText.split(" ");
  const commandIndex = parts.findIndex((part) => part.startsWith("/"));

  if (commandIndex === -1) return;

  const command = parts[commandIndex];
  const args = parts.slice(commandIndex + 1);

  console.log("Processing command:", command, "with args:", args);
  console.log("Group ID:", groupId);

  // Check if command is allowed in this group
  if (!isCommandAllowed(groupId, command)) {
    console.log("Command not allowed in this group:", command);
    await sock.sendMessage(groupId, {
      text: `⛔ *Command Not Available*\n\nThe command ${command} is not available in this group.\n\nUse /help to see available commands.`,
    });
    return;
  }

  // Check if command requires admin privileges in this group
  if (isAdminRequired(groupId, command)) {
    const senderId = key.participant || key.remoteJid;
    const isAdmin = await isUserAdmin(sock, groupId, senderId);

    if (!isAdmin) {
      console.log("Non-admin user tried to use admin command:", senderId);
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
      // Usage: /reminder <minutes> <message>
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
      // Get mentioned users from the message
      const targetJids =
        msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      // Filter out the bot from mentions
      const targetUsers = targetJids.filter(
        (jid) => jid !== BOT_JID && !jid.includes("145874957156514")
      );

      if (targetUsers.length === 0) {
        await sock.sendMessage(groupId, {
          text: "❌ Usage: @bot /abuse @person\nYou need to tag someone!",
        });
        return;
      }

      // Send message to first tagged person
      await sayToUser(sock, groupId, targetUsers[0]);
      break;

    case "/help":
      const moderationStatus = isModerationEnabled(groupId)
        ? "✅ Enabled"
        : "❌ Disabled";
      const senderId = key.participant || key.remoteJid;
      const isUserAdminStatus = await isUserAdmin(sock, groupId, senderId);

      // Get allowed commands for this group
      const allowedCommands = getAllowedCommands(groupId);
      const adminOnlyCommands = getAdminOnlyCommands(groupId);
      const publicCommands = allowedCommands.filter(
        (cmd) => !adminOnlyCommands.includes(cmd)
      );

      let helpText =
        `🤖 *Bot Commands*\n\n` +
        `💡 *Usage:* Mention the bot with a command\n` +
        `Example: @bot /tagall or just /tagall\n\n`;

      // Admin commands section (only if there are admin commands allowed in this group)
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

      // Public commands section (only if there are public commands)
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

      // Show user's status
      if (isUserAdminStatus) {
        helpText += `👑 *Your Status:* Admin\n`;
      } else {
        helpText += `👤 *Your Status:* Member\n`;
      }

      helpText +=
        `🛡️ *Auto-Moderation:* ${moderationStatus} for this group\n` +
        `(Removes unauthorized links when bot is admin)`;

      await sock.sendMessage(groupId, {
        text: helpText,
      });
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
      console.log(
        "\nOpen WhatsApp > Settings > Linked Devices > Link a Device"
      );
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);

      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
      console.log("Bot JID (hardcoded):", BOT_JID);
      console.log("Bot user ID from socket:", sock.user.id);

      // Check audio files
      try {
        const audioFiles = fs
          .readdirSync(AUDIO_FOLDER)
          .filter((f) => f.toLowerCase().endsWith(".m4a"));
        console.log(
          `🎵 Found ${audioFiles.length} audio file(s) for /abuse command`
        );
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
      // Only respond in groups
      if (!message.key.remoteJid.endsWith("@g.us")) continue;

      const groupId = message.key.remoteJid;
      const senderId = message.key.participant || message.key.remoteJid;
      const msg = message.message;

      // Get message text for moderation check
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

      // Auto-moderation: Check for unauthorized content
      // Only run moderation if enabled for this group
      if (
        messageText &&
        hasUnauthorizedContent(messageText) &&
        isModerationEnabled(groupId)
      ) {
        const botAdmin = await isBotAdmin(sock, groupId);
        const senderAdmin = await isUserAdmin(sock, groupId, senderId);

        // Only delete if bot is admin and sender is not admin
        if (botAdmin && !senderAdmin) {
          console.log("Deleting unauthorized message from:", senderId);
          await deleteMessage(sock, groupId, message.key);

          // Send warning
          const senderNumber = senderId.split("@")[0];
          await sock.sendMessage(groupId, {
            text: `⚠️ @${senderNumber} Unauthorized content detected and removed.\nPlease avoid posting unsolicited links or spam.`,
            mentions: [senderId],
          });
        }
      }

      // Process commands
      await handleCommand(sock, message);
    }
  });
}

// Start the bot
startBot().catch((err) => console.error("Error starting bot:", err));
