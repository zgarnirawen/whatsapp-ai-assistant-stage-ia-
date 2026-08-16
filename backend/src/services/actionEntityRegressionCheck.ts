import { normalizeActionEntities, type IntentResult } from "./intentDetection.js";

const cases: Array<{ name: string; input: IntentResult; expectedDuration?: number; expectedContact?: string }> = [
  { name: "30 minutes", input: { intent: "create_event", durationMinutes: 30 }, expectedDuration: 30 },
  { name: "one hour", input: { intent: "create_event", durationMinutes: 60 }, expectedDuration: 60 },
  { name: "one hour thirty", input: { intent: "create_event", durationMinutes: 90 }, expectedDuration: 90 },
  { name: "contact trimming", input: { intent: "create_event", contactName: "  Sara   Ben Ali  " }, expectedContact: "Sara Ben Ali" },
  { name: "invalid duration", input: { intent: "create_event", durationMinutes: 0 }, expectedDuration: undefined },
];

const failures = cases.filter(({ input, expectedDuration, expectedContact }) => {
  const actual = normalizeActionEntities(input);
  return actual.durationMinutes !== expectedDuration || actual.contactName !== expectedContact;
});

console.log(`Action entity regression cases: ${cases.length}`);
console.log(`Failures: ${failures.length}`);

if (failures.length) {
  console.error("Action entity normalization failures:");
  console.table(failures.map(({ name, input, expectedDuration, expectedContact }) => ({
    name,
    actualDuration: normalizeActionEntities(input).durationMinutes,
    expectedDuration,
    actualContact: normalizeActionEntities(input).contactName,
    expectedContact,
  })));
  process.exitCode = 1;
}
