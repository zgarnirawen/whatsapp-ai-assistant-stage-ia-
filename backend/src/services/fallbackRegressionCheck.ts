import "dotenv/config";
import { detectIntent } from "./intentDetection.js";

const IN_SCOPE_CASES = [
  "n'oublie pas d'appeler sara",
  "ajoute tache appeler client",
  "faut que je finisse le rapport",
  "mets moi un rdv demain avec ali",
  "rdv dentiste jeudi 10h",
  "bloque du temps vendredi pour le projet",
  "supprime la tache appeler fournisseur",
  "enleve le rdv avec sara",
  "modifie appeler client en appeler le client demain",
  "renomme la tache rapport en rapport final",
  "change le rdv de demain à vendredi",
  "c koi mon planning cette semaine",
  "resume moi ma semaine",
  "resume mes taches",
  "qu'est ce que j'ai demain",
  "montre mes rendez vous",
  "bonjour",
  "salut assistant",
  "merci beaucoup",
  "a plus",
  "ca va",
  "tu peux m'aider",
  "comment tu peux m'aider",
  "j'ai besoin d'un rappel pour appeler maman",
  "mets un truc dans mon agenda lundi",
];

const OUT_OF_SCOPE_CASES = [
  "quelle est la capitale du Japon",
  "donne moi une recette de crêpes",
  "explique moi la relativité",
  "qui a gagné la coupe du monde",
  "traduis ce texte en espagnol",
  "écris moi un poème",
  "quelle est la météo demain",
  "combien font 987 fois 42",
  "raconte moi une histoire drôle",
  "joue une chanson",
  "répare mon ordinateur",
  "cherche un hôtel à Paris",
  "donne moi une définition de blockchain",
  "comment apprendre le piano",
  "quel film dois je regarder",
  "pourquoi le ciel est bleu",
  "génère une image d'un chat",
  "donne moi des idées de voyage",
  "comment fonctionne une voiture",
  "aaaaaaaa bbbb cccc ???",
];

async function classifyCases(inputs: string[]) {
  const results: Array<{ input: string; intent: string; confidence: number }> = [];
  for (const input of inputs) {
    const result = await detectIntent(input);
    results.push({
      input,
      intent: result.intent,
      confidence: result.confidence ?? 0,
    });
  }
  return results;
}

async function main() {
  const inScope = await classifyCases(IN_SCOPE_CASES);
  const outOfScope = await classifyCases(OUT_OF_SCOPE_CASES);

  const falseFallbacks = inScope.filter((result) => result.intent === "unrecognized").length;
  const missedFallbacks = outOfScope.filter((result) => result.intent !== "unrecognized").length;
  const falseFallbackRate = (falseFallbacks / inScope.length) * 100;
  const missedFallbackRate = (missedFallbacks / outOfScope.length) * 100;

  const report = {
    testedAt: new Date().toISOString(),
    inScopeCount: inScope.length,
    outOfScopeCount: outOfScope.length,
    falseFallbacks,
    falseFallbackRate,
    missedFallbacks,
    missedFallbackRate,
    thresholds: {
      maxFalseFallbackRate: 10,
      maxMissedFallbackRate: 10,
    },
    inScope,
    outOfScope,
  };

  console.table(inScope);
  console.table(outOfScope);
  console.log(`In-scope phrases: ${inScope.length}`);
  console.log(`False fallback rate: ${falseFallbackRate.toFixed(1)}%`);
  console.log(`Out-of-scope phrases: ${outOfScope.length}`);
  console.log(`Missed fallback rate: ${missedFallbackRate.toFixed(1)}%`);

  if (falseFallbackRate > 10 || missedFallbackRate > 10) {
    console.error("Fallback regression threshold exceeded.");
    process.exitCode = 1;
  }

  const fs = await import("node:fs/promises");
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile("test-results/fallback-report.json", JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("Fallback regression test failed:", error);
  process.exitCode = 1;
});
