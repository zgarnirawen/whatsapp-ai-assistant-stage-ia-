export type RegressionIntent =
  | "create_task" | "create_event" | "modify_task" | "delete_task"
  | "modify_event" | "delete_event" | "summarize_period" | "greeting"
  | "farewell" | "thanks" | "small_talk" | "capabilities" | "unrecognized";

/** Offline deterministic classifier used only by the regression suite. */
export function detectIntentForRegression(input: string): RegressionIntent {
  const value = input.trim().toLocaleLowerCase("fr-FR");
  if (!value) return "unrecognized";

  // Conversational intents: avoid relying on Unicode word-boundary behavior.
  if (/^(?:bonjour|salut|coucou|hello|hey)(?:\s|$)/i.test(value)) return "greeting";
  if (/^(?:au revoir|bye|à plus(?: tard)?|a plus(?: tard)?)(?:\s|$)/i.test(value)) return "farewell";
  if (/(?:^|\s)(?:merci|thanks)(?:\s|$)/i.test(value)) return "thanks";
  if (/(?:ça va|ca va|comment ça va|comment ca va)/i.test(value)) return "small_talk";
  if (/(?:que peux[- ]tu|tu peux m'aider|tu peux m’aider|comment tu peux m'aider|comment tu peux m’aider|aide[- ]moi|qu'est[- ]ce que tu sais faire|quelles actions peux[- ]tu faire)/i.test(value)) return "capabilities";

  const taskWord = /(?:^|\s)(?:tache|tâche|taches|tâches)(?:\s|$)/i;
  const eventWord = /(?:^|\s)(?:rdv|rendez[- ]vous|réunion|reunion|événement|evenement)(?:\s|$)/i;

  // Read-only requests must be evaluated before task/event creation because
  // their subject naturally contains words such as "tâches" or "agenda".
  const summaryRequest = /(?:résume|resume|résumé|montre|voir|fais moi|faire le résumé|qu'est[- ]ce que j'ai|qu’est[- ]ce que j’ai|qu'est[- ]ce qui est prévu|qu’est[- ]ce qui est prévu|quel est|c\s*koi|ce que j'ai|ce que j’ai|je veux voir)/i;
  const planningSubject = /(?:planning|agenda|rendez[- ]vous|rdv|taches|tâches|semaine|demain|aujourd'hui|aujourd’hui|calendrier|prévu|prevu|lundi|mardi|mercredi|jeudi|vendredi)/i;
  if (summaryRequest.test(value) && planningSubject.test(value)) return "summarize_period";

  // Explicit destructive/modification commands.
  if (/(?:supprime|supprimer|enlève|enleve|efface|effacer)/i.test(value) && taskWord.test(value)) return "delete_task";
  if (/(?:supprime|supprimer|enlève|enleve|efface|effacer)/i.test(value) && (eventWord.test(value) || /agenda/i.test(value))) return "delete_event";
  if (/(?:modifie|modifier|renomme|renommer|change|changer)/i.test(value) && taskWord.test(value)) return "modify_task";
  if (/(?:modifie|modifier|change|changer)/i.test(value) && eventWord.test(value)) return "modify_event";

  // Explicit task creation, including natural reminders and voice-style phrasing.
  if (
    taskWord.test(value) ||
    /(?:rappel|rappelle(?:-moi| moi)?)/i.test(value) ||
    /(?:n'oublie|n’oublie|faut(?: pas)? que|je dois penser à|je dois penser a)/i.test(value) ||
    /(?:ajoute|rajoute|mets|met).*?(?:mes )?(?:taches|tâches)/i.test(value) ||
    /(?:ajoute|rajoute|mets|met).*?(?:tache|tâche)/i.test(value) ||
    /(?:crée|cree|créer|creer).*?(?:tache|tâche)/i.test(value) ||
    /(?:note comme tâche|note comme tache)/i.test(value)
  ) return "create_task";

  // Event creation. A standalone "rdv ..." or "événement ..." is already
  // an unambiguous creation request in the supported assistant vocabulary.
  if (eventWord.test(value) || /(?:événement|evenement)/i.test(value)) return "create_event";
  if (/(?:bloque|programme|planifie|réserve|reserve|organise)/i.test(value)) return "create_event";
  if (/(?:ajoute|ajouter|mets|met).*?(?:agenda|calendrier)/i.test(value)) return "create_event";

  // Implicit planning summaries such as "qu'est-ce qui est prévu vendredi".
  if (/(?:qu'est[- ]ce|qu’est[- ]ce|quel|quelle|montre|voir|résume|resume)/i.test(value) && /(?:prévu|prevu|vendredi|lundi|mardi|mercredi|jeudi|semaine|demain|aujourd'hui|aujourd’hui)/i.test(value)) return "summarize_period";

  return "unrecognized";
}
