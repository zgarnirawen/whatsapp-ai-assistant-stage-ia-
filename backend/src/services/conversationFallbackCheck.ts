import { generateConversationalResponse } from "./conversationService.js";

const originalApiKey = process.env.GROQ_API_KEY;

delete process.env.GROQ_API_KEY;

try {
  const frenchFallback = await generateConversationalResponse("je ne comprends pas", {
    intent: "unrecognized",
    intentResult: { intent: "unrecognized", language: "fr", confidence: 0.2 },
  });

  const englishFallback = await generateConversationalResponse("I need help", {
    intent: "unrecognized",
    intentResult: { intent: "unrecognized", language: "en", confidence: 0.2 },
  });

  if (!frenchFallback || !englishFallback) {
    throw new Error("Fallback responses must never be empty");
  }

  console.log("✓ Fallback works when GROQ_API_KEY is unavailable");
} finally {
  if (originalApiKey !== undefined) {
    process.env.GROQ_API_KEY = originalApiKey;
  }
}

// Optional live validation. CI remains offline by default.
if (process.env.RUN_GROQ_LIVE_TEST === "true") {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("RUN_GROQ_LIVE_TEST=true requires GROQ_API_KEY to be supplied through the environment");
  }

  const liveResponse = await generateConversationalResponse("Bonjour, peux-tu m'aider ?", {
    intent: "small_talk",
    intentResult: { intent: "small_talk", language: "fr", confidence: 0.95 },
  });

  if (!liveResponse.trim()) {
    throw new Error("Live Groq response must not be empty");
  }

  console.log("✓ Live Groq conversational response works");
}
