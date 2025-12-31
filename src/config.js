// src/config.js - Configuration
const path = require("path");

// Bot configuration
const BOT_JID = "145874957156514@lid";
const AUDIO_FOLDER = path.join(__dirname, "..", "audio_files");

// Moderation settings
const MODERATION_ENABLED_GROUPS = [
  // Add your group JIDs here:
  // '1234567890-1234567890@g.us',
];

// Admin-only commands (global)
const ADMIN_ONLY_COMMANDS = ["/reminder", "/groupid"];

// General commands (available everywhere)
const GENERAL_COMMANDS = ["/help", "/meme", "/abuse"];

// Group-specific command configuration
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

module.exports = {
  BOT_JID,
  AUDIO_FOLDER,
  MODERATION_ENABLED_GROUPS,
  ADMIN_ONLY_COMMANDS,
  GENERAL_COMMANDS,
  GROUP_COMMAND_CONFIG,
};
