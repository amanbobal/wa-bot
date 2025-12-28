// src/commandPermissions.js - Command permission system
const {
  ADMIN_ONLY_COMMANDS,
  GENERAL_COMMANDS,
  GROUP_COMMAND_CONFIG,
} = require("./config");

// Check if command is allowed in a group
function isCommandAllowed(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  if (!groupConfig) return GENERAL_COMMANDS.includes(command);
  return (
    groupConfig.allowed.includes(command) || GENERAL_COMMANDS.includes(command)
  );
}

// Check if command requires admin in a specific group
function isAdminRequired(groupId, command) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];

  if (groupConfig && groupConfig.adminOnly) {
    if (groupConfig.adminOnly.includes(command)) return true;
  }

  return ADMIN_ONLY_COMMANDS.includes(command);
}

// Get all allowed commands for a group
function getAllowedCommands(groupId) {
  const groupConfig = GROUP_COMMAND_CONFIG[groupId];
  if (!groupConfig) return GENERAL_COMMANDS;
  return [...new Set([...groupConfig.allowed, ...GENERAL_COMMANDS])];
}

// Get admin-only commands for a group
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

module.exports = {
  isCommandAllowed,
  isAdminRequired,
  getAllowedCommands,
  getAdminOnlyCommands,
};
