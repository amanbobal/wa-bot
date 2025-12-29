// Railway Keep-Alive Pinger with Random Intervals
const axios = require("axios");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3001;

// Your Render app URL
const TARGET_URL = process.env.TARGET_URL || "https://your-app.onrender.com";

const ENDPOINTS = ["/health", "/status", "/ping", "/"];

// Get random interval between 4-14 minutes (in milliseconds)
function getRandomInterval() {
  const minMinutes = 4;
  const maxMinutes = 14;
  const randomMinutes = Math.random() * (maxMinutes - minMinutes) + minMinutes;
  const milliseconds = randomMinutes * 60 * 1000;

  console.log(`⏰ Next ping scheduled in ${randomMinutes.toFixed(2)} minutes`);
  return milliseconds;
}

// Get random endpoint
function getRandomEndpoint() {
  return ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
}

// Statistics
let stats = {
  totalPings: 0,
  successfulPings: 0,
  failedPings: 0,
  lastPingTime: null,
  lastPingStatus: null,
  nextPingIn: null,
  startTime: new Date(),
};

// Ping function
async function pingTarget() {
  const endpoint = getRandomEndpoint();
  const url = `${TARGET_URL}${endpoint}`;

  try {
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Railway-Keep-Alive-Bot/1.0",
      },
    });

    const responseTime = Date.now() - startTime;

    stats.totalPings++;
    stats.successfulPings++;
    stats.lastPingTime = new Date();
    stats.lastPingStatus = "success";

    console.log(
      `✅ [${new Date().toISOString()}] Pinged ${endpoint} - Status: ${
        response.status
      } - Response Time: ${responseTime}ms`
    );
  } catch (error) {
    stats.totalPings++;
    stats.failedPings++;
    stats.lastPingTime = new Date();
    stats.lastPingStatus = "failed";

    console.error(
      `❌ [${new Date().toISOString()}] Failed to ping ${endpoint} - Error: ${
        error.message
      }`
    );
  }
}

// Schedule next ping with random interval
function scheduleNextPing() {
  const interval = getRandomInterval();
  stats.nextPingIn = new Date(Date.now() + interval);

  setTimeout(async () => {
    await pingTarget();
    scheduleNextPing(); // Schedule next one
  }, interval);
}

// Start pinging
async function startPinger() {
  console.log("🚀 Railway Keep-Alive Pinger Started!");
  console.log(`🎯 Target: ${TARGET_URL}`);
  console.log(`⏱️  Interval: Random between 4-14 minutes`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log("─".repeat(50));

  // First ping immediately
  await pingTarget();

  // Schedule subsequent pings
  scheduleNextPing();
}

// Express endpoints for monitoring
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  const successRate =
    stats.totalPings > 0
      ? ((stats.successfulPings / stats.totalPings) * 100).toFixed(2)
      : 0;

  const nextPingMinutes = stats.nextPingIn
    ? ((stats.nextPingIn.getTime() - Date.now()) / 60000).toFixed(2)
    : "Calculating...";

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Railway Keep-Alive Monitor</title>
      <meta http-equiv="refresh" content="30">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          margin: 0;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
          font-size: 2.5em;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .stat-card {
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 15px;
          text-align: center;
        }
        .stat-value {
          font-size: 2em;
          font-weight: bold;
          margin: 10px 0;
        }
        .stat-label {
          font-size: 0.9em;
          opacity: 0.8;
        }
        .status {
          text-align: center;
          padding: 20px;
          margin: 20px 0;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 15px;
        }
        .success { color: #4ade80; }
        .failed { color: #f87171; }
        .target {
          text-align: center;
          margin: 20px 0;
          padding: 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          word-break: break-all;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          opacity: 0.7;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 Railway Keep-Alive Monitor</h1>
        
        <div class="target">
          <strong>Target:</strong> ${TARGET_URL}
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Total Pings</div>
            <div class="stat-value">${stats.totalPings}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Successful</div>
            <div class="stat-value success">${stats.successfulPings}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Failed</div>
            <div class="stat-value failed">${stats.failedPings}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Success Rate</div>
            <div class="stat-value">${successRate}%</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">${Math.floor(uptime / 60)}m</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-label">Next Ping In</div>
            <div class="stat-value">${nextPingMinutes}m</div>
          </div>
        </div>
        
        <div class="status">
          <h3>Last Ping Status</h3>
          <p class="${
            stats.lastPingStatus === "success" ? "success" : "failed"
          }">
            ${stats.lastPingStatus === "success" ? "✅ Success" : "❌ Failed"}
          </p>
          <p><small>${
            stats.lastPingTime
              ? stats.lastPingTime.toLocaleString()
              : "Not yet pinged"
          }</small></p>
        </div>
        
        <div class="footer">
          🤖 Keeping your Render app alive with random intervals (4-14 min)<br>
          Page auto-refreshes every 30 seconds
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get("/stats", (req, res) => {
  res.json({
    ...stats,
    uptime: Math.floor((Date.now() - stats.startTime.getTime()) / 1000),
    successRate:
      stats.totalPings > 0
        ? ((stats.successfulPings / stats.totalPings) * 100).toFixed(2)
        : 0,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "railway-pinger",
    uptime: process.uptime(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`📡 Monitor server running on port ${PORT}`);
  startPinger();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 Shutting down gracefully...");
  process.exit(0);
});
