import Groq from "groq-sdk";
import type { DetectedIntent, IntentResult } from "./intentDetection.js";

const MODEL = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
const REQUEST_TIMEOUT_MS = 10_000;

type ConversationContext = {
  intent: DetectedIntent;
  intentResult?: IntentResult;
  tasksCount?: number;
  eventsCount?: number;
  hasPendingAction?: boolean;
};

const FALLBACKS = {
  fr: "Je peux vous aider avec vos tâches, votre agenda et vos résumés. Pouvez-vous reformuler votre demande ?",
  en: "I can help with your tasks, calendar, and summaries. Could you rephrase your request?",
} as const;

function detectLanguage(result?: IntentResult): "fr" | "en" {
  return result?.language === "en" ? "en" : "fr";
}

function buildSystemPrompt(language: "fr" | "en") {
  return language === "fr"
    ? `Tu es l'assistant professionnel intégré à une application de productivité. Tu aides l'utilisateur avec ses tâches, son agenda et ses résumés.

Règles:
- Réponds en français, sauf si l'utilisateur parle anglais.
- Sois bref, clair, professionnel et naturel (2 à 4 phrases maximum).
- Utilise uniquement le contexte fourni; n'invente jamais de tâches, événements, fichiers ou résultats.
- Pour une demande hors périmètre, explique brièvement ce que tu peux faire et propose une reformulation.
- Ne prétends jamais avoir effectué une action qui nécessite une confirmation ou un outil.
- Ne donne pas de détails techniques sur le fonctionnement interne du modèle.`
    : `You are the professional assistant embedded in a productivity application. You help the user with tasks, calendar events, and summaries.

Rules:
- Reply in English unless the user speaks French.
- Be concise, clear, professional, and natural (2 to 4 sentences maximum).
- Use only the supplied context; never invent tasks, events, files, or results.
- For out-of-scope requests, briefly explain what you can do and suggest a reformulation.
- Never claim an action was completed when it requires confirmation or a tool.
- Do not expose internal model or implementation details.`;
}

export async function generateConversationalResponse(
  inputText: string,
  context: ConversationContext,
): Promise<string> {
  const language = detectLanguage(context.intentResult);
  const fallback = FALLBACKS[language];

  if (!process.env.GROQ_API_KEY) {
    return fallback;
  }

  const contextPayload = JSON.stringify({
    intent: context.intent,
    detectedDetails: context.intentResult ?? null,
    tasksCount: context.tasksCount ?? null,
    eventsCount: context.eventsCount ?? null,
    hasPendingAction: context.hasPendingAction ?? false,
  });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 180,
        messages: [
          { role: "system", content: buildSystemPrompt(language) },
          {
            role: "user",
            content: `Utilisateur: ${inputText}\n\nContexte de l'application (données structurées): ${contextPayload}`,
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Conversational AI request timed out")), REQUEST_TIMEOUT_MS),
      ),
    ]);

    const content = completion.choices[0]?.message?.content?.trim();
    return content || fallback;
  } catch (error) {
    console.error("Conversational AI unavailable:", error);
    return fallback;
  }
}
