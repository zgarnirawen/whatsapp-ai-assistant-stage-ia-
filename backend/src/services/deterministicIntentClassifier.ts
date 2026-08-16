export type RegressionIntent =
  | "create_task" | "create_event" | "modify_task" | "delete_task"
  | "modify_event" | "delete_event" | "summarize_period" | "greeting"
  | "farewell" | "thanks" | "small_talk" | "capabilities" | "unrecognized";

const has = (value: string, pattern: RegExp) => pattern.test(value);

/**
 * Offline deterministic classifier used only for regression validation.
 * Production intent detection remains backed by the online classifier.
 * Ordering is intentional: explicit task/event creation and read-only
 * summary requests must win over broad calendar/task vocabulary.
 */
export function detectIntentForRegression(input: string): RegressionIntent {
  const value = input.trim().toLocaleLowerCase("fr-FR");
  if (!value) return "unrecognized";

  // Lightweight conversational intents first.
  if (/^\s*(?:bonjour|salut|coucou|hello|hey)(?:\b|\s)/i.test(value)) return "greeting";
  if (/\b(?:au revoir|bye|à plus(?: tard)?|a plus(?: tard)?)\b/i.test(value)) return "farewell";
  if (/\b(?:merci|thanks)\b/i.test(value)) return "thanks";
  if (/\b(?:ça va|ca va|comment ça va|comment ca va)\b/i.test(value)) return "small_talk";
  if (/(?:que peux[- ]tu|tu peux m'aider|tu peux m’aider|comment tu peux m'aider|comment tu peux m’aider|aide[- ]moi|qu'est[- ]ce que tu sais faire|quelles actions peux[- ]tu faire)/i.test(value)) return "capabilities";

  // Explicit destructive/modification commands have higher priority than
  // generic task/event vocabulary.
  const taskWord = /\b(?:tache|tâche|taches|tâches)\b/i;
  const eventWord = /\b(?:rdv|rendez[- ]vous|réunion|reunion|événement|evenement)\b/i;
  if (has(value, /\b(?:supprime|supprimer|enlève|enleve|efface|effacer)\b/i) && taskWord.test(value)) return "delete_task";
  if (has(value, /\b(?:supprime|supprimer|enlève|enleve|efface|effacer)\b/i) && (eventWord.test(value) || /\bagenda\b/i.test(value))) return "delete_event";
  if (has(value, /\b(?:modifie|modifier|renomme|renommer|change|changer)\b/i) && taskWord.test(value)) return "modify_task";
  if (has(value, /\b(?:modifie|modifier|change|changer)\b/i) && eventWord.test(value)) return "modify_event";

  // Explicit task creation language. These rules intentionally precede
  // event rules because a task can mention a meeting/event in its content.
  if (
    taskWord.test(value) ||
    /\b(?:rappel|rappelle(?:-moi)?|rappelle moi)\b/i.test(value) ||
    /\b(?:n'oublie|n’oublie|faut(?: pas)? que|je dois penser à|je dois penser a)\b/i.test(value) ||
    /\b(?:ajoute|rajoute|mets|met)\b.*\b(?:à|a|dans)\b.*\b(?:mes )?(?:taches|tâches)\b/i.test(value) ||
    /\b(?:ajoute|rajoute|mets|met)\b.*\b(?:tache|tâche)\b/i.test(value) ||
    /\b(?:crée|cree|créer|creer)\b.*\b(?:tache|tâche)\b/i.test(value) ||
    /\b(?:note comme tâche|note comme tache)\b/i.test(value)
  ) return "create_task";

  // Explicit event creation language. Handle both accented and unaccented
  // forms because speech-to-text frequently drops accents.
  if (
    /\b(?:rdv|rendez[- ]vous|réunion|reunion|événement|evenement)\b/i.test(value) &&
    /\b(?:mets?|ajoute|ajouter|crée|cree|programme|planifie|organise|bloque|réserve|reserve)\b/i.test(value)
  ) return "create_event";
  if (/\b(?:bloque|programme|planifie|réserve|reserve|organise)\b/i.test(value)) return "create_event";
  if (/\b(?:ajoute|ajouter|mets|met)\b.*\b(?:agenda|calendrier)\b/i.test(value)) return "create_event";

  // Read-only calendar/task requests must come before generic event words.
  const summaryRequest = /(?:résume|resume|résumé|resumé|montre|voir|fais moi|faire le résumé|qu'est[- ]ce que j'ai|qu’est[- ]ce que j’ai|qu'est[- ]ce qui est prévu|qu’est[- ]ce qui est prévu|quel est|c\s*koi|ce que j'ai|ce que j’ai)/i;
  const planningSubject = /(?:planning|agenda|rendez[- ]vous|rdv|taches|tâches|semaine|demain|aujourd'hui|aujourd’hui|calendrier)/i;
  if (summaryRequest.test(value) && planningSubject.test(value)) return "summarize_period";

  // Common implicit summary forms such as "qu'est-ce qui est prévu vendredi".
  if (/(?:qu'est[- ]ce|qu’est[- ]ce|quel|quelle|montre|voir|résume|resume)/i.test(value) && /(?:prévu|prevu|vendredi|lundi|mardi|mercredi|jeudi|semaine|demain|aujourd'hui|aujourd’hui)/i.test(value)) return "summarize_period";

  return "unrecognized";
}
