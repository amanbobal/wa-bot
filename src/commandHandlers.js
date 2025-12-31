// src/commandHandlers.js - Individual command implementations
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { AUDIO_FOLDER, BOT_JID } = require("./config");
const { tagAll, scheduleMessage, isUserAdmin } = require("./utils");
const {
  isModerationEnabled,
  getAllowedCommands,
  getAdminOnlyCommands,
} = require("./commandPermissions");

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

// Send meme to group
async function handleMeme(sock, groupId) {
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
async function handleAbuse(sock, groupId, targetJid) {
  try {
    const textMessages = [
      "19 min wale kaale darinde se teri gend marwa dunga! 🙏🏿",
      "chutchamgadar ki shakal ke🗣️",
      "aaja apne lode se teri gend ki gehrai naapu💦",
      "Lodu, muft ke chodu, AUKAAT ME REH SAMJHA😡",
      "tere sir mein negro da lauda fek kar, teri yaddaasht mita dunga🙏🏿",
      "bkl teri shakal aisi hai jisse GB road ki randi dekhkr wahi thuk de😂",
      "sarso ka tel lagakr tyaar reh chote.....aara hu tere ghar khudai krne👍💦",
      "dalle teri chulbuli gend pr hayabhosda chadha dunga🚴",
      "Chudi hui chipkali ki choot ke jhaat ke pasine🖕",
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
    console.error("Error in handleAbuse:", error);
  }
}

// Handle tagall command
async function handleTagAll(sock, groupId, args) {
  const customMessage = args.join(" ");
  await tagAll(sock, groupId, customMessage);
}

// Handle reminder command
async function handleReminder(sock, groupId, args) {
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
}

// Handle help command
async function handleHelp(sock, groupId, senderId) {
  const moderationStatus = isModerationEnabled(groupId)
    ? "✅ Enabled"
    : "❌ Disabled";
  const isUserAdminStatus = await isUserAdmin(sock, groupId, senderId);

  const allowedCommands = getAllowedCommands(groupId);
  const adminOnlyCommands = getAdminOnlyCommands(groupId);
  const publicCommands = allowedCommands.filter(
    (cmd) => !adminOnlyCommands.includes(cmd)
  );

  let helpText = `🤖 *Bot Commands*\n\n💡 *Usage:* Mention bot with command or just use command\n\n`;

  if (adminOnlyCommands.length > 0) {
    helpText += `🔒 *Admin Only:*\n`;
    if (adminOnlyCommands.includes("/tagall"))
      helpText += `📢 /tagall [msg] - Tag everyone\n`;
    if (adminOnlyCommands.includes("/reminder"))
      helpText += `⏰ /reminder <min> <msg> - Schedule reminder\n`;
    if (adminOnlyCommands.includes("/groupid"))
      helpText += `🆔 /groupid - Get group ID\n`;
    helpText += `\n`;
  }

  if (publicCommands.length > 0) {
    helpText += `👥 *Everyone:*\n`;
    if (publicCommands.includes("/tagall"))
      helpText += `📢 /tagall [msg] - Tag everyone\n`;
    if (publicCommands.includes("/reminder"))
      helpText += `⏰ /reminder <min> <msg> - Schedule reminder\n`;
    if (publicCommands.includes("/meme"))
      helpText += `😂 /meme - Random meme\n`;
    if (publicCommands.includes("/abuse"))
      helpText += `💬 /abuse @person - Roast someone\n`;
    if (publicCommands.includes("/groupid"))
      helpText += `🆔 /groupid - Get group ID\n`;
    if (publicCommands.includes("/help")) helpText += `❓ /help - Show this\n`;
    helpText += `\n`;
  }

  helpText += `💬 *AI Chat:* Tag bot without command for conversation\n\n`;
  helpText += `👤 *Your Status:* ${
    isUserAdminStatus ? "Admin 👑" : "Member"
  }\n`;
  helpText += `🛡️ *Moderation:* ${moderationStatus}`;

  await sock.sendMessage(groupId, { text: helpText });
}

// Handle groupid command
async function handleGroupId(sock, groupId) {
  await sock.sendMessage(groupId, {
    text: `🆔 *Group ID:*\n\`${groupId}\`\n\nCopy this to enable moderation.`,
  });
}

module.exports = {
  handleMeme,
  handleAbuse,
  handleTagAll,
  handleReminder,
  handleHelp,
  handleGroupId,
};
