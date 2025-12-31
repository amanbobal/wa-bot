// src/config.js - Enhanced Configuration
const path = require("path");

// Bot configuration
const BOT_JID = "145874957156514@lid";
const AUDIO_FOLDER = path.join(__dirname, "..", "audio_files");

// Admin panel credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme123";

// Moderation settings
const MODERATION_ENABLED_GROUPS = [];

// Admin-only commands (global)
const ADMIN_ONLY_COMMANDS = ["/tagall", "/reminder", "/groupid"];

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

// AI Personalities per group (1d: Multiple personalities)
const GROUP_PERSONALITIES = {
  default: "chhapri_bhaiya", // Default for all groups
  // "120363344697037274@g.us": "tobias_rieper",
  // "120363420376125136@g.us": "chhapri_bhaiya",
};

// Random joke settings (1b: Random jokes instead of self-ping)
const RANDOM_JOKE_CONFIG = {
  enabled: true,
  minInterval: 2 * 60 * 60 * 1000, // 2 hours
  maxInterval: 6 * 60 * 60 * 1000, // 6 hours
  targetGroups: [
    "120363344697037274@g.us",
    "120363420376125136@g.us"
    // Add groups where you want random jokes
  ],
};

// Groq Models for load balancing (1e: Load balancer)
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "groq/compound",
  "groq/compound-mini",
];

// Rate limit thresholds (requests per minute)
const RATE_LIMIT_THRESHOLD = 25; // Switch model after this many requests per minute

module.exports = {
  BOT_JID,
  AUDIO_FOLDER,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  MODERATION_ENABLED_GROUPS,
  ADMIN_ONLY_COMMANDS,
  GENERAL_COMMANDS,
  GROUP_COMMAND_CONFIG,
  GROUP_PERSONALITIES,
  RANDOM_JOKE_CONFIG,
  GROQ_MODELS,
  RATE_LIMIT_THRESHOLD,
};