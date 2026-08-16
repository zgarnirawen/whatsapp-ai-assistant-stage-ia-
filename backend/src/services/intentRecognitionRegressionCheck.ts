import { detectIntentForRegression } from "./deterministicIntentClassifier.js";
import { INTENT_PATTERN_CASES, OUT_OF_SCOPE_PATTERN_CASES } from "./intentPatterns.js";

const results = INTENT_PATTERN_CASES.map(({ input, expected }) => ({
  input,
  expected,
  actual: detectIntentForRegression(input),
}));

const outOfScopeResults = OUT_OF_SCOPE_PATTERN_CASES.map((input) => ({
  input,
  actual: detectIntentForRegression(input),
}));

const failures = results.filter(({ expected, actual }) => expected !== actual);
const falsePositives = outOfScopeResults.filter(({ actual }) => actual !== "unrecognized");

const accuracy = ((results.length - failures.length) / results.length) * 100;
const falsePositiveRate = (falsePositives.length / outOfScopeResults.length) * 100;

console.log(`Intent regression cases: ${results.length}`);
console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
console.log(`Out-of-scope cases: ${outOfScopeResults.length}`);
console.log(`False-positive rate: ${falsePositiveRate.toFixed(1)}%`);

if (failures.length) {
  console.error("Intent recognition failures:");
  console.table(failures);
}
if (falsePositives.length) {
  console.error("Out-of-scope phrases classified as an actionable intent:");
  console.table(falsePositives);
}

const report = {
  mode: "offline-intent-regression",
  testedAt: new Date().toISOString(),
  caseCount: results.length,
  accuracy,
  outOfScopeCount: outOfScopeResults.length,
  falsePositiveRate,
  failures,
  falsePositives,
  thresholds: { minAccuracy: 90, maxFalsePositiveRate: 10 },
};

const fs = await import("node:fs/promises");
await fs.mkdir("test-results", { recursive: true });
await fs.writeFile("test-results/intent-recognition-report.json", JSON.stringify(report, null, 2));

if (results.length < 50 || accuracy < 90 || falsePositiveRate > 10) {
  process.exitCode = 1;
}
