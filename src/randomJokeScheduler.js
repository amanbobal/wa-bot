// src/randomJokeScheduler.js - Random joke sender (1b: replaces self-ping)
const { RANDOM_JOKE_CONFIG } = require("./config");
const { getRandomJoke } = require("./groqIntegration");

const scheduledJokes = new Map();

function getRandomInterval() {
  const { minInterval, maxInterval } = RANDOM_JOKE_CONFIG;
  return Math.random() * (maxInterval - minInterval) + minInterval;
}

async function sendRandomJoke(sock, groupId) {
  try {
    const joke = await getRandomJoke(groupId);
    if (joke) {
      await sock.sendMessage(groupId, { text: joke });
      console.log(`📢 Sent random joke to group: ${groupId}`);
    }
  } catch (error) {
    console.error("Error sending random joke:", error);
  }
}

function scheduleNextJoke(sock, groupId) {
  const interval = getRandomInterval();
  const nextJokeTime = new Date(Date.now() + interval);

  console.log(
    `⏰ Next joke for ${groupId} at: ${nextJokeTime.toLocaleTimeString()}`
  );

  const timeout = setTimeout(async () => {
    await sendRandomJoke(sock, groupId);
    scheduleNextJoke(sock, groupId); // Schedule next one
  }, interval);

  scheduledJokes.set(groupId, timeout);
}

function startRandomJokeScheduler(sock) {
  if (!RANDOM_JOKE_CONFIG.enabled) {
    console.log("Random joke scheduler disabled");
    return;
  }

  console.log("🎭 Starting random joke scheduler...");

  RANDOM_JOKE_CONFIG.targetGroups.forEach((groupId) => {
    scheduleNextJoke(sock, groupId);
  });
}

function stopRandomJokeScheduler() {
  scheduledJokes.forEach((timeout, groupId) => {
    clearTimeout(timeout);
    console.log(`Stopped jokes for: ${groupId}`);
  });
  scheduledJokes.clear();
}

module.exports = {
  startRandomJokeScheduler,
  stopRandomJokeScheduler,
};
