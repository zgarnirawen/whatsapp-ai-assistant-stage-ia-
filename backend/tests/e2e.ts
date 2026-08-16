import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = Number.parseInt(process.env.E2E_TIMEOUT_MS || "15000", 10);
const MIN_SCENARIOS = Number.parseInt(process.env.E2E_MIN_SCENARIOS || "20", 10);
const MAX_ERROR_RATE_PERCENT = Number.parseFloat(process.env.E2E_MAX_ERROR_RATE_PERCENT || "10");

type Scenario = { id: string; name: string; run: (client: E2EClient) => Promise<void> };
type Result = { id: string; name: string; status: "PASS" | "FAIL"; durationMs: number; error?: string };

class E2EClient {
  async request(path: string, options: RequestInit = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = performance.now();
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { "content-type": "application/json", ...(options.headers || {}) },
      });
      const durationMs = performance.now() - started;
      const text = await response.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { response, body, durationMs };
    } finally { clearTimeout(timer); }
  }

  async message(inputText: string, inputMode = "text") {
    const result = await this.request("/assistant/message", { method: "POST", body: JSON.stringify({ inputText, inputMode }) });
    assert(result.response.ok, `assistant/message returned ${result.response.status}`);
    assert(result.body?.result?.intent, "missing detected intent");
    return result;
  }

  async confirm(payload: Record<string, unknown>) {
    const result = await this.request("/assistant/confirm-action", { method: "POST", body: JSON.stringify(payload) });
    assert(result.response.ok, `confirm-action returned ${result.response.status}`);
    return result;
  }
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function assertIntent(result: any, ...expected: string[]) { assert(expected.includes(result.body?.result?.intent), `expected intent ${expected.join(" or ")}, got ${result.body?.result?.intent}`); }
async function expectStatus(client: E2EClient, path: string, method: string, body: unknown, status: number) {
  const result = await client.request(path, { method, body: JSON.stringify(body) });
  assert(result.response.status === status, `expected HTTP ${status}, got ${result.response.status}`);
}

const scenarios: Scenario[] = [
  { id: "E2E-01", name: "Create task", run: async c => { const r = await c.message("N'oublie pas d'appeler Sara"); assertIntent(r, "create_task"); assert(r.body.proposedAction?.requiresValidation === true, "create task must require validation"); } },
  { id: "E2E-02", name: "Create event", run: async c => { const r = await c.message("Mets-moi un rendez-vous demain avec Ali à 10h"); assertIntent(r, "create_event"); assert(r.body.proposedAction?.requiresValidation === true, "create event must require validation"); } },
  { id: "E2E-03", name: "Weekly summary", run: async c => { const r = await c.message("Qu'est-ce que j'ai cette semaine ?"); assertIntent(r, "summarize_period"); } },
  { id: "E2E-04", name: "Greeting", run: async c => { const r = await c.message("Bonjour assistant"); assertIntent(r, "greeting"); assert(typeof r.body.responseMessage === "string" && r.body.responseMessage.length > 0, "greeting response is empty"); } },
  { id: "E2E-05", name: "Capabilities", run: async c => { const r = await c.message("Comment peux-tu m'aider ?"); assertIntent(r, "capabilities"); } },
  { id: "E2E-06", name: "Thanks", run: async c => { const r = await c.message("Merci beaucoup"); assertIntent(r, "thanks"); } },
  { id: "E2E-07", name: "Farewell", run: async c => { const r = await c.message("À plus"); assertIntent(r, "farewell"); } },
  { id: "E2E-08", name: "Small talk", run: async c => { const r = await c.message("Ça va ?"); assertIntent(r, "small_talk"); } },
  { id: "E2E-09", name: "Off-topic fallback", run: async c => { const r = await c.message("Quel est le résultat du match d'hier ?"); assertIntent(r, "unrecognized"); assert(typeof r.body.responseMessage === "string" && r.body.responseMessage.length > 0, "fallback response is empty"); } },
  { id: "E2E-10", name: "Informal/typo task", run: async c => { const r = await c.message("ajoute tache appeler clien"); assertIntent(r, "create_task"); } },
  { id: "E2E-11", name: "English task", run: async c => { const r = await c.message("Remind me to finish the report"); assertIntent(r, "create_task"); assert(r.body.result.language === "en", "expected English language detection"); } },
  { id: "E2E-12", name: "English event", run: async c => { const r = await c.message("Schedule a meeting with Sam tomorrow at 2pm"); assertIntent(r, "create_event"); assert(r.body.result.language === "en", "expected English language detection"); } },
  { id: "E2E-13", name: "Create then confirm task", run: async c => { const r = await c.message("Ajoute la tâche E2E unique à tester"); assertIntent(r, "create_task"); const confirmed = await c.confirm({ interactionId: r.body.interaction.id, intent: r.body.proposedAction.intent, details: r.body.proposedAction.details, targetId: null }); assert(confirmed.body.createdItem?.title, "task was not created"); } },
  { id: "E2E-14", name: "Modify and confirm task", run: async c => { const r = await c.message("Renomme la tâche E2E unique à tester en E2E tâche modifiée"); assertIntent(r, "modify_task"); assert(r.body.proposedAction?.targetId, "modify task target was not resolved"); const confirmed = await c.confirm({ interactionId: r.body.interaction.id, intent: r.body.proposedAction.intent, details: r.body.proposedAction.details, targetId: r.body.proposedAction.targetId }); assert(confirmed.body.createdItem?.title === "E2E tâche modifiée", "task was not modified"); } },
  { id: "E2E-15", name: "Delete existing task", run: async c => { const r = await c.message("Supprime la tâche E2E tâche modifiée"); assertIntent(r, "delete_task"); assert(r.body.proposedAction?.targetId, "delete task target was not resolved"); } },
  { id: "E2E-16", name: "Create, modify and confirm event", run: async c => { const r = await c.message("Crée un événement E2E réunion à tester demain à 15h"); assertIntent(r, "create_event"); const created = await c.confirm({ interactionId: r.body.interaction.id, intent: r.body.proposedAction.intent, details: r.body.proposedAction.details, targetId: null }); const id = created.body.createdItem?.id; assert(id, "event was not created"); const m = await c.message("Change l'événement E2E réunion à tester en E2E réunion modifiée"); assertIntent(m, "modify_event"); assert(m.body.proposedAction?.targetId === id, "modify event target mismatch"); const modified = await c.confirm({ interactionId: m.body.interaction.id, intent: m.body.proposedAction.intent, details: m.body.proposedAction.details, targetId: m.body.proposedAction.targetId }); assert(modified.body.createdItem?.title === "E2E réunion modifiée", "event was not modified"); } },
  { id: "E2E-17", name: "Delete existing event", run: async c => { const r = await c.message("Supprime l'événement E2E réunion modifiée"); assertIntent(r, "delete_event"); assert(r.body.proposedAction?.targetId, "delete event target was not resolved"); } },
  { id: "E2E-18", name: "Not-found target", run: async c => { const r = await c.message("Supprime la tâche qui n'existe vraiment pas E2E"); assertIntent(r, "delete_task"); assert(r.body.modifyDeleteInfo?.status === "not_found", "expected not_found target status"); } },
  { id: "E2E-19", name: "Interaction history contract", run: async c => { const created = await c.request("/assistant/interactions", { method: "POST", body: JSON.stringify({ inputText: "E2E history", inputMode: "text", detectedIntent: "small_talk", actionTaken: null }) }); assert(created.response.status === 201, `expected 201, got ${created.response.status}`); const history = await c.request("/assistant/interactions?limit=5"); assert(history.response.ok && Array.isArray(history.body), "history endpoint did not return an array"); } },
  { id: "E2E-20", name: "Validation error contract", run: async c => { await expectStatus(c, "/assistant/message", "POST", {}, 400); await expectStatus(c, "/assistant/interactions", "POST", { inputMode: "text" }, 400); } },
];

