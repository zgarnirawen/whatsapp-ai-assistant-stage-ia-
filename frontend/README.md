# Assistant IA App

Mobile app centralizing task management, calendar, phone calls, and file sharing — all voice-controllable, WhatsApp-style UI. This repo covers the **Assistant IA module**: conversational interaction + actions on other modules (create task, check agenda, summarize period).

## Stack

- **Frontend**: React Native (Expo, Expo Router), custom-built chat UI matching a provided maquette (no external chat library)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (via Prisma ORM 7)
- **Voice/AI**: Speech-to-text API + Groq (LLaMA 3.3 70B) for intent detection & summaries
- **Calls**: Twilio

## Design system (from maquette.html)

```
Background:     #F6F3EC
Surface:        #FFFFFF
Surface alt:    #EFEAE0  (user message cards)
Ink (text):     #1B1F1D
Ink soft:       #6E7370
Teal deep:      #123F36  (app bar, assistant label)
Teal pale:      #E1EEEA  (assistant message cards)
Coral:          #E2703A  (mic button, accents)
Line:           #E4DFD3
```
Fonts: **Space Grotesk** (headings — app bar title) + **IBM Plex Sans** (body text — everything else), loaded via `@expo-google-fonts`. Icons via `@expo/vector-icons` (Feather set): mic, send (arrow-up-circle), more-options (more-horizontal).

Layout pattern: stacked message **cards** (not chat bubbles), teal-deep app bar with title + "À l'écoute" subtitle, **checkbox-style rows** for proposed actions ("Oui, créer la tâche" / "Non merci"), pill-shaped **voicebar** input with a coral mic button.

## Project structure

```
assistant-ia-app/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Express server entry point
│   │   └── services/
│   │       ├── intentDetection.ts       # Groq function-calling intent classifier
│   │       └── stubModules.ts          # In-memory stand-ins for To do list / Agenda
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── generated/prisma/                # Generated Prisma Client (gitignored)
│   ├── prisma.config.ts                 # Prisma 7 config (holds DATABASE_URL)
│   ├── tsconfig.json
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   └── app/
│   │       └── index.tsx                # Custom chat UI (Expo Router entry screen)
│   ├── package.json
│   └── ... (standard Expo SDK 57 scaffold)
├── docker-compose.yml                    # Postgres container (dev environment)
└── README.md
```

## Prerequisites

