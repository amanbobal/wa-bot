// src/utils.js - Utility functions
const { BOT_JID } = require("./config");

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

// Tag all members in group
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

// Schedule a message
const scheduledMessages = new Map();

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

module.exports = {
  isUserAdmin,
  isBotAdmin,
  deleteMessage,
  tagAll,
  scheduleMessage,
};
