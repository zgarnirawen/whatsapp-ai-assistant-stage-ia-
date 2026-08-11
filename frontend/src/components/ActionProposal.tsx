import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type ActionProposalLanguage = 'fr' | 'en';

export interface ActionProposalData {
  interactionId: string;
  intent: string;
  details: Record<string, any>;
  targetId?: string | null;
  requiresValidation: boolean;
  language?: ActionProposalLanguage;
}

interface ActionProposalProps {
  action: ActionProposalData;
  onValidate: () => void;
  onIgnore: () => void;
  onSaveEdit: (details: Record<string, any>) => void;
  onModifyRequest: () => void;
  formatDate: (dateTime: string | undefined, lang: ActionProposalLanguage) => string;
}

const COPY = {
  fr: {
    proposed: 'Action proposée',
    validate: 'Valider',
    ignore: 'Ignorer',
    modify: 'Modifier',
    save: 'Enregistrer',
    cancel: 'Annuler',
    taskTitle: 'Nom de la tâche',
    eventTitle: "Nom de l'événement",
    eventDate: 'Date et heure',
    newTaskTitle: 'Nouveau nom de la tâche',
    newEventTitle: "Nouveau nom de l'événement",
    newEventDate: 'Nouvelle date et heure',
    deleteTask: 'Supprimer la tâche',
    deleteEvent: "Supprimer l'événement",
    createTask: 'Créer la tâche',
    createEvent: "Créer l'événement",
    renameTask: 'Renommer la tâche',
    changeEvent: "Modifier l'événement",
    dateHint: 'Ex : 2026-08-15 10:00',
    empty: 'Le champ ne peut pas être vide.',
    invalidDate: 'Format de date invalide. Utilisez par exemple 2026-08-15 10:00.',
    editDeleteHint: 'Vous pouvez modifier la demande dans le champ de discussion avant de la renvoyer.',
  },
  en: {
    proposed: 'Proposed action',
    validate: 'Confirm',
    ignore: 'Ignore',
    modify: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    taskTitle: 'Task title',
    eventTitle: 'Event title',
    eventDate: 'Date and time',
    newTaskTitle: 'New task title',
    newEventTitle: 'New event title',
    newEventDate: 'New date and time',
    deleteTask: 'Delete task',
    deleteEvent: 'Delete event',
    createTask: 'Create task',
    createEvent: 'Create event',
    renameTask: 'Rename task',
    changeEvent: 'Change event',
    dateHint: 'E.g. 2026-08-15 10:00',
    empty: 'This field cannot be empty.',
    invalidDate: 'Invalid date format. For example: 2026-08-15 10:00.',
    editDeleteHint: 'You can edit the request in the chat field before sending it again.',
  },
} as const;

function getActionLabel(intent: string, lang: ActionProposalLanguage) {
  const copy = COPY[lang];
  switch (intent) {
    case 'create_task':
      return copy.createTask;
    case 'create_event':
      return copy.createEvent;
    case 'delete_task':
      return copy.deleteTask;
    case 'delete_event':
      return copy.deleteEvent;
    case 'modify_task':
      return copy.renameTask;
    case 'modify_event':
      return copy.changeEvent;
    default:
      return copy.proposed;
  }
}

function getSummary(action: ActionProposalData, lang: ActionProposalLanguage, formatDate: ActionProposalProps['formatDate']) {
  const details = action.details || {};
  const target = details.targetTitleQuery || details.taskTitle || details.eventTitle || '';
  const nextTitle = details.newTaskTitle || details.newEventTitle || '';
  const eventDateTime = details.newEventDateTime || details.eventDateTime;

  switch (action.intent) {
    case 'create_task':
      return details.taskTitle ? `« ${details.taskTitle} »` : '';
    case 'create_event':
      return [
        details.eventTitle ? `« ${details.eventTitle} »` : '',
        eventDateTime ? formatDate(eventDateTime, lang) : '',
      ].filter(Boolean).join(' · ');
    case 'delete_task':
    case 'delete_event':
      return target ? `« ${target} »` : '';
    case 'modify_task':
      return [target ? `« ${target} »` : '', nextTitle ? `→ « ${nextTitle} »` : '']
        .filter(Boolean)
        .join(' ');
    case 'modify_event':
      return [
        target ? `« ${target} »` : '',
        nextTitle ? `→ « ${nextTitle} »` : '',
        eventDateTime ? `· ${formatDate(eventDateTime, lang)}` : '',
      ].filter(Boolean).join(' ');
    default:
      return '';
  }
}

