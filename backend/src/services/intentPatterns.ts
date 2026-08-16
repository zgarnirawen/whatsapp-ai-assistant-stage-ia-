import type { DetectedIntent } from "./intentDetection.js";

export interface IntentPatternSet {
  intent: Exclude<DetectedIntent, "unrecognized">;
  examples: readonly string[];
}

/**
 * Curated utterances used as lightweight few-shot guidance and as the
 * regression/evaluation dataset for the intent classifier.
 * Keep these examples representative of real text/voice input: French/English,
 * abbreviations, missing accents, typos and informal phrasing.
 */
export const INTENT_PATTERNS: readonly IntentPatternSet[] = [
  {
    intent: "create_task",
    examples: [
      "n'oublie pas d'appeler Sara",
      "ajoute une tâche appeler le client",
      "faut que je finisse le rapport",
      "rappelle-moi de payer la facture",
      "je dois envoyer le dossier demain",
    ],
  },
  {
    intent: "create_event",
    examples: [
      "mets-moi un rdv demain avec Ali",
      "rdv dentiste jeudi à 10h",
      "bloque du temps vendredi pour le projet",
      "ajoute une réunion lundi matin",
      "schedule a meeting with Sarah tomorrow",
    ],
  },
  {
    intent: "modify_task",
    examples: [
      "renomme la tâche rapport en rapport final",
      "modifie appeler client en appeler le client demain",
      "change le titre de ma tâche courses",
      "mets la tâche réviser à demain",
      "rename my report task to final report",
    ],
  },
  {
    intent: "delete_task",
    examples: [
      "supprime la tâche appeler fournisseur",
      "enlève ma tâche courses",
      "delete the task about the report",
      "je n'ai plus besoin de la tâche banque",
      "efface la tâche préparer présentation",
    ],
  },
  {
    intent: "modify_event",
    examples: [
      "change le rdv de demain à vendredi",
      "décale ma réunion à 15h",
      "modifie le rendez-vous avec Sara",
      "move my meeting to Monday",
      "change l'heure du dentiste à 11h",
    ],
  },
  {
    intent: "delete_event",
    examples: [
      "enlève le rdv avec Sara",
      "supprime ma réunion de demain",
      "cancel the appointment with Ali",
      "annule le rendez-vous dentiste",
      "je veux supprimer l'événement projet",
    ],
  },
  {
    intent: "summarize_period",
    examples: [
      "c koi mon planning cette semaine",
      "résume-moi ma semaine",
      "résume mes tâches",
      "qu'est-ce que j'ai demain",
      "show me my schedule for this week",
    ],
  },
  {
    intent: "greeting",
    examples: [
      "bonjour",
      "salut assistant",
      "coucou",
      "hello assistant",
      "hey",
    ],
  },
  {
    intent: "farewell",
    examples: [
      "au revoir",
      "à plus",
      "bye assistant",
      "see you later",
      "bonne journée, à bientôt",
    ],
  },
  {
    intent: "thanks",
    examples: [
      "merci",
      "merci beaucoup",
      "thanks",
      "thank you assistant",
      "c'est gentil merci",
    ],
  },
  {
    intent: "small_talk",
    examples: [
      "ça va",
      "comment vas-tu",
      "tu vas bien ?",
      "how are you",
      "quoi de neuf ?",
    ],
  },
  {
    intent: "capabilities",
    examples: [
      "tu peux m'aider ?",
      "comment tu peux m'aider",
      "qu'est-ce que tu sais faire",
      "what can you do",
      "help me use the assistant",
    ],
  },
];

export const ALL_INTENT_EXAMPLES = INTENT_PATTERNS.flatMap(({ intent, examples }) =>
  examples.map((input) => ({ input, expectedIntent: intent })),
);

export const INTENT_PATTERN_SUMMARY = INTENT_PATTERNS
  .map(({ intent, examples }) => `${intent}: ${examples.join(" | ")}`)
  .join("\n");
