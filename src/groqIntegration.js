// src/groqIntegration.js - Enhanced Groq AI integration
const Groq = require("groq-sdk");
const { getPersonalityForGroup } = require("./personalities");
const { GROQ_MODELS, RATE_LIMIT_THRESHOLD } = require("./config");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

// Conversation history per group
const conversationHistory = new Map();

// Load balancer state (1e)
const modelUsage = new Map(); // Track requests per model per minute
let currentModelIndex = 0;

function getConversationHistory(groupId) {
  if (!conversationHistory.has(groupId)) {
    const personality = getPersonalityForGroup(groupId);
    const history = [{ role: "system", content: personality.systemPrompt }];

    // Add sample Q&As for context
    personality.sampleQAs.forEach((qa) => {
      history.push({ role: "user", content: qa.question });
      history.push({ role: "assistant", content: qa.answer });
    });

    conversationHistory.set(groupId, history);
  }
  return conversationHistory.get(groupId);
}

function addToHistory(groupId, role, content) {
  const history = getConversationHistory(groupId);
  history.push({ role, content });

  // Keep system prompt + samples + last 10 conversation messages
  const systemAndSamples = history.filter(
    (msg) => msg.role === "system" || history.indexOf(msg) < 11
  );
  const recentMessages = history.slice(-10);

  if (history.length > 21) {
    conversationHistory.set(groupId, [...systemAndSamples, ...recentMessages]);
  }
}

// Load balancer: Get best available model (1e)
function getAvailableModel() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Clean old usage data
  modelUsage.forEach((timestamps, model) => {
    const recentRequests = timestamps.filter((t) => t > oneMinuteAgo);
    if (recentRequests.length === 0) {
      modelUsage.delete(model);
    } else {
      modelUsage.set(model, recentRequests);
    }
  });

  // Find model with lowest usage
  let bestModel = GROQ_MODELS[currentModelIndex];
  let lowestUsage = Infinity;

  GROQ_MODELS.forEach((model) => {
    const usage = modelUsage.get(model)?.length || 0;
    if (usage < lowestUsage && usage < RATE_LIMIT_THRESHOLD) {
      lowestUsage = usage;
      bestModel = model;
    }
  });

  // Track this request
  if (!modelUsage.has(bestModel)) {
    modelUsage.set(bestModel, []);
  }
  modelUsage.get(bestModel).push(now);

  console.log(`Using model: ${bestModel} (${lowestUsage} requests/min)`);
  return bestModel;
}

// 1c: Add web search capability hint
function addWebSearchContext(userMessage) {
  const needsWebSearch = userMessage
    .toLowerCase()
    .match(/current|today|latest|recent|news|price|weather|happening|now/i);

  if (needsWebSearch) {
    return (
      userMessage +
      "\n\n[Note: If you need current information, mention that you don't have real-time data and suggest the user check reliable sources.]"
    );
  }
  return userMessage;
}

// 1g: Extract JIDs from mentions
function extractMentionedUsers(userMessage, mentionedJids = []) {
  const mentions = [];
  mentionedJids.forEach((jid) => {
    const number = jid.split("@")[0];
    mentions.push({ jid, number });
  });
  return mentions;
}

// Main chat function
async function chatWithAI(groupId, userMessage, options = {}) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return "Arre yaar, abhi system down hai. Thodi der baad try kar 🙏";
    }

    const personality = getPersonalityForGroup(groupId);
    const history = getConversationHistory(groupId);

    // 1c: Add web search hint
    const enhancedMessage = addWebSearchContext(userMessage);

    // 1g: Add mention context
    if (options.mentions && options.mentions.length > 0) {
      const mentionText = options.mentions
        .map((m) => `@${m.number}`)
        .join(", ");
      addToHistory(
        groupId,
        "user",
        `${enhancedMessage}\n[User mentioned: ${mentionText}]`
      );
    } else {
      addToHistory(groupId, "user", enhancedMessage);
    }

    // 1e: Get best model with load balancing
    const model = getAvailableModel();

    const completion = await groq.chat.completions.create({
      messages: history,
      model: model,
      temperature: 0.8,
      max_tokens: 500,
      compound_custom: {
        tools: {
          enabled_tools: ["web_search", "visit_website"],
        },
      },
    });

    let response =
      completion.choices[0]?.message?.content ||
      "Samajh nahi aaya bhai, dubara bol 🤔";

    // 1g: If response should tag someone, ensure it's formatted
    if (options.targetMention) {
      const targetNumber = options.targetMention.split("@")[0];
      if (!response.includes(`@${targetNumber}`)) {
        response = `@${targetNumber} ${response}`;
      }
    }

    addToHistory(groupId, "assistant", response);

    return response;
  } catch (error) {
    console.error("Groq API error:", error);

    // Try fallback model
    if (
      error.message.includes("rate_limit") ||
      error.message.includes("quota")
    ) {
      currentModelIndex = (currentModelIndex + 1) % GROQ_MODELS.length;
      console.log("Rate limit hit, switching to next model");
      return "Bhai thoda slow kar, bahut requests ho gaye. 2 min wait kar 😅";
    }

    return "Arre yaar kuch technical problem hai. Baad mein baat karte hain 🙏";
  }
}

// Get random joke (1b)
async function getRandomJoke(groupId) {
  try {
    const jokes = [
      "Bhai pata hai? Programmer ki wife ne kaha: 'Sabzi le aao' \nProgrammer: 'Define sabzi' 😂",
      "India mein traffic rules sirf suggestion hote hain, like movie ratings 🚗",
      "Ye WhatsApp groups aur soap operas mein koi farak nahi - drama kabhi khatam nahi hota 📱",
      "Bhai ne bola: 'Netflix and chill?' \nMaine bola: 'Haan lekin AC chala de pehle' 😎",
      "Indian parents: 'Padhai kar lo' \nAlso Indian parents: TV pe full volume pe news dekh rahe 📺",
      "Me: Mom I'm going out \nMom: Ruko beta ye kheer kha lo, ye paratha, ye sabzi... \nMe: Mom I just had lunch \nMom: Toh? 🍛",
      "Salary aa gayi! \nEMI: Allow me to introduce myself 💸",
    ];

    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    return `Joke time! 🎭\n\n${randomJoke}`;
  } catch (error) {
    return null;
  }
}

module.exports = {
  chatWithAI,
  getRandomJoke,
  extractMentionedUsers,
};