export default function ActionProposal({
  action,
  onValidate,
  onIgnore,
  onSaveEdit,
  onModifyRequest,
  formatDate,
}: ActionProposalProps) {
  const lang = action.language === 'en' ? 'en' : 'fr';
  const copy = COPY[lang];
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [error, setError] = useState('');

  const editable = useMemo(
    () => ['create_task', 'create_event', 'modify_task', 'modify_event'].includes(action.intent),
    [action.intent]
  );

  const beginEdit = () => {
    setError('');
    if (!editable) {
      onModifyRequest();
      return;
    }

    if (action.intent === 'create_task') {
      setDraftTitle(action.details?.taskTitle || '');
    } else if (action.intent === 'create_event') {
      setDraftTitle(action.details?.eventTitle || '');
      setDraftDate(action.details?.eventDateTime || '');
    } else if (action.intent === 'modify_task') {
      setDraftTitle(action.details?.newTaskTitle || '');
    } else if (action.intent === 'modify_event') {
      setDraftTitle(action.details?.newEventTitle || '');
      setDraftDate(action.details?.newEventDateTime || '');
    }
    setEditing(true);
  };

  const saveEdit = () => {
    const title = draftTitle.trim();
    if (!title) {
      setError(copy.empty);
      return;
    }

    const nextDetails = { ...action.details };

    if (action.intent === 'create_task') {
      nextDetails.taskTitle = title;
    } else if (action.intent === 'create_event') {
      nextDetails.eventTitle = title;
      if (draftDate.trim()) {
        const parsed = new Date(draftDate.trim());
        if (Number.isNaN(parsed.getTime())) {
          setError(copy.invalidDate);
          return;
        }
        nextDetails.eventDateTime = parsed.toISOString();
      }
    } else if (action.intent === 'modify_task') {
      nextDetails.newTaskTitle = title;
    } else if (action.intent === 'modify_event') {
      nextDetails.newEventTitle = title;
      if (draftDate.trim()) {
        const parsed = new Date(draftDate.trim());
        if (Number.isNaN(parsed.getTime())) {
          setError(copy.invalidDate);
          return;
        }
        nextDetails.newEventDateTime = parsed.toISOString();
      }
    }

    setError('');
    setEditing(false);
    onSaveEdit(nextDetails);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>{copy.proposed}</Text>
          <Text style={styles.actionTitle}>{getActionLabel(action.intent, lang)}</Text>
        </View>
      </View>

      {!editing ? (
        <>
          <Text style={styles.summary}>
            {getSummary(action, lang, formatDate) || copy.proposed}
          </Text>
          {action.intent === 'delete_task' || action.intent === 'delete_event' ? (
            <Text style={styles.hint}>{copy.editDeleteHint}</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.validateButton]} onPress={onValidate}>
              <Text style={styles.validateText}>{copy.validate}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.modifyButton]} onPress={beginEdit}>
              <Text style={styles.modifyText}>{copy.modify}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.ignoreButton]} onPress={onIgnore}>
              <Text style={styles.ignoreText}>{copy.ignore}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.editPanel}>
          <Text style={styles.fieldLabel}>
            {action.intent === 'create_task'
              ? copy.taskTitle
              : action.intent === 'create_event'
              ? copy.eventTitle
              : action.intent === 'modify_task'
              ? copy.newTaskTitle
              : copy.newEventTitle}
          </Text>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            style={styles.editInput}
            placeholder={lang === 'fr' ? 'Saisissez une nouvelle valeur...' : 'Enter a new value...'}
            placeholderTextColor="#8B938E"
            autoFocus
          />

          {(action.intent === 'create_event' || action.intent === 'modify_event') && (
            <>
              <Text style={styles.fieldLabel}>{action.intent === 'create_event' ? copy.eventDate : copy.newEventDate}</Text>
              <TextInput
                value={draftDate}
                onChangeText={setDraftDate}
                style={styles.editInput}
                placeholder={copy.dateHint}
                placeholderTextColor="#8B938E"
                autoCapitalize="none"
              />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.button, styles.validateButton]} onPress={saveEdit}>
              <Text style={styles.validateText}>{copy.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.ignoreButton]}
              onPress={() => {
                setEditing(false);
                setError('');
              }}>
              <Text style={styles.ignoreText}>{copy.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDAD3',
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#123F36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: '#6E7370',
    fontSize: 11,
  },
  actionTitle: {
    color: '#1B1F1D',
    fontSize: 15,
    fontWeight: '700',
  },
  summary: {
    color: '#1B1F1D',
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: '#6E7370',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButton: {
    backgroundColor: '#123F36',
    flex: 1,
  },
  modifyButton: {
    backgroundColor: '#E1EEEA',
    borderWidth: 1,
    borderColor: '#BFDAD3',
    flex: 1,
  },
  ignoreButton: {
    backgroundColor: '#F6F3EC',
    borderWidth: 1,
    borderColor: '#E4DFD3',
    flex: 1,
  },
  validateText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modifyText: {
    color: '#123F36',
    fontWeight: '700',
  },
  ignoreText: {
    color: '#1B1F1D',
    fontWeight: '600',
  },
  editPanel: {
    gap: 8,
  },
  fieldLabel: {
    color: '#1C6B5C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  editInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D5DCD8',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#1B1F1D',
    backgroundColor: '#F9FBFA',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  error: {
    color: '#B5502A',
    fontSize: 12,
    lineHeight: 17,
  },
});
