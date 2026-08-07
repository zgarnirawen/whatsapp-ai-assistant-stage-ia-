import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { detectIntent } from "./services/intentDetection.js";
import { t, formatDate, formatDateRange } from "./i18n.js";
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

    const lang = (result as any).language || 'fr';
    let responseMessage: string | null = null;
    // conversational responses
    if (["unrecognized","greeting","farewell","thanks","small_talk","capabilities"].includes(result.intent)) {
      responseMessage = t(`conversational.${result.intent}`, lang as any);
    }

    // modify/delete info bilingual message placeholder
    let modifyDeleteMessage: string | null = null;

    let modifyDeleteInfo: { status: string; query?: string; target?: any; matches?: any[] } | null = null;

    if (["modify_task", "delete_task", "modify_event", "delete_event"].includes(result.intent) && result.targetTitleQuery) {
      const isTask = result.intent === "modify_task" || result.intent === "delete_task";
      const matches = isTask
        ? findTasksByTitle(result.targetTitleQuery)
        : findEventsByTitle(result.targetTitleQuery);

      if (matches.length === 0) {
        modifyDeleteInfo = { status: "not_found", query: result.targetTitleQuery };
        modifyDeleteMessage = t('modify.not_found', lang as any).replace('{query}', result.targetTitleQuery || '');
      } else if (matches.length > 1) {
        modifyDeleteInfo = { status: "ambiguous", matches };
        modifyDeleteMessage = t('modify.ambiguous', lang as any).replace('{query}', result.targetTitleQuery || '');
      } else {
        modifyDeleteInfo = { status: "found", target: matches[0] };
      }
    }

    let confirmationMessage: string | null = null;
    const proposedAction =
      result.intent === "create_task" || result.intent === "create_event"
        ? {
            interactionId: interaction.id,
            intent: result.intent,
            details: result,
            targetId: null,
            requiresValidation: true,
          }
        : ["modify_task", "delete_task", "modify_event", "delete_event"].includes(result.intent) &&
            modifyDeleteInfo?.status === "found"
          ? {
              interactionId: interaction.id,
              intent: result.intent,
              details: result,
              targetId: modifyDeleteInfo.target.id,
              requiresValidation: true,
            }
          : null;

    // build confirmationMessage for create/modify/delete proposals
    if (proposedAction && (proposedAction.intent === 'create_task' || proposedAction.intent === 'create_event')) {
      if (proposedAction.intent === 'create_task') {
        const title = (result as any).taskTitle || ((lang === 'fr') ? 'Tâche sans titre' : 'Untitled task');
        confirmationMessage = t('confirmation.create_task', lang as any, { title });
      } else {
        const title = (result as any).eventTitle || ((lang === 'fr') ? 'Événement sans titre' : 'Untitled event');
        const date = formatDate(lang as any, (result as any).eventDateTime);
        confirmationMessage = t('confirmation.create_event', lang as any, { title, date });
      }
    }
    let summaryData = null;
    let summaryDataByDate: Record<string, { tasks: any[]; events: any[] }> | null = null;

    let summaryMessage: string | null = null;
    let summaryLabels: { tasks: string; events: string } | null = null;
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
        summaryMessage = t('labels.summary_wrapper', lang as any, { range: formatDateRange(lang as any, result.summaryPeriodStart, result.summaryPeriodEnd) });
        summaryLabels = { tasks: t('labels.tasks', lang as any), events: t('labels.events', lang as any) };
      }
    }

    const responsePayload = {
      interaction,
      result,
      responseMessage,
      proposedAction,
      confirmationMessage,
      modifyDeleteInfo,
      modifyDeleteMessage,
      summaryData,
      summaryDataByDate,
      summaryMessage,
      summaryLabels,
      summaryScope: result.summaryScope || null,
    };

    res.json(responsePayload);
  } catch (error) {
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
    const lang = details?.language || 'fr';

    if (intent === "create_task") {
      const title = details?.taskTitle || ((lang === 'fr') ? 'Tâche sans titre' : 'Untitled task');
      createdItem = createStubTask(title);
    } else if (intent === "create_event") {
      const title = details?.eventTitle || ((lang === 'fr') ? 'Événement sans titre' : 'Untitled event');
      createdItem = createStubEvent(
        title,
        details.eventDateTime || new Date().toISOString()
      );
    } else if (intent === "delete_task") {
      const success = deleteStubTask(targetId);
      createdItem = { id: targetId, deleted: !!success };
    } else if (intent === "delete_event") {
      const success = deleteStubEvent(targetId);
      createdItem = { id: targetId, deleted: !!success };
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

    // add a bilingual confirmation message with proper narrowing and guards
    let confirmationMessage: string | null = null;
    switch (intent) {
      case 'create_task': {
        if (createdItem && typeof createdItem === 'object' && 'title' in createdItem) {
          confirmationMessage = t('confirmation.create_task', lang as any, { title: (createdItem as any).title });
        } else {
          confirmationMessage = t('conversational.error', lang as any);
        }
        break;
      }
      case 'create_event': {
        if (createdItem && typeof createdItem === 'object' && 'dateTime' in createdItem) {
          confirmationMessage = t('confirmation.create_event', lang as any, { title: (createdItem as any).title || '', date: formatDate(lang as any, (createdItem as any).dateTime) });
        } else {
          confirmationMessage = t('conversational.error', lang as any);
        }
        break;
      }
      case 'modify_task': {
        if (createdItem && typeof createdItem === 'object' && 'title' in createdItem) {
          confirmationMessage = t('confirmation.modify_task', lang as any, { title: (createdItem as any).title });
        } else {
          confirmationMessage = t('conversational.error', lang as any);
        }
        break;
      }
      case 'modify_event': {
        if (createdItem && typeof createdItem === 'object' && 'title' in createdItem) {
          confirmationMessage = t('confirmation.modify_event', lang as any, { title: (createdItem as any).title || '', date: formatDate(lang as any, (createdItem as any).dateTime) });
        } else {
          confirmationMessage = t('conversational.error', lang as any);
        }
        break;
      }
      case 'delete_task': {
        confirmationMessage = t('confirmation.delete_task', lang as any, { title: details?.taskTitle || '' });
        break;
      }
      case 'delete_event': {
        confirmationMessage = t('confirmation.delete_event', lang as any, { title: details?.eventTitle || '' });
        break;
      }
      default: {
        confirmationMessage = null;
      }
    }

    res.json({ createdItem, updatedInteraction, confirmationMessage });
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