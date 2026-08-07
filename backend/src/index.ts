import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { detectIntent } from "./services/intentDetection.js";
import {
  createStubTask,
  createStubEvent,
  getStubTasks,
  getStubEvents,
  getTasksInRange,
  getEventsInRange,
  findTasksByTitle,
  findEventsByTitle,
  deleteStubTask,
  deleteStubEvent,
  updateStubTask,
  updateStubEvent,
} from "./services/stubModules.js";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Assistant IA backend is running.");
});

app.post("/test-interaction", async (req, res) => {
  try {
    const interaction = await prisma.assistantInteraction.create({
      data: {
        inputText: req.body.inputText || "test message",
        inputMode: req.body.inputMode || "text",
        detectedIntent: "test_intent",
      },
    });
    res.json(interaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create interaction" });
  }
});

app.get("/test-interaction", async (req, res) => {
  try {
    const interactions = await prisma.assistantInteraction.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(interactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

app.post("/assistant/message", async (req, res) => {
  try {
    const { inputText, inputMode } = req.body;

    if (!inputText) {
      return res.status(400).json({ error: "inputText is required" });
    }

    const result = await detectIntent(inputText);

    const interaction = await prisma.assistantInteraction.create({
      data: {
        inputText,
        inputMode: inputMode || "text",
        detectedIntent: result.intent,
      },
    });

    const responseMessage =
      result.intent === "unrecognized"
        ? "Je n'ai pas compris, peux-tu reformuler ?"
        : null;
let modifyDeleteInfo: { status: string; query?: string; target?: any; matches?: any[] } | null = null;    const proposedAction =
  (result.intent === "create_task" || result.intent === "create_event") ||
  (["modify_task", "delete_task", "modify_event", "delete_event"].includes(result.intent) && modifyDeleteInfo?.status === "found")
    ? {
        interactionId: interaction.id,
        intent: result.intent,
        details: result,
        targetId: modifyDeleteInfo?.status === "found" ? modifyDeleteInfo.target.id : null,
        requiresValidation: true,
      }
    : null;



if (["modify_task", "delete_task", "modify_event", "delete_event"].includes(result.intent) && result.targetTitleQuery) {
  const isTask = result.intent === "modify_task" || result.intent === "delete_task";
  const matches = isTask
    ? findTasksByTitle(result.targetTitleQuery)
    : findEventsByTitle(result.targetTitleQuery);

  if (matches.length === 0) {
    modifyDeleteInfo = { status: "not_found", query: result.targetTitleQuery };
  } else if (matches.length > 1) {
    modifyDeleteInfo = { status: "ambiguous", matches };
  } else {
    modifyDeleteInfo = { status: "found", target: matches[0] };
  }
}
    let summaryData = null;
let summaryDataByDate: Record<string, { tasks: any[]; events: any[] }> | null = null;

if (result.intent === "summarize_period") {
  const scope = result.summaryScope || "both";

  if (result.summaryDates && result.summaryDates.length > 0) {
    summaryDataByDate = {};
    for (const date of result.summaryDates) {
      summaryDataByDate[date] = {
        tasks: scope === "tasks" || scope === "both" ? getTasksInRange() : [],
        events: scope === "events" || scope === "both" ? getEventsInRange(date, date) : [],
      };
    }
  } else if (result.summaryPeriodStart && result.summaryPeriodEnd) {
    summaryData = {
      tasks: scope === "tasks" || scope === "both" ? getTasksInRange() : [],
      events: scope === "events" || scope === "both" ? getEventsInRange(result.summaryPeriodStart, result.summaryPeriodEnd) : [],
    };
  }
}


res.json({ interaction, result, responseMessage, proposedAction, summaryData, summaryDataByDate, summaryScope: result.summaryScope || null, modifyDeleteInfo });  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

app.post("/assistant/confirm-action", async (req, res) => {
  try {
    const { interactionId, intent, details, targetId } = req.body;

    if (!interactionId || !intent) {
      return res.status(400).json({ error: "interactionId and intent are required" });
    }

    let createdItem;

    if (intent === "create_task") {
      createdItem = createStubTask(details.taskTitle || "Tâche sans titre");
    } else if (intent === "create_event") {
      createdItem = createStubEvent(
        details.eventTitle || "Événement sans titre",
        details.eventDateTime || new Date().toISOString()
      );
    } else if (intent === "delete_task") {
      const success = deleteStubTask(targetId);
      createdItem = { id: targetId, deleted: success };
    } else if (intent === "delete_event") {
      const success = deleteStubEvent(targetId);
      createdItem = { id: targetId, deleted: success };
    } else if (intent === "modify_task") {
      createdItem = updateStubTask(targetId, details.newTaskTitle || details.taskTitle);
    } else if (intent === "modify_event") {
      createdItem = updateStubEvent(targetId, details.newEventTitle, details.newEventDateTime);
    } else {
      return res.status(400).json({ error: "Unsupported intent for confirmation" });
    }

    const updatedInteraction = await prisma.assistantInteraction.update({
      where: { id: interactionId },
      data: { actionTaken: createdItem?.id || targetId },
    });

    res.json({ createdItem, updatedInteraction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to confirm action" });
  }
});
app.post("/assistant/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const groq = new (await import("groq-sdk")).default({ apiKey: process.env.GROQ_API_KEY });

const file = new File([new Uint8Array(req.file.buffer)], "audio.m4a", { type: req.file.mimetype });
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
      language: "fr",
    });

    res.json({ text: transcription.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

app.get("/debug/tasks", (req, res) => res.json(getStubTasks()));
app.get("/debug/events", (req, res) => res.json(getStubEvents()));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});