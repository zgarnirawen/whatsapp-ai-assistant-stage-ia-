import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        "Classify the user's message into one of the supported assistant intents and extract relevant details.",
      parameters: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: ["create_task", "create_event", "summarize_period", "unrecognized"],
            description:
              "The detected intent. Use 'unrecognized' if the message doesn't clearly match any supported action.",
          },

          taskTitle: {
            type: "string",
            description: "Title of the task, only if intent is create_task.",
          },
          targetTitleQuery: {
  type: "string",
  description:
    "Only for modify_task, delete_task, modify_event, delete_event. The title or description the user used to refer to the item they want to modify/delete (e.g. 'la tâche appeler le fournisseur' → 'appeler le fournisseur').",
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
            description:
              "ISO 8601 date/time if mentioned or inferable, only if intent is create_event.",
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
  description:
    "Only for summarize_period. What the user wants summarized: 'tasks' if they said taches/tâches specifically, 'events' if they said rendez-vous/agenda/réunions specifically, 'both' if unspecified or they asked for a general summary.",
},
summaryDates: {
  type: "array",
  items: { type: "string" },
  description:
    "Only for summarize_period, when the user mentions multiple SPECIFIC non-contiguous days (e.g. 'demain et hier', 'lundi et mercredi'). List each date in ISO format (YYYY-MM-DD). Do NOT use this for a single continuous range like 'cette semaine' — use summaryPeriodStart/End for that instead. If summaryDates is used, leave summaryPeriodStart/End empty.",
},
        },
        required: ["intent"],
      },
    },
  },
];

export async function detectIntent(inputText: string): Promise<IntentResult> {
  const today = new Date().toISOString().split("T")[0];

  const completion = await groq.chat.completions.create({
    model:"llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are an intent classifier for a voice/text assistant embedded in a productivity app (tasks, agenda, calls, files). Today's date is ${today} (${new Date().toLocaleDateString('fr-FR', { weekday: 'long' })}).

When the user refers to "cette semaine" (this week), the range MUST include today and MUST NOT be entirely in the past. Interpret "cette semaine" as Monday through Sunday of the CURRENT week that contains today's date — never a past week. Double check: today's date must fall within or before the end of the computed range.

Be GENEROUS and FLEXIBLE in matching intent — real users speak casually, with typos, missing words, and varied phrasing (especially via voice-to-text). Do not require exact or grammatically perfect phrasing. Focus on the underlying meaning, not exact wording.,
Examples of phrasings that should all map to "summarize_period":
- "resume moi mes taches"
- "resume mes taches"
- "resume ma semaine"
- "fais moi un resume"
- "qu'est-ce que j'ai cette semaine"
- "montre moi mon planning"

Examples that should map to "create_task":
- "cree une tache pour X"
- "ajoute une tache X"
- "n'oublie pas de X"
- "il faut que je X"

Examples that should map to "create_event":
- "programme un rdv avec X"
- "ajoute un rendez-vous X"
- "bloque du temps pour X"
- "modify_task" / "delete_task": user wants to change or remove an existing task (e.g. "modifie la tâche X", "supprime la tâche X", "annule la tâche X"). Extract targetTitleQuery (what they called it) and, for modify, newTaskTitle if given.
- "modify_event" / "delete_event": same for events/appointments.

Only use "unrecognized" when the message is genuinely unrelated to tasks/agenda/summaries (e.g. greetings, small talk, gibberish, or requests clearly outside scope like weather or general knowledge questions).

Always call the classify_intent function with your best classification.`,
      },
      {
        role: "user",
        content: inputText,
      },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "classify_intent" } },
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

  if (!toolCall) {
    return { intent: "unrecognized" };
  }

  try {
    const args = JSON.parse(toolCall.function.arguments);
    return args as IntentResult;
  } catch {
    return { intent: "unrecognized" };
  }
}