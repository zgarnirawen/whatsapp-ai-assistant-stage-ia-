import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const INTENT_CONFIDENCE_THRESHOLD = 0.6;

export type DetectedIntent =
  | "create_task" | "create_event" | "modify_task" | "delete_task" | "modify_event" | "delete_event"
  | "summarize_period" | "greeting" | "farewell" | "thanks" | "small_talk" | "capabilities" | "unrecognized";

export interface IntentResult {
  intent: DetectedIntent;
  language?: "fr" | "en";
  confidence?: number;
  taskTitle?: string;
  eventTitle?: string;
  eventDateTime?: string;
  durationMinutes?: number;
  contactName?: string;
  summaryPeriodStart?: string;
  summaryPeriodEnd?: string;
  summaryScope?: 'tasks' | 'events' | 'both';
  summaryDates?: string[];
  targetTitleQuery?: string;
  newTaskTitle?: string;
  newEventTitle?: string;
  newEventDateTime?: string;
}

/** Normalizes optional entities before they reach the proposal UI. */
export function normalizeActionEntities(result: IntentResult): IntentResult {
  const normalized = { ...result };
  if (normalized.contactName) normalized.contactName = normalized.contactName.trim().replace(/\s+/g, ' ');
  if (normalized.durationMinutes !== undefined) {
    const duration = Number(normalized.durationMinutes);
    normalized.durationMinutes = Number.isFinite(duration) && duration > 0 && duration <= 1440 ? Math.round(duration) : undefined;
  }
  return normalized;
}

const tools: Groq.Chat.Completions.ChatCompletionTool[] = [{
  type: "function",
  function: {
    name: "classify_intent",
    description: "Classify the user's message into a supported intent, extract relevant action entities, and provide a confidence score from 0 to 1.",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["create_task","create_event","summarize_period","modify_task","delete_task","modify_event","delete_event","greeting","farewell","thanks","small_talk","capabilities","unrecognized"] },
        language: { type: "string", enum: ["fr", "en"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        taskTitle: { type: "string", description: "Title/name of the task, only if intent is create_task." },
        targetTitleQuery: { type: "string", description: "Only for modify/delete intents. The title or description used to refer to the existing item." },
        newTaskTitle: { type: "string", description: "Only for modify_task. The new task title, if provided." },
        newEventTitle: { type: "string", description: "Only for modify_event. The new event title, if provided." },
        newEventDateTime: { type: "string", description: "Only for modify_event. New event date/time in ISO 8601, if provided." },
        eventTitle: { type: "string", description: "Title/name of the event or appointment, only if intent is create_event." },
        eventDateTime: { type: "string", description: "ISO 8601 date/time if mentioned or inferable, only if intent is create_event." },
        durationMinutes: { type: "integer", minimum: 1, maximum: 1440, description: "Duration normalized to minutes. Examples: 30 minutes=30, 1 hour=60, 1h30=90. Omit when absent." },
        contactName: { type: "string", description: "Person/contact explicitly associated with the task or event. Extract only the stated name; never invent contact data." },
        summaryPeriodStart: { type: "string" },
        summaryPeriodEnd: { type: "string" },
        summaryScope: { type: "string", enum: ["tasks", "events", "both"] },
        summaryDates: { type: "array", items: { type: "string" } },
      },
      required: ["intent", "language", "confidence"],
    },
  },
];

export async function detectIntent(inputText: string): Promise<IntentResult> {
  const today = new Date().toISOString().split("T")[0];
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `You are an intent classifier for a productivity assistant. Today's date is ${today} (${new Date().toLocaleDateString('fr-FR', { weekday: 'long' })}).

Be flexible with casual speech, typos, abbreviations and voice-to-text errors. Extract action entities whenever explicitly present. Never invent a contact, duration, date, or name. Normalize durations to minutes (30 minutes=30, 1 hour=60, 1h30=90). For contacts, return only the person's stated name, never a phone number or other contact data.

Supported intents: greeting, farewell, thanks, small_talk, capabilities, create_task, create_event, modify_task, delete_task, modify_event, delete_event, summarize_period, unrecognized.
For valid informal requests, use the closest intent and confidence >=0.7 when meaning is reasonably clear. Use <0.6 only when genuinely unclear. Always call classify_intent.
Examples: "n'oublie pas d'appeler sam" -> create_task + contactName="sam"; "rdv avec Sara demain pendant 1h30" -> create_event + contactName="Sara" + durationMinutes=90; "réunion avec Nadia pour 45 minutes" -> create_event + contactName="Nadia" + durationMinutes=45; "qu'est-ce que j'ai cette semaine" -> summarize_period; "il fait combien dehors" -> unrecognized.` },
      { role: "user", content: inputText },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "classify_intent" } },
  });
  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { intent: "unrecognized", confidence: 0 };
  try {
    const args = JSON.parse(toolCall.function.arguments) as IntentResult;
    const confidence = Math.max(0, Math.min(1, Number(args.confidence)));
    if (!Number.isFinite(confidence) || confidence < INTENT_CONFIDENCE_THRESHOLD) return { intent: "unrecognized", language: args.language, confidence: Number.isFinite(confidence) ? confidence : 0 };
    return normalizeActionEntities({ ...args, confidence });
  } catch {
    return { intent: "unrecognized", confidence: 0 };
  }
}
