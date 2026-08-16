import "dotenv/config";
import {
  classifyIntent,
  DEFAULT_INTENT_CONFIDENCE_THRESHOLD,
  type DetectedIntent,
} from "./intentDetection.js";
import { ALL_INTENT_EXAMPLES } from "./intentPatterns.js";

const OUT_OF_SCOPE_CASES = [
  "quelle est la météo aujourd'hui ?",
  "donne-moi une recette de crêpes",
  "qui a gagné le match hier ?",
  "explique-moi la relativité",
  "traduis ce texte en espagnol",
  "quelle est la capitale du Japon ?",
  "raconte-moi une blague",
  "combien font 17 fois 24 ?",
  "écris-moi un poème sur la mer",
  "what is the latest stock price?",
] as const;

const THRESHOLD_CANDIDATES = Array.from(
  new Set([0.5, 0.55, 0.6, 0.65, 0.7, DEFAULT_INTENT_CONFIDENCE_THRESHOLD]),
).sort((a, b) => a - b);
const MAX_FALSE_FALLBACK_RATE = 10;
const MAX_FALSE_POSITIVE_RATE = 20;

interface RawResult {
  input: string;
  expected?: DetectedIntent;
  predicted: DetectedIntent;
  confidence: number;
}

function applyThreshold(result: RawResult, threshold: number): DetectedIntent {
  return result.confidence >= threshold ? result.predicted : "unrecognized";
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

async function classifyAll(inputs: Array<{ input: string; expected?: DetectedIntent }>): Promise<RawResult[]> {
  const results: RawResult[] = [];

  // Sequential calls avoid bursting the provider and make failures easier to diagnose.
  for (const item of inputs) {
    const result = await classifyIntent(item.input);
    results.push({
      input: item.input,
      expected: item.expected,
      predicted: result.intent,
      confidence: result.confidence ?? 0,
    });
  }

  return results;
}

function evaluateThreshold(results: RawResult[], threshold: number) {
  const inScope = results.filter((result) => result.expected !== undefined);
  const outOfScope = results.filter((result) => result.expected === undefined);

  const correct = inScope.filter(
    (result) => applyThreshold(result, threshold) === result.expected,
  ).length;
  const falseFallbacks = inScope.filter(
    (result) => applyThreshold(result, threshold) === "unrecognized",
  ).length;
  const falsePositives = outOfScope.filter(
    (result) => applyThreshold(result, threshold) !== "unrecognized",
  ).length;

  const accuracy = percentage(correct, inScope.length);
  const falseFallbackRate = percentage(falseFallbacks, inScope.length);
  const falsePositiveRate = percentage(falsePositives, outOfScope.length);

  // Favor in-scope accuracy while strongly penalizing over-acceptance and fallbacks.
  const score = accuracy - falseFallbackRate * 0.5 - falsePositiveRate * 0.75;

  return { threshold, accuracy, falseFallbackRate, falsePositiveRate, score };
}

async function main() {
  const inScopeCases = ALL_INTENT_EXAMPLES.map(({ input, expectedIntent }) => ({
    input,
    expected: expectedIntent,
  }));
  const outOfScopeCases = OUT_OF_SCOPE_CASES.map((input) => ({ input }));

  console.log(`Evaluating ${inScopeCases.length} in-scope phrases + ${outOfScopeCases.length} out-of-scope phrases.`);
  const results = await classifyAll([...inScopeCases, ...outOfScopeCases]);

  const metrics = THRESHOLD_CANDIDATES.map((threshold) => evaluateThreshold(results, threshold));
  console.table(metrics.map((metric) => ({
    threshold: metric.threshold.toFixed(2),
    accuracy: `${metric.accuracy.toFixed(1)}%`,
    falseFallbackRate: `${metric.falseFallbackRate.toFixed(1)}%`,
    falsePositiveRate: `${metric.falsePositiveRate.toFixed(1)}%`,
    score: metric.score.toFixed(2),
  })));

  const eligible = metrics.filter(
    (metric) =>
      metric.falseFallbackRate <= MAX_FALSE_FALLBACK_RATE &&
      metric.falsePositiveRate <= MAX_FALSE_POSITIVE_RATE,
  );
  const recommended = [...(eligible.length ? eligible : metrics)].sort((a, b) => b.score - a.score)[0];

  console.log(`Current threshold: ${DEFAULT_INTENT_CONFIDENCE_THRESHOLD.toFixed(2)}`);
  console.log(`Recommended threshold from this evaluation: ${recommended.threshold.toFixed(2)}`);
  console.log(
    `Recommended metrics: ${recommended.accuracy.toFixed(1)}% accuracy, ` +
      `${recommended.falseFallbackRate.toFixed(1)}% false fallback, ` +
      `${recommended.falsePositiveRate.toFixed(1)}% false positive.`,
  );

  const current = metrics.find((metric) => metric.threshold === DEFAULT_INTENT_CONFIDENCE_THRESHOLD);
  if (!current) {
    throw new Error("Default confidence threshold is missing from evaluation candidates.");
  }

  if (current.falseFallbackRate > MAX_FALSE_FALLBACK_RATE) {
    throw new Error(
      `Current threshold ${DEFAULT_INTENT_CONFIDENCE_THRESHOLD} exceeds the ${MAX_FALSE_FALLBACK_RATE}% false-fallback target. ` +
        `Use the recommended threshold after reviewing the evaluation results.`,
    );
  }

  if (current.falsePositiveRate > MAX_FALSE_POSITIVE_RATE) {
    throw new Error(
      `Current threshold ${DEFAULT_INTENT_CONFIDENCE_THRESHOLD} exceeds the ${MAX_FALSE_POSITIVE_RATE}% false-positive target. ` +
        `Use the recommended threshold after reviewing the evaluation results.`,
    );
  }

  const failures = results.filter((result) => {
    if (result.expected === undefined) {
      return applyThreshold(result, DEFAULT_INTENT_CONFIDENCE_THRESHOLD) !== "unrecognized";
    }
    return applyThreshold(result, DEFAULT_INTENT_CONFIDENCE_THRESHOLD) !== result.expected;
  });

  if (failures.length > 0) {
    console.log("\nCases misclassified at the current threshold:");
    console.table(failures.map((result) => ({
      input: result.input,
      expected: result.expected ?? "unrecognized",
      predicted: result.predicted,
      confidence: result.confidence.toFixed(2),
    })));
  }
}

main().catch((error) => {
  console.error("Intent evaluation failed:", error);
  process.exitCode = 1;
});
