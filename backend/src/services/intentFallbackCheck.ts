import "dotenv/config";
import { detectIntent } from "./intentDetection.js";

// These are intentionally informal, abbreviated, typo-prone but still in-scope requests.
// They should normally resolve to a supported intent rather than the fallback.
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

async function main() {
  let falseFallbacks = 0;
  const results: Array<{ input: string; intent: string; confidence: number }> = [];

  for (const input of IN_SCOPE_CASES) {
    const result = await detectIntent(input);
    const confidence = result.confidence ?? 0;
    results.push({ input, intent: result.intent, confidence });
    if (result.intent === "unrecognized") falseFallbacks += 1;
  }

  const rate = (falseFallbacks / IN_SCOPE_CASES.length) * 100;
  console.table(results);
  console.log(`Tested ${IN_SCOPE_CASES.length} in-scope informal phrases.`);
  console.log(`False fallback count: ${falseFallbacks}`);
  console.log(`False fallback rate: ${rate.toFixed(1)}%`);

  // A fallback rate above 10% means the classifier needs prompt/model tuning.
  if (rate > 10) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Intent fallback test failed:", error);
  process.exitCode = 1;
});
