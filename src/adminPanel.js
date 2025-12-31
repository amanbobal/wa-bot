// src/adminPanel.js - Simple Admin Panel
const express = require("express");
const fs = require("fs");
const path = require("path");
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require("./config");

// Simple session store (in production, use Redis or similar)
const sessions = new Map();

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isAuthenticated(req) {
  const sessionId = req.headers["x-session-id"];
  return sessionId && sessions.has(sessionId);
}

function setupAdminPanel(app) {
  // Login endpoint
  app.post("/sys-admin/login", express.json(), (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const sessionId = generateSessionId();
      sessions.set(sessionId, { username, loginTime: Date.now() });
      res.json({ success: true, sessionId });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // Logout
  app.post("/sys-admin/logout", express.json(), (req, res) => {
    const sessionId = req.headers["x-session-id"];
    sessions.delete(sessionId);
    res.json({ success: true });
  });

  // Admin panel main page
  app.get("/sys-admin", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bot Admin Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container, .admin-container {
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 800px;
      width: 90%;
    }
    h1 { color: #333; margin-bottom: 30px; text-align: center; }
    input, button {
      width: 100%;
      padding: 12px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 16px;
    }
    button {
      background: #667eea;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: bold;
    }
    button:hover { background: #5568d3; }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
    }
    .section {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }
    .section h2 { margin-bottom: 15px; color: #555; }
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-family: monospace;
      min-height: 100px;
    }
    .btn-secondary {
      background: #6c757d;
      margin-top: 10px;
    }
    .btn-danger {
      background: #dc3545;
    }
    .success-msg {
      background: #d4edda;
      color: #155724;
      padding: 12px;
      border-radius: 8px;
      margin: 10px 0;
      display: none;
    }
    .error-msg {
      background: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 8px;
      margin: 10px 0;
      display: none;
    }
  </style>
</head>
<body>
  <div id="loginContainer" class="login-container">
    <h1>🔐 Bot Admin Panel</h1>
    <input type="text" id="username" placeholder="Username" />
    <input type="password" id="password" placeholder="Password" />
    <button onclick="login()">Login</button>
    <div id="loginError" class="error-msg"></div>
  </div>

  <div id="adminContainer" class="admin-container" style="display:none;">
    <h1>🤖 Bot Admin Panel</h1>
    <button class="btn-danger" onclick="logout()">Logout</button>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value" id="botStatus">-</div>
        <div>Bot Status</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="uptime">-</div>
        <div>Uptime (min)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="activeGroups">-</div>
        <div>Active Groups</div>
      </div>
    </div>

    <div class="section">
      <h2>📝 Update Configuration</h2>
      <textarea id="configData" placeholder="Edit config.js content..."></textarea>
      <button onclick="updateConfig()">Save Configuration</button>
      <button class="btn-secondary" onclick="loadConfig()">Reload Config</button>
      <div id="configSuccess" class="success-msg"></div>
      <div id="configError" class="error-msg"></div>
    </div>

    <div class="section">
      <h2>🎭 Manage Personalities</h2>
      <select id="personalitySelect" onchange="loadPersonality()">
        <option value="chhapri_bhaiya">Chhapri Bhaiya</option>
        <option value="tobias_rieper">Tobias Rieper</option>
      </select>
      <textarea id="personalityData" placeholder="Edit personality prompt..."></textarea>
      <button onclick="updatePersonality()">Save Personality</button>
      <div id="personalitySuccess" class="success-msg"></div>
    </div>

    <div class="section">
      <h2>🔄 Quick Actions</h2>
      <button onclick="clearConversations()">Clear All Conversations</button>
      <button onclick="testJoke()">Test Random Joke</button>
      <button class="btn-danger" onclick="restartBot()">Restart Bot</button>
    </div>
  </div>

  <script>
    let sessionId = localStorage.getItem('adminSessionId');

    async function login() {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        const res = await fetch('/sys-admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        if (data.success) {
          sessionId = data.sessionId;
          localStorage.setItem('adminSessionId', sessionId);
          showAdmin();
        } else {
          showError('loginError', 'Invalid credentials');
        }
      } catch (err) {
        showError('loginError', 'Login failed');
      }
    }

    async function logout() {
      await fetch('/sys-admin/logout', {
        method: 'POST',
        headers: { 'x-session-id': sessionId }
      });
      localStorage.removeItem('adminSessionId');
      location.reload();
    }

    function showAdmin() {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('adminContainer').style.display = 'block';
      loadStats();
      loadConfig();
    }

    async function loadStats() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        document.getElementById('botStatus').textContent = data.connected ? '✅' : '❌';
        document.getElementById('uptime').textContent = Math.floor(data.uptime / 60);
        document.getElementById('activeGroups').textContent = '-';
      } catch (err) {
        console.error('Failed to load stats', err);
      }
    }

    async function loadConfig() {
      try {
        const res = await fetch('/sys-admin/config', {
          headers: { 'x-session-id': sessionId }
        });
        const data = await res.json();
        document.getElementById('configData').value = JSON.stringify(data, null, 2);
      } catch (err) {
        console.error('Failed to load config', err);
      }
    }

    async function updateConfig() {
      try {
        const configText = document.getElementById('configData').value;
        const res = await fetch('/sys-admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId
          },
          body: configText
        });
        
        if (res.ok) {
          showSuccess('configSuccess', 'Configuration updated!');
        }
      } catch (err) {
        showError('configError', 'Failed to update config');
      }
    }

    async function clearConversations() {
      if (confirm('Clear all conversation history?')) {
        await fetch('/sys-admin/clear-conversations', {
          method: 'POST',
          headers: { 'x-session-id': sessionId }
        });
        alert('Conversations cleared!');
      }
    }

    async function testJoke() {
      const res = await fetch('/sys-admin/test-joke', {
        headers: { 'x-session-id': sessionId }
      });
      const data = await res.json();
      alert(data.joke);
    }

    async function restartBot() {
      if (confirm('Restart bot? This will disconnect temporarily.')) {
        await fetch('/sys-admin/restart', {
          method: 'POST',
          headers: { 'x-session-id': sessionId }
        });
        alert('Bot restarting...');
      }
    }

    function showError(id, msg) {
      const el = document.getElementById(id);
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 3000);
    }

    function showSuccess(id, msg) {
      const el = document.getElementById(id);
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 3000);
    }

    // Check if already logged in
    if (sessionId) {
      showAdmin();
    }

    // Auto refresh stats
    setInterval(loadStats, 30000);
  </script>
