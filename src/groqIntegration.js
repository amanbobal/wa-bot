// src/groqIntegration.js - Groq AI integration
require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

const TOBIAS_SYSTEM_PROMPT = `You are Tobias Rieper, a professional freelance consultant. You are calm, calculated, and professional. You speak with precision and brevity. You are mysterious yet polite. You maintain plausible deniability about your true nature. Keep responses under 200 words for WhatsApp. Use short, direct sentences. Avoid emotional language. Be helpful but detached.`;

// Conversation history per group (limited to last 10 messages)
const conversationHistory = new Map();

function getConversationHistory(groupId) {
  if (!conversationHistory.has(groupId)) {
    conversationHistory.set(groupId, [
      { role: "system", content: TOBIAS_SYSTEM_PROMPT },
    ]);
  }
  return conversationHistory.get(groupId);
}

function addToHistory(groupId, role, content) {
  const history = getConversationHistory(groupId);
  history.push({ role, content });

  if (history.length > 11) {
    conversationHistory.set(groupId, [history[0], ...history.slice(-10)]);
  }
}

async function chatWithTobias(groupId, userMessage) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return "My apologies. Communication systems are temporarily unavailable.";
    }

    const history = getConversationHistory(groupId);
    addToHistory(groupId, "user", userMessage);

    const completion = await groq.chat.completions.create({
      messages: history,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content || "I see. Noted.";
    addToHistory(groupId, "assistant", response);

    return response;
  } catch (error) {
    console.error("Groq API error:", error);
    return "My apologies. I am temporarily unavailable. Perhaps we can continue this conversation later.";
  }
}

module.exports = {
  chatWithTobias,
};
