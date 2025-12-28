// src/commands.js - Command parser and router
const { BOT_JID } = require("./config");
const { isUserAdmin } = require("./utils");
const { isCommandAllowed, isAdminRequired } = require("./commandPermissions");
const {
  handleMeme,
  handleAbuse,
  handleTagAll,
  handleReminder,
  handleHelp,
  handleGroupId,
} = require("./commandHandlers");

// Main command handler
async function handleCommand(sock, message) {
  const { key, message: msg } = message;
  const groupId = key.remoteJid;

  // Extract text from message
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

  // Check if bot was mentioned
  const mentionedJids =
    msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const botMentioned =
    mentionedJids.includes(BOT_JID) ||
    mentionedJids.some((jid) => jid.includes("145874957156514")) ||
    text.includes("@145874957156514");

  console.log("Bot mentioned:", botMentioned);

  // Check if message contains a command
  const hasCommand = text.includes("/");
  if (!hasCommand) return;

  // If there's an @ mention but bot wasn't mentioned, ignore
  if (text.includes("@") && !botMentioned) {
    console.log("Bot not mentioned, ignoring");
    return;
  }

  // Clean up text and extract command
  let cleanText = text.replace(/@\d+/g, "").trim();
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

  // Check if command requires admin privileges
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

  // Route to appropriate handler
  switch (command.toLowerCase()) {
    case "/tagall":
      await handleTagAll(sock, groupId, args);
      break;

    case "/reminder":
      await handleReminder(sock, groupId, args);
      break;

    case "/meme":
      await handleMeme(sock, groupId);
      break;

    case "/abuse":
      const targetJids =
        msg?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetUsers = targetJids.filter(
        (jid) => jid !== BOT_JID && !jid.includes("145874957156514")
      );

      if (targetUsers.length === 0) {
        await sock.sendMessage(groupId, {
          text: "❌ Usage: @bot /abuse @person\nYou need to tag someone!",
        });
        return;
      }

      await handleAbuse(sock, groupId, targetUsers[0]);
      break;

    case "/help":
      const senderId = key.participant || key.remoteJid;
      await handleHelp(sock, groupId, senderId);
      break;

    case "/groupid":
      await handleGroupId(sock, groupId);
      break;
  }
}

module.exports = {
  handleCommand,
};
