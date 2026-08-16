# Speech-to-text validation — #4176

## Automated CI validation

The CI contract check verifies that the backend keeps the complete STT integration:

- `POST /assistant/transcribe`
- multipart `audio` upload
- missing-file validation
- Groq SDK client
- `whisper-large-v3`
- French transcription (`language: "fr"`)
- JSON transcription response
- error handling

This check is intentionally offline and does **not** require `GROQ_API_KEY`. It validates the integration contract without sending audio to an external service during CI.

## Manual accent validation

Because real speech recognition requires audio and a valid STT credential, accent recognition should be validated manually in an environment where `GROQ_API_KEY` is configured.

Record at least one short sentence for each of these French speaking profiles:

1. Standard/French metropolitan pronunciation
2. Tunisian French pronunciation
3. North-African French pronunciation with stronger Arabic-influenced phonetics

Use the same short functional phrases for each recording, for example:

- `Crée une tâche pour appeler le client demain.`
- `Ajoute un rendez-vous jeudi à dix heures.`
- `Quel est mon agenda cette semaine ?`

### Acceptance criteria

For each recording:

- the request reaches `/assistant/transcribe`;
- the endpoint returns HTTP 200;
- the response contains a non-empty `text` field;
- the transcription preserves the intended action and important entities (task/event, date/time);
- no request causes an unhandled backend error.

Record the results in the table below after testing on a real device/microphone.

| Profile | Task phrase | Event phrase | Summary phrase | Result |
|---|---|---|---|---|
| Standard French | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail |
| Tunisian French | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail |
| North-African French | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail |

> Do not claim accent coverage is automated by CI. The automated check validates the integration contract; real accent recognition remains an audio/API integration test.
