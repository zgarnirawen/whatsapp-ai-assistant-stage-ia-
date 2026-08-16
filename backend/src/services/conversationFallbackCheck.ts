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

  console.log("✓ Conversational AI fallback works when GROQ_API_KEY is unavailable");
} finally {
  if (originalApiKey) process.env.GROQ_API_KEY = originalApiKey;
}
