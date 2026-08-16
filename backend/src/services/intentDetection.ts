import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const INTENT_CONFIDENCE_THRESHOLD = 0.6;

export type DetectedIntent =
  | "create_task"
  | "create_event"
  | "modify_task"
  | "delete_task"
  | "modify_event"
  | "delete_event"
  | "summarize_period"
  | "greeting"
  | "farewell"
  | "thanks"
  | "small_talk"
  | "capabilities"
  | "unrecognized";

export interface IntentResult {
  intent: DetectedIntent;
  language?: "fr" | "en";
  confidence?: number;
  taskTitle?: string;
  eventTitle?: string;
  eventDateTime?: string;
  summaryPeriodStart?: string;
  summaryPeriodEnd?: string;
  summaryScope?: 'tasks' | 'events' | 'both';
  summaryDates?: string[];
  targetTitleQuery?: string;
  newTaskTitle?: string;
  newEventTitle?: string;
  newEventDateTime?: string;
}

const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "classify_intent",
      description:
        "Classify the user's message into one of the supported assistant intents, extract relevant details, and provide a confidence score from 0 to 1.",
      parameters: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: [
              "create_task",
              "create_event",
              "summarize_period",
              "modify_task",
              "delete_task",
              "modify_event",
              "delete_event",
              "greeting",
              "farewell",
              "thanks",
              "small_talk",
              "capabilities",
              "unrecognized",
            ],
            description:
              "The detected intent. Use 'unrecognized' for genuinely off-topic, impossible to interpret, or very low-confidence requests.",
          },
          language: {
            type: "string",
            enum: ["fr", "en"],
            description: "The language the user's message is written in, detected from the wording itself",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence in the selected intent, from 0 to 1. Use a lower value when the wording is ambiguous or the intent is unclear.",
          },
          taskTitle: {
            type: "string",
            description: "Title of the task, only if intent is create_task.",
          },
          targetTitleQuery: {
            type: "string",
            description:
              "Only for modify_task, delete_task, modify_event, delete_event. The title or description the user used to refer to the item they want to modify/delete.",
          },
          newTaskTitle: {
            type: "string",
            description: "Only for modify_task. The new title for the task, if the user wants to rename it.",
          },
          newEventTitle: {
            type: "string",
            description: "Only for modify_event. The new title for the event, if provided.",
          },
          newEventDateTime: {
            type: "string",
            description: "Only for modify_event. The new date/time for the event, ISO 8601, if provided.",
          },
          eventTitle: {
            type: "string",
            description: "Title of the event/appointment, only if intent is create_event.",
          },
          eventDateTime: {
            type: "string",
            description: "ISO 8601 date/time if mentioned or inferable, only if intent is create_event.",
          },
          summaryPeriodStart: {
            type: "string",
            description: "ISO 8601 start date, only if intent is summarize_period.",
          },
          summaryPeriodEnd: {
            type: "string",
            description: "ISO 8601 end date, only if intent is summarize_period.",
          },
          summaryScope: {
            type: "string",
            enum: ["tasks", "events", "both"],
            description: "Only for summarize_period. What the user wants summarized: tasks, events, or both.",
          },
          summaryDates: {
            type: "array",
            items: { type: "string" },
            description: "Only for summarize_period, when multiple specific non-contiguous days are mentioned.",
          },
        },
        required: ["intent", "language", "confidence"],
      },
    },
  },
];

export async function detectIntent(inputText: string): Promise<IntentResult> {
  const today = new Date().toISOString().split("T")[0];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an intent classifier for a voice/text assistant embedded in a productivity app (tasks, agenda, calls, files). Today's date is ${today} (${new Date().toLocaleDateString('fr-FR', { weekday: 'long' })}).

Be GENEROUS and FLEXIBLE with valid productivity requests. Real users speak casually, with typos, missing words, abbreviations, and voice-to-text errors. Do not require exact or grammatically perfect phrasing.

Supported intents:
- greeting: salutations such as "bonjour", "salut", "coucou", "hey".
- farewell: goodbyes such as "au revoir", "bye", "à plus".
- thanks: expressions of gratitude such as "merci".
- small_talk: casual conversation such as "ça va ?".
- capabilities: questions about what the assistant can do.
- create_task: requests to create/add/remind a task.
- create_event: requests to schedule/create an appointment or event.
- modify_task/delete_task/modify_event/delete_event: requests to change or remove an existing item.
- summarize_period: requests for tasks/events/planning summaries.
- unrecognized: genuinely off-topic requests, gibberish, or messages whose intended action cannot reasonably be determined.

For valid but informal requests, prefer the closest supported intent and give a confidence of at least 0.7 when the meaning is reasonably clear. Give confidence below 0.6 only when the intent is genuinely unclear. Always call classify_intent.

Examples:
- "n'oublie pas d'appeler sam" -> create_task
- "mets moi un rdv demain avec sara" -> create_event
- "supprime le truc appeler le fournisseur" -> delete_task
- "qu'est-ce que j'ai cette semaine" -> summarize_period
- "aide moi" -> capabilities
- "il fait combien dehors" -> unrecognized
`,
      },
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
    if (!Number.isFinite(confidence) || confidence < INTENT_CONFIDENCE_THRESHOLD) {
      return { intent: "unrecognized", language: args.language, confidence: Number.isFinite(confidence) ? confidence : 0 };
    }
    return { ...args, confidence };
  } catch {
    return { intent: "unrecognized", confidence: 0 };
  }
}
