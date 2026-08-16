import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");

const checks = [
  ["transcription endpoint", 'app.post("/assistant/transcribe"'],
  ["multipart audio upload", 'upload.single("audio")'],
  ["missing audio validation", 'No audio file provided'],
  ["Groq SDK client", 'groq-sdk'],
  ["Whisper model", 'model: "whisper-large-v3"'],
  ["French transcription", 'language: "fr"'],
  ["transcription response", 'res.json({ text: transcription.text })'],
  ["transcription error handling", 'Failed to transcribe audio'],
] as const;

const failures = checks
  .filter(([, expected]) => !source.includes(expected))
  .map(([name]) => name);

console.log(`Speech-to-text integration checks: ${checks.length}`);
console.log(`Speech-to-text integration failures: ${failures.length}`);

if (failures.length > 0) {
  console.error("Missing STT integration requirements:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Speech-to-text integration contract: PASS");
console.log("Manual accent validation remains documented in docs/speech-to-text-test-plan-4176.md");
