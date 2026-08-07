export type Lang = 'fr' | 'en';

export const RESPONSES: Record<Lang, any> = {
  fr: {
    conversational: {
      unrecognized: "Je n'ai pas compris, peux-tu reformuler ?",
      error: "Une erreur est survenue.",
      greeting: "Bonjour ! Je suis votre assistant. Que puis-je faire pour vous ?",
      farewell: "À bientôt !",
      thanks: "Avec plaisir !",
      small_talk: "Je suis là pour vous aider avec vos tâches, votre agenda et vos résumés. Que puis-je faire pour vous ?",
      capabilities: "Je peux créer des tâches, gérer votre agenda, et résumer une période. Dites-moi ce que vous voulez faire.",
    },
    defaults: {
      task: 'Tâche sans titre',
      event: 'Événement sans titre',
    },
    confirmation: {
      create_task: 'Tâche créée : {title}',
      create_event: 'Événement créé : {title} ({date})',
      modify_task: 'Tâche modifiée : {title}',
      modify_event: 'Événement modifié : {title} ({date})',
      delete_task: 'Tâche supprimée : {title}',
      delete_event: 'Événement supprimé : {title}',
    },
    modify: {
      not_found: "Aucune correspondance trouvée pour : {query}",
      ambiguous: "Plusieurs éléments correspondent à : {query}",
    },
    labels: {
      tasks: 'tâches',
      events: 'rendez-vous',
      summary_wrapper: 'Voici votre résumé : {range}',
    },
  },
  en: {
    conversational: {
      unrecognized: "I didn't understand, can you rephrase?",
      error: "An error occurred.",
      greeting: "Hello! I'm your assistant. How can I help you?",
      farewell: "See you soon!",
      thanks: "You're welcome!",
      small_talk: "I'm here to help with your tasks, calendar and summaries. What can I do for you?",
      capabilities: "I can create tasks, manage your calendar, and summarize a period. Tell me what you'd like to do.",
    },
    defaults: {
      task: 'Untitled task',
      event: 'Untitled event',
    },
    confirmation: {
      create_task: 'Task created: {title}',
      create_event: 'Event created: {title} ({date})',
      modify_task: 'Task updated: {title}',
      modify_event: 'Event updated: {title} ({date})',
      delete_task: 'Task deleted: {title}',
      delete_event: 'Event deleted: {title}',
    },
    modify: {
      not_found: 'No match found for: {query}',
      ambiguous: 'Multiple matches for: {query}',
    },
    labels: {
      tasks: 'tasks',
      events: 'appointments',
      summary_wrapper: 'Here is your summary: {range}',
    },
  },
};

export function t(key: string, lang: Lang, vars?: Record<string, string>) {
  const parts = key.split('.');
  let cur: any = RESPONSES[lang];
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '';
  }
  let str = cur as string;
  if (vars) {
    for (const k of Object.keys(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
    }
  }
  return str;
}

export function formatDate(lang: Lang, iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', opts).format(d);
  } catch {
    return iso;
  }
}

export function formatDateRange(lang: Lang, start?: string, end?: string) {
  if (!start && !end) return '';
  if (!end) return formatDate(lang, start);
  return `${formatDate(lang, start)} - ${formatDate(lang, end)}`;
}

export default RESPONSES;
