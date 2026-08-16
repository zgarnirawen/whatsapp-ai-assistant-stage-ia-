export type RegressionIntent =
  | "create_task" | "create_event" | "modify_task" | "delete_task"
  | "modify_event" | "delete_event" | "summarize_period" | "greeting"
  | "farewell" | "thanks" | "small_talk" | "capabilities" | "unrecognized";

const rules: Array<{ intent: RegressionIntent; patterns: RegExp[] }> = [
  { intent: "delete_task", patterns: [/\b(?:supprime|supprimer|enlève|enleve|efface|effacer)\b/i, /\b(?:tache|tâche)\b/i] },
  { intent: "delete_event", patterns: [/\b(?:supprime|supprimer|enlève|enleve|efface|effacer)\b/i, /\b(?:rdv|rendez[- ]vous|agenda)\b/i] },
  { intent: "modify_task", patterns: [/\b(?:modifie|modifier|renomme|renommer|change|changer)\b/i, /\b(?:tache|tâche)\b/i] },
  { intent: "modify_event", patterns: [/\b(?:modifie|modifier|change|changer)\b/i, /\b(?:rdv|rendez[- ]vous)\b/i] },
  { intent: "create_event", patterns: [/(?:\brdv\b|\brendez[- ]vous\b|\bagenda\b|\bcalendrier\b|\bbloque\b|\bréunion\b|\breunion\b|\bprogramme\b|\bplanifie\b|\bréserve\b|\breserve\b|\b(?:é|e)venement\b)/i] },
  { intent: "create_task", patterns: [/(?:\btache\b|\btâche\b|\brappel\b|\brappelle\b|n'oublie|n’oublie|\bfaut que\b|\bajoute?\b.*\btache\b|\bcrée?\b.*\btache\b)/i] },
  { intent: "summarize_period", patterns: [/(?:planning|agenda|rendez[- ]vous|rdv|taches|tâches|semaine|demain|aujourd'hui|aujourd’hui|calendrier)/i, /(?:resume|résume|résumé|montre|voir|qu'est[- ]ce que j'ai|qu’est[- ]ce que j’ai|qu'est[- ]ce qui est prévu|qu’est[- ]ce qui est prévu|quel est|fais moi|faire le résumé)/i] },
  { intent: "greeting", patterns: [/^\s*(?:bonjour|salut|coucou|hello|hey)\b/i] },
  { intent: "farewell", patterns: [/\b(?:au revoir|bye|à plus|a plus)\b/i] },
  { intent: "thanks", patterns: [/\b(?:merci|thanks)\b/i] },
  { intent: "small_talk", patterns: [/\b(?:ça va|ca va|comment ça va|comment ca va)\b/i] },
  { intent: "capabilities", patterns: [/(?:que peux[- ]tu|tu peux m'aider|tu peux m’aider|comment tu peux m'aider|comment tu peux m’aider|aide[- ]moi|qu'est[- ]ce que tu sais faire|quelles actions peux[- ]tu faire)/i] },
];

export function detectIntentForRegression(input: string): RegressionIntent {
  const value = input.trim();
  if (!value) return "unrecognized";
  for (const rule of rules) {
    if (rule.patterns.every((pattern) => pattern.test(value))) return rule.intent;
  }
  return "unrecognized";
}
