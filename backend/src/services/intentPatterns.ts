export type PatternIntent =
  | "create_task"
  | "create_event"
  | "summarize_period"
  | "greeting"
  | "farewell"
  | "thanks"
  | "small_talk"
  | "capabilities"
  | "unrecognized";

/**
 * Human-style utterances used as the stable regression corpus for intent detection.
 * Keep these independent from the Groq API so CI can validate intent boundaries offline.
 */
export const INTENT_PATTERN_CASES: Array<{ input: string; expected: PatternIntent }> = [
  // create_task: informal wording, typos and voice-to-text-like phrasing.
  { input: "n'oublie pas d'appeler sara", expected: "create_task" },
  { input: "ajoute tache appeler client", expected: "create_task" },
  { input: "faut que je finisse le rapport", expected: "create_task" },
  { input: "rappelle-moi de payer la facture", expected: "create_task" },
  { input: "mets une tâche pour préparer la réunion", expected: "create_task" },
  { input: "je dois penser à envoyer le mail", expected: "create_task" },
  { input: "ajoute moi un rappel pour lundi", expected: "create_task" },
  { input: "crée une tache appeler maman ce soir", expected: "create_task" },
  { input: "note comme tâche de vérifier les serveurs", expected: "create_task" },
  { input: "faut pas que j'oublie le dossier client", expected: "create_task" },
  { input: "rajoute le rapport à mes tâches", expected: "create_task" },
  { input: "mets dans mes taches préparer la démo", expected: "create_task" },

  // create_event.
  { input: "mets moi un rdv demain avec ali", expected: "create_event" },
  { input: "rdv dentiste jeudi 10h", expected: "create_event" },
  { input: "bloque du temps vendredi pour le projet", expected: "create_event" },
  { input: "ajoute une réunion lundi à 9h", expected: "create_event" },
  { input: "programme un rendez-vous avec sara", expected: "create_event" },
  { input: "mets un truc dans mon agenda lundi", expected: "create_event" },
  { input: "crée un événement demain matin", expected: "create_event" },
  { input: "planifie une réunion avec le client", expected: "create_event" },
  { input: "réserve mercredi 14h pour la démo", expected: "create_event" },
  { input: "ajoute ça au calendrier vendredi", expected: "create_event" },
  { input: "organise un rdv avec le fournisseur", expected: "create_event" },
  { input: "bloque mardi après-midi pour le projet", expected: "create_event" },

  // summarize_period.
  { input: "c koi mon planning cette semaine", expected: "summarize_period" },
  { input: "résume moi ma semaine", expected: "summarize_period" },
  { input: "résume mes tâches", expected: "summarize_period" },
  { input: "qu'est ce que j'ai demain", expected: "summarize_period" },
  { input: "montre mes rendez vous", expected: "summarize_period" },
  { input: "quel est mon agenda aujourd'hui", expected: "summarize_period" },
  { input: "fais moi le résumé de mon planning", expected: "summarize_period" },
  { input: "je veux voir mes tâches de la semaine", expected: "summarize_period" },
  { input: "qu'est-ce qui est prévu vendredi", expected: "summarize_period" },
  { input: "montre ce que j'ai au calendrier", expected: "summarize_period" },
  { input: "résume mes rendez-vous de demain", expected: "summarize_period" },
  { input: "voir mon planning pour lundi", expected: "summarize_period" },

  // Conversation / lightweight intents.
  { input: "bonjour", expected: "greeting" },
  { input: "salut assistant", expected: "greeting" },
  { input: "coucou", expected: "greeting" },
  { input: "hello", expected: "greeting" },
  { input: "hey", expected: "greeting" },
  { input: "bonjour ça va", expected: "greeting" },
  { input: "au revoir", expected: "farewell" },
  { input: "bye", expected: "farewell" },
  { input: "à plus tard", expected: "farewell" },
  { input: "merci beaucoup", expected: "thanks" },
  { input: "merci", expected: "thanks" },
  { input: "thanks pour ton aide", expected: "thanks" },
  { input: "ça va ?", expected: "small_talk" },
  { input: "comment ça va", expected: "small_talk" },
  { input: "tu peux m'aider", expected: "capabilities" },
  { input: "comment tu peux m'aider", expected: "capabilities" },
  { input: "qu'est-ce que tu sais faire", expected: "capabilities" },
  { input: "quelles actions peux-tu faire", expected: "capabilities" },
];

export const OUT_OF_SCOPE_PATTERN_CASES = [
  "quelle est la capitale du Japon",
  "donne moi une recette de crêpes",
  "explique moi la relativité",
  "qui a gagné la coupe du monde",
  "traduis ce texte en espagnol",
  "écris moi un poème",
  "combien font 987 fois 42",
  "raconte moi une histoire drôle",
  "cherche un hôtel à Paris",
  "pourquoi le ciel est bleu",
  "génère une image d'un chat",
  "parle moi des dinosaures",
];