- Node.js v22+ (confirmed on v22.17.1)
- Docker Desktop (with WSL2 backend on Windows)
- npm
- Groq API key (https://console.groq.com/keys)
- Expo Go app (optional, for testing on a physical device)

## Getting started (current state)

```bash
# 1. Start Postgres
cd assistant-ia-app
docker compose up -d

# 2. Start backend (Terminal 1)
cd backend
npm run dev
```
Backend runs at `http://localhost:3000`.

```bash
# 3. Start frontend (Terminal 2, separate from backend)
cd frontend
npx expo start
```
Note: if port 8081 is already in use, Expo will prompt to use another port — check the terminal output for the actual `Web:` URL.

⚠️ **Always test in a separate terminal from `npm run dev`** — running a request in the same terminal as a running dev server kills it.

⚠️ **If frontend changes don't seem to apply after saving**, force a clean reload:
```bash
npx expo start --clear
```
Then open the URL in a fresh browser tab.

⚠️ **Stub data (tasks/events) lives only in memory** and resets whenever the backend restarts. This is expected — the cahier des charges requires summaries to reflect only real, non-invented data, so an empty store correctly produces an empty summary.

### Testing backend routes directly (PowerShell)

PowerShell's `curl` is aliased to `Invoke-WebRequest`, not real curl — use `Invoke-RestMethod` instead.

**Health check:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/" -Method GET
```

**Send a message to the assistant (intent detection):**
```powershell
$msg = Invoke-RestMethod -Uri "http://localhost:3000/assistant/message" -Method POST -ContentType "application/json" -Body '{"inputText": "Cree une tache pour envoyer le rapport vendredi", "inputMode": "text"}'
$msg | ConvertTo-Json -Depth 5
```

**Confirm/validate a proposed action (creates the actual task/event):**
```powershell
$confirm = Invoke-RestMethod -Uri "http://localhost:3000/assistant/confirm-action" -Method POST -ContentType "application/json" -Body (@{
  interactionId = $msg.interaction.id
  intent = $msg.result.intent
  details = $msg.result
} | ConvertTo-Json)
$confirm | ConvertTo-Json -Depth 5
```

**Inspect stub data:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/debug/tasks" -Method GET
Invoke-RestMethod -Uri "http://localhost:3000/debug/events" -Method GET
```

**Note on apostrophes in PowerShell single-quoted strings**: double them, e.g. `'aujourd''hui'`.

## Environment variables (`backend/.env`)

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/assistant_ia"
GROQ_API_KEY=gsk_...
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
STT_API_KEY=
PORT=3000
```

## Frontend configuration

In `frontend/src/app/index.tsx`:
```ts
const API_BASE_URL = 'http://localhost:3000';
```
Works for web preview (same machine). **For a physical device via Expo Go**, change this to your machine's local network IP (find with `ipconfig`), e.g. `http://192.168.1.42:3000`.

## API reference (current state)

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Health check |
| POST | `/test-interaction` | Debug: create a raw `AssistantInteraction` row |
| GET | `/test-interaction` | Debug: list all `AssistantInteraction` rows |
| POST | `/assistant/message` | Classify intent, log interaction, return a **proposed action** and/or **summaryData** (does NOT execute actions) |
| POST | `/assistant/confirm-action` | Execute a previously proposed action (create task/event), update `actionTaken` |
| GET | `/debug/tasks` | List stub tasks (temporary, replaces real To do list module) |
| GET | `/debug/events` | List stub events (temporary, replaces real Agenda module) |

### `POST /assistant/message` — request/response shape

Request:
```json
{ "inputText": "Cree une tache pour appeler le client demain", "inputMode": "text" }
```

Response (create_task/create_event):
```json
{
  "interaction": { "id": "...", "inputText": "...", "detectedIntent": "create_task", "actionTaken": null, "createdAt": "..." },
  "result": { "intent": "create_task", "taskTitle": "appeler le client" },
  "responseMessage": null,
  "proposedAction": {
    "interactionId": "...",
    "intent": "create_task",
    "details": { "intent": "create_task", "taskTitle": "appeler le client" },
    "requiresValidation": true
  },
  "summaryData": null
}
```

Response (summarize_period, with real data):
```json
{
  "interaction": { "...": "..." },
  "result": { "intent": "summarize_period", "summaryPeriodStart": "2026-07-18", "summaryPeriodEnd": "2026-07-18" },
  "responseMessage": null,
  "proposedAction": null,
  "summaryData": {
    "tasks": [{ "id": "...", "title": "appeler le fournisseur", "createdAt": "..." }],
    "events": [{ "id": "...", "title": "reunion", "dateTime": "2026-07-18T15:00:00", "createdAt": "..." }]
  }
}
```

If intent is `unrecognized`, `responseMessage` becomes `"Je n'ai pas compris, peux-tu reformuler ?"` and `proposedAction`/`summaryData` are `null`.

For `summarize_period` with no extractable date range, `summaryPeriodStart`/`summaryPeriodEnd` are absent — the **frontend** detects this and asks a clarifying question (see clarification-memory feature below), remembering the original request to combine with the follow-up reply.

## Progress log

### ✅ Backend scaffolding
- Initialized `backend/` with `npm init`, installed core deps: `express`, `pg`, `dotenv`, `cors`, `multer`, `twilio`, `groq-sdk`
- Set `package.json` → `"type": "module"` (Prisma 7 requires ESM)

### ✅ Prisma setup (v7.8.0)
- `DATABASE_URL` lives in `prisma.config.ts` in Prisma 7, not `schema.prisma`
- `@prisma/adapter-pg` required as an explicit driver adapter
- Defined `AssistantInteraction` model:
  ```prisma
  model AssistantInteraction {
    id             String   @id @default(uuid())
    inputText      String
    inputMode      String
    detectedIntent String?
    actionTaken    String?
    createdAt      DateTime @default(now())
  }
  ```

### ✅ TypeScript / Docker / Postgres / migrations
- `tsconfig.json` configured for ESM (`module: ESNext`, `moduleResolution: bundler`)
- `docker-compose.yml` — `postgres:16` service, port `5432`, named volume `pgdata`
- Fixed `.env` — Prisma's auto-generated placeholder pointed to the wrong local dev server; corrected to match Docker credentials
- `npx prisma migrate dev --name init` + `npx prisma generate` (must run separately in Prisma 7)

### ⚠️ Dev tooling fix
- `ts-node-dev` incompatible with TypeScript 7 + ESM — swapped to `tsx` (`"dev": "tsx watch src/index.ts"`)

### ✅ Full stack verified end-to-end (Express ↔ Prisma ↔ Postgres)

### ✅ Intent detection working — all 4 core intents validated
- `src/services/intentDetection.ts` uses Groq function-calling (forced `tool_choice`)
- `llama-3.1-8b-instant` unreliable with schema fields — switched to `llama-3.3-70b-versatile`
- Route: `POST /assistant/message`

### ✅ Validate-before-execute flow implemented (core acceptance criterion)
- `src/services/stubModules.ts` — in-memory stand-ins for To do list / Agenda
- `/assistant/message` returns a `proposedAction`, never auto-executes
- `POST /assistant/confirm-action` executes only after explicit validation, updates `actionTaken`
- Verified twice end-to-end (task creation, then event creation) — proposal, no execution until validated, `actionTaken` correctly links to the created record

### ⚠️ First chat UI attempt — replaced (design mismatch)
- Initial version used `react-native-gifted-chat` — default bubble styling did not match the provided maquette
- Rebuilt from scratch with plain React Native components; removed `react-native-gifted-chat` and `dayjs`

### ✅ Chat UI rebuilt to match maquette.html (Écran 4 — Assistant IA)
- Teal-deep app bar, stacked message cards, checkbox-style action rows, coral voicebar input

### ⚠️ Recurring encoding corruption (mojibake) — root cause and fix
- Accented characters/emoji corrupted when pasted through PowerShell rather than directly into VS Code
- Fixed by pasting directly in the editor and confirming **UTF-8** encoding; removed emoji from UI strings as a durable fix

### ⚠️ File mix-up incidents — backend vs frontend
- Frontend JSX code and a stray `useState()` line were each accidentally pasted into `backend/src/index.ts` (`.ts`, no JSX/React) at different points, causing cascades of parse errors
- **Lesson**: `backend/src/index.ts` and `frontend/src/app/index.tsx` are similarly named but entirely different projects — always confirm which file is open before pasting

### ✅ Stale pending-action bug fixed
- Sending a new message while a previous `proposedAction` was unresolved left stale Valider/Ignorer checkboxes bound to an old `interactionId`
- Fix: `setPendingAction(null)` runs at the start of every `sendMessage` call

### ✅ Flexible intent matching — system prompt improved
- Minor phrasing variations (e.g. "resume moi mes taches" vs "resume mes taches") produced inconsistent classification
- Rewrote the system prompt to explicitly instruct flexible/generous matching for casual phrasing and typos, with example phrasings per intent
- Verified: "resume mes taches" now correctly classifies as `summarize_period`

### ✅ Clarification-memory feature (one-shot follow-up handling)
- When `summarize_period` is detected without a date range, the frontend remembers the original request (`awaitingPeriodClarification` state) and combines it with the next message before resending
- Verified end-to-end: "résume mes taches" → clarifying question → "d'aujourd'hui" → correctly resolved to a real date
- Scope: one-shot memory for this specific case only, not full multi-turn conversation memory

### ✅ Fonts and icons implemented to match maquette
- Installed `@expo-google-fonts/space-grotesk` and `@expo-google-fonts/ibm-plex-sans` via `npx expo install`
- App bar title uses Space Grotesk (SemiBold); body text uses IBM Plex Sans (Regular/Medium/SemiBold), matching the maquette's heading/body font split
- Added a loading state (`useFonts` + `ActivityIndicator`) shown until both font families finish loading — required, since rendering before fonts load causes incorrect fallback-font flashes
- Replaced text placeholders ("MIC", "Envoyer", "...") with real icon components from `@expo/vector-icons` (Feather set): `mic`, `arrow-up-circle`, `more-horizontal`
- Verified visually: header, body text, and icons all render correctly against the maquette's design intent

### ✅ Real summarize_period data — no invented content (core acceptance criterion)
- **Problem found during testing**: `summarize_period` responses only echoed back the detected date range with no actual task/event data attached — violated the cahier des charges' explicit requirement: *"Une demande de résumé de période retourne des données réelles issues des modules Tâches/Agenda (pas de contenu inventé)."*
- **Also found**: single-day requests were phrased as a fake "period" (e.g. "la période du 2026-07-18 au 2026-07-18") — unnatural and unprofessional phrasing
- Fixes:
  - Added `getTasksInRange()` and `getEventsInRange(start, end)` to `stubModules.ts` (events filtered by date; tasks currently have no due-date field in the stub model, so all stub tasks are returned pending a real Task module with due dates)
  - `/assistant/message` now attaches a `summaryData: { tasks, events }` object to the response whenever `summarize_period` resolves a real date range
  - Frontend now distinguishes a single-day request ("Resume pour le X :") from a genuine range ("Resume pour la periode du X au Y :"), and renders the actual task/event titles (and event times) pulled from `summaryData`, or an honest "aucune tache ni evenement trouve" when the store is empty
- Verified end-to-end: created a real task ("appeler le fournisseur") and event ("reunion" at 15:00) via the UI, requested a summary, confirmed the exact real titles appeared — including correctly displaying duplicate entries when the same task/event had genuinely been created twice, proving the summary reports actual stored data rather than fabricating or deduplicating silently

### 🔲 Next up
- [ ] Add speech-to-text integration (Groq Whisper endpoint recommended — same provider as LLM)
- [ ] Add a due-date field to stub tasks so `getTasksInRange()` can filter tasks by date the same way events are filtered
- [ ] Build out remaining maquette screens (Accueil, To do list, Agenda, Fichiers, Nouveau contact, Paramètres, Appel) as scope expands or coordinates with other modules
- [ ] Test on a physical device via Expo Go (requires switching `API_BASE_URL` from `localhost` to local network IP)
- [ ] Set up ngrok for Twilio webhook testing
- [ ] Twilio integration (call transcription/summary, appointment detection)
- [ ] Handle remaining edge case: "Demande d'action sur un module non disponible → message explicite de limite plutôt qu'un silence"
- [ ] Replace stub modules with real To do list / Agenda module integrations once available
- [ ] Consider broader conversation memory beyond the single period-clarification case, if more multi-turn patterns emerge

## Known gotchas (Windows / PowerShell / Expo specific)

- `curl` in PowerShell ≠ real curl. Use `Invoke-RestMethod`, or call `curl.exe` explicitly for real curl syntax.
- In PowerShell single-quoted strings, escape an apostrophe by doubling it (`''`).
- Running a test request in the same terminal as `npm run dev` / `npx expo start` kills the dev server — always use a separate terminal tab.
- Prisma 7 requires `prisma generate` to be run explicitly after every `prisma migrate dev` — no longer automatic.
- `ts-node-dev` does not currently support TypeScript 7 — use `tsx` instead.
- `prisma.config.ts` must be included in `tsconfig.json`'s `include` array even though it lives outside `src/` — don't set `rootDir` alongside this.
- Small/fast LLMs can be unreliable with strict function-calling schemas — test carefully before trusting structured output.
- New files created via `New-Item` are empty until content is explicitly pasted and saved in the editor.
- Double-check which project folder you're pasting code into — `backend/` and `frontend/` both have similarly-named entry files (`index.ts` vs `index.tsx`) but are entirely different projects.
- Copy-pasting accented/special characters or emoji through PowerShell can corrupt encoding (mojibake) — paste directly in the VS Code editor and confirm **UTF-8** encoding. When in doubt, avoid emoji in source strings.
- If Expo's default port 8081 is taken, it prompts for another port — check the terminal's actual `Web:` URL rather than assuming 8081.
- Frontend changes not appearing after save usually means a stale Metro bundle — run `npx expo start --clear` and open a fresh browser tab.
- `localhost` in frontend API calls only works for the web preview. For Expo Go on a physical device, use your PC's local network IP instead.
- LLM intent classification can be sensitive to exact phrasing — strengthen the system prompt with explicit flexibility instructions and example phrasings rather than assuming a misclassification is a code bug.
- In-memory stub data resets on every backend restart — expected behavior, not a bug, and it correctly keeps summaries honest (empty store → empty summary, never fabricated).
- Use `npx expo install <package>` rather than plain `npm install` for Expo-managed packages (fonts, native modules) — it resolves versions compatible with your installed SDK automatically.