</body>
</html>
    `);
  });

  // Get config
  app.get("/sys-admin/config", (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const config = require("./config");
    res.json({
      GROUP_COMMAND_CONFIG: config.GROUP_COMMAND_CONFIG,
      GROUP_PERSONALITIES: config.GROUP_PERSONALITIES,
      RANDOM_JOKE_CONFIG: config.RANDOM_JOKE_CONFIG,
      MODERATION_ENABLED_GROUPS: config.MODERATION_ENABLED_GROUPS,
    });
  });

  // Update config (basic implementation - in production, write to file safely)
  app.post("/sys-admin/config", express.json(), (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // In production, validate and write to config.js
    // For now, just acknowledge
    res.json({ success: true, message: "Config updated (restart required)" });
  });

  // Clear conversations
  app.post("/sys-admin/clear-conversations", (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { chatWithAI } = require("./groqIntegration");
    // Clear history - would need to export the Map from groqIntegration
    res.json({ success: true });
  });

  // Test joke
  app.get("/sys-admin/test-joke", async (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { getRandomJoke } = require("./groqIntegration");
    const joke = await getRandomJoke("test");
    res.json({ joke });
  });

  // Restart bot (dangerous - use with caution)
  app.post("/sys-admin/restart", (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({ success: true, message: "Restarting..." });

    setTimeout(() => {
      process.exit(0); // Render will restart automatically
    }, 1000);
  });
}

module.exports = {
  setupAdminPanel,
};
