# E2E validation — task #4180

## Scope

This test plan validates the full assistant path:

**input text/voice transcription → intent detection → proposed action → user confirmation → stub action → persisted interaction**.

It also covers conversational fallbacks, French/English inputs, malformed requests, target lookup, and API validation errors.

## 20 functional scenarios

| ID | Scenario | Expected result |
|---|---|---|
| E2E-01 | Create task | `create_task` + confirmation required |
| E2E-02 | Create event | `create_event` + confirmation required |
| E2E-03 | Weekly summary | `summarize_period` |
| E2E-04 | Greeting | `greeting` + non-empty response |
| E2E-05 | Capabilities | `capabilities` |
| E2E-06 | Thanks | `thanks` |
| E2E-07 | Farewell | `farewell` |
| E2E-08 | Small talk | `small_talk` |
| E2E-09 | Off-topic request | `unrecognized` + non-empty fallback |
| E2E-10 | Informal/typo task | Valid task intent despite informal wording |
| E2E-11 | English task | `create_task` + English language |
| E2E-12 | English event | `create_event` + English language |
| E2E-13 | Create + confirm task | Item is actually created |
| E2E-14 | Modify + confirm task | Existing task title changes |
| E2E-15 | Delete task proposal | Existing task is resolved as deletion target |
| E2E-16 | Create + modify + confirm event | Existing event title changes |
| E2E-17 | Delete event proposal | Existing event is resolved as deletion target |
| E2E-18 | Missing target | `not_found` status is returned |
| E2E-19 | Interaction history | POST creates a record; GET returns an array |
| E2E-20 | Input validation | Invalid payloads return HTTP 400 |

## Execution

From `backend/`:

```bash
npm run build
npm run test:all
```

For E2E execution, the backend must be running and configured with PostgreSQL and the Groq API key. The target can be overridden with `E2E_BASE_URL`, for example:

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

The runner writes `backend/test-results/e2e-report.json` with:

- total scenarios
- passed/failed count
- error rate
- minimum, average, p95 and maximum response time
- per-scenario duration and failure reason

## Acceptance criteria

- 20 scenarios are automated.
- A failed scenario makes the command exit with code `1`.
- Error rate is calculated as `failed / total × 100`.
- Latency is measured around each HTTP scenario and summarized with average and p95.
- Action scenarios verify both proposal and confirmation paths.
- API validation scenarios verify expected HTTP 400 responses.

## Findings / current limitations

1. The task/event modules are still in-memory stubs. The current assistant cannot be considered production end-to-end against the real task/agenda systems until those integrations expose stable APIs.
2. Intent detection depends on Groq, so classifier tests are model-dependent and can vary between runs.
3. Voice E2E is not included in the 20 HTTP scenarios because `/assistant/transcribe` requires a real audio fixture and a live transcription provider. The existing fallback test covers missing Groq configuration, but not microphone-to-transcription quality.
4. `getTasksInRange()` currently returns every stub task because stub tasks have no due date. Period summaries therefore need real task due dates before they can be considered fully accurate.
5. Performance recommendations should be based on the generated report rather than guessed thresholds. The runner records p95 specifically so a baseline can be established from the staging environment.

## Recommended next adjustments

- Replace `stubModules.ts` with the real task/agenda integrations before production sign-off.
- Add a fixed audio fixture and a mocked transcription provider for deterministic voice regression tests.
- Add seeded test data for date-range summaries and duplicate-title ambiguity.
- Run the suite repeatedly in staging and track p95/error-rate trends in CI.
- Keep E2E credentials in environment/CI secrets; never commit `.env` values.
