import { detectIntentForRegression } from "./deterministicIntentClassifier.js";

const IN_SCOPE_CASES = [
  "n'oublie pas d'appeler sara", "ajoute tache appeler client", "faut que je finisse le rapport",
  "mets moi un rdv demain avec ali", "rdv dentiste jeudi 10h", "bloque du temps vendredi pour le projet",
  "supprime la tache appeler fournisseur", "enleve le rdv avec sara", "modifie la tache appeler client",
  "renomme la tache rapport", "change le rdv de demain à vendredi", "c koi mon planning cette semaine",
  "resume moi ma semaine", "resume mes taches", "qu'est ce que j'ai demain", "montre mes rendez vous",
  "bonjour", "salut assistant", "merci beaucoup", "a plus", "ca va", "tu peux m'aider",
  "comment tu peux m'aider", "j'ai besoin d'un rappel pour appeler maman", "mets un truc dans mon agenda lundi",
];

const OUT_OF_SCOPE_CASES = [
  "quelle est la capitale du Japon", "donne moi une recette de crêpes", "explique moi la relativité",
  "qui a gagné la coupe du monde", "traduis ce texte en espagnol", "écris moi un poème",
  "combien font 987 fois 42", "raconte moi une histoire drôle", "joue une chanson", "répare mon ordinateur",
  "cherche un hôtel à Paris", "donne moi une définition de blockchain", "comment apprendre le piano",
  "quel film dois je regarder", "pourquoi le ciel est bleu", "génère une image d'un chat",
  "donne moi des idées de voyage", "comment fonctionne une voiture", "aaaaaaaa bbbb cccc ???", "parle moi des dinosaures",
];

const inScope = IN_SCOPE_CASES.map((input) => ({ input, intent: detectIntentForRegression(input), confidence: 0.9 }));
const outOfScope = OUT_OF_SCOPE_CASES.map((input) => ({ input, intent: detectIntentForRegression(input), confidence: 0 }));

const falseFallbacks = inScope.filter((r) => r.intent === "unrecognized").length;
const missedFallbacks = outOfScope.filter((r) => r.intent !== "unrecognized").length;
const falseFallbackRate = (falseFallbacks / inScope.length) * 100;
const missedFallbackRate = (missedFallbacks / outOfScope.length) * 100;

console.table(inScope);
console.table(outOfScope);
console.log(`In-scope phrases: ${inScope.length}`);
console.log(`False fallback rate: ${falseFallbackRate.toFixed(1)}%`);
console.log(`Out-of-scope phrases: ${outOfScope.length}`);
console.log(`Missed fallback rate: ${missedFallbackRate.toFixed(1)}%`);

const report = {
  mode: "offline-regression",
  testedAt: new Date().toISOString(),
  inScopeCount: inScope.length,
  outOfScopeCount: outOfScope.length,
  falseFallbacks,
  falseFallbackRate,
  missedFallbacks,
  missedFallbackRate,
  thresholds: { maxFalseFallbackRate: 10, maxMissedFallbackRate: 10 },
  inScope,
  outOfScope,
};

if (falseFallbackRate > 10 || missedFallbackRate > 10) {
  console.error("Fallback regression threshold exceeded.");
  process.exitCode = 1;
}

const fs = await import("node:fs/promises");
await fs.mkdir("test-results", { recursive: true });
await fs.writeFile("test-results/fallback-report.json", JSON.stringify(report, null, 2));