async function main() {
  const client = new E2EClient();
  const results: Result[] = [];
  console.log(`E2E target: ${BASE_URL}`);
  console.log(`Scenarios: ${scenarios.length}`);
  assert(scenarios.length >= MIN_SCENARIOS, `minimum scenario count is ${MIN_SCENARIOS}, found ${scenarios.length}`);

  for (const scenario of scenarios) {
    const started = performance.now();
    try {
      await scenario.run(client);
      results.push({ id: scenario.id, name: scenario.name, status: "PASS", durationMs: Math.round(performance.now() - started) });
      console.log(`✓ ${scenario.id} ${scenario.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: scenario.id, name: scenario.name, status: "FAIL", durationMs: Math.round(performance.now() - started), error: message });
      console.error(`✗ ${scenario.id} ${scenario.name}: ${message}`);
    }
  }

  const durations = results.map(r => r.durationMs).sort((a, b) => a - b);
  const percentile = (p: number) => durations.length ? durations[Math.min(durations.length - 1, Math.ceil((p / 100) * durations.length) - 1)] : 0;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.length - passed;
  const errorRatePercent = Number(((failed / scenarios.length) * 100).toFixed(1));
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    scenarioCount: scenarios.length,
    passed,
    failed,
    errorRatePercent,
    thresholds: { minScenarios: MIN_SCENARIOS, maxErrorRatePercent: MAX_ERROR_RATE_PERCENT },
    thresholdStatus: { scenarioCount: scenarios.length >= MIN_SCENARIOS, errorRate: errorRatePercent <= MAX_ERROR_RATE_PERCENT },
    latencyMs: {
      min: Math.min(...durations),
      average: Math.round(durations.reduce((a, b) => a + b, 0) / Math.max(durations.length, 1)),
      p95: percentile(95),
      max: Math.max(...durations),
    },
    results,
  };

  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/e2e-report.json", JSON.stringify(report, null, 2));
  console.log(`\nResult: ${passed}/${scenarios.length} passed; error rate ${errorRatePercent}% (max ${MAX_ERROR_RATE_PERCENT}%)`);
  console.log(`Latency: avg ${report.latencyMs.average}ms | p95 ${report.latencyMs.p95}ms | max ${report.latencyMs.max}ms`);

  if (failed > 0 || errorRatePercent > MAX_ERROR_RATE_PERCENT) {
    process.exitCode = 1;
  }
}

main().catch(error => { console.error("E2E runner failed:", error); process.exitCode = 1; });
