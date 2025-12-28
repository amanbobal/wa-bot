// src/moderation.js - Content moderation
const { MODERATION_ENABLED_GROUPS } = require("./config");

// Check for unauthorized content
function hasUnauthorizedContent(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const urlPattern =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-z0-9]+\.(com|net|org|io|co|in|me|xyz|info)[^\s]*)/gi;
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

// Check if moderation is enabled for a group
function isModerationEnabled(groupId) {
  if (MODERATION_ENABLED_GROUPS.length === 0) return false;
  return MODERATION_ENABLED_GROUPS.includes(groupId);
}

module.exports = {
  hasUnauthorizedContent,
  isModerationEnabled,
};
