import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import axios from 'axios';
import {
  useFonts as useSpaceGrotesk,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  useFonts as useIBMPlexSans,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';

const API_BASE_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.224.58.5:3000';

const colors = {
  bg: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEAE0',
  ink: '#1B1F1D',
  inkSoft: '#6E7370',
  inkFaint: '#A6A9A2',
  teal: '#1C6B5C',
  tealDeep: '#123F36',
  tealPale: '#E1EEEA',
  coral: '#E2703A',
  line: '#E4DFD3',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  variant?: 'normal' | 'error';
}

interface ProposedAction {
  interactionId: string;
  intent: string;
  details: any;
  targetId?: string | null;
  requiresValidation: boolean;
  language?: Lang;
}

type Lang = 'fr' | 'en';

type ClarificationState = {
  pendingAction: ProposedAction;
  targetTitle: string;
  lang: Lang;
  missingField: 'newTaskTitle' | 'newEventTitle';
};

const UI_TEXT = {
  fr: {
    createTaskConfirm: (title: string) => `Créer la tâche "${title}" ?`,
    createEventConfirm: (title: string, dateLabel: string) =>
      `Créer l'événement "${title}"${dateLabel ? ` le ${dateLabel}` : ''} ?`.replace(/\s+/g, ' ').trim(),
    deleteTaskConfirm: (title: string) => `Supprimer la tâche "${title}" ?`,
    deleteEventConfirm: (title: string) => `Supprimer l'événement "${title}" ?`,
    modifyTaskConfirm: (target: string, nextTitle: string) => `Renommer la tâche "${target}" en "${nextTitle}" ?`,
    modifyTaskClarify: (target: string) => `Quel nouveau nom souhaitez-vous donner à la tâche "${target}" ?`,
    modifyEventConfirm: (target: string, nextTitle: string) => `Modifier l'événement "${target}" en "${nextTitle}" ?`,
    modifyEventClarify: (target: string) => `Quel nouveau nom souhaitez-vous donner à l'événement "${target}" ?`,
    notFound: (query: string) => `Aucune tâche ou aucun événement trouvé correspondant à "${query}".`,
    ambiguous: (titles: string) => `Plusieurs éléments correspondent, précisez lequel :\n${titles}`,
    summaryClarify: "Pour quelle période voulez-vous un résumé ? (ex : cette semaine, aujourd'hui...)",
    summaryIntro: 'Résumé',
    summaryNoTasks: 'aucune tâche trouvée.',
    summaryNoEvents: 'aucun événement trouvé.',
    summaryNoItems: 'aucune tâche ni événement trouvé.',
    actionConfirmed: 'Action confirmée et exécutée.',
    actionCancelled: 'Action annulée.',
    actionFallback: 'Action traitée.',
    audioError: "Désolé, je n'ai pas pu comprendre l'audio, réessaie ou tape ton message.",
    serverError: 'Erreur de connexion au serveur.',
  },
  en: {
    createTaskConfirm: (title: string) => `Create task "${title}"?`,
    createEventConfirm: (title: string, dateLabel: string) =>
      `Create event "${title}"${dateLabel ? ` on ${dateLabel}` : ''}?`.replace(/\s+/g, ' ').trim(),
    deleteTaskConfirm: (title: string) => `Delete task "${title}"?`,
    deleteEventConfirm: (title: string) => `Delete event "${title}"?`,
    modifyTaskConfirm: (target: string, nextTitle: string) => `Rename task "${target}" to "${nextTitle}"?`,
    modifyTaskClarify: (target: string) => `What would you like to rename '${target}' to?`,
    modifyEventConfirm: (target: string, nextTitle: string) => `Change event "${target}" to "${nextTitle}"?`,
    modifyEventClarify: (target: string) => `What would you like to rename the event '${target}' to?`,
    notFound: (query: string) => `No task or event found matching "${query}".`,
    ambiguous: (titles: string) => `Several items match, please specify which one:\n${titles}`,
    summaryClarify: 'What period would you like a summary for? (e.g. this week, today...)',
    summaryIntro: 'Summary',
    summaryNoTasks: 'no tasks found.',
    summaryNoEvents: 'no events found.',
    summaryNoItems: 'no tasks or events found.',
    actionConfirmed: 'Action confirmed and executed.',
    actionCancelled: 'Action canceled.',
    actionFallback: 'Action processed.',
    audioError: "Sorry, I couldn't understand the audio. Try again or type your message.",
    serverError: 'Server connection error.',
  },
} as const;

function getLang(language?: string): Lang {
  return language === 'en' ? 'en' : 'fr';
}

function formatLocalizedDate(dateTime: string | undefined, lang: Lang) {
  if (!dateTime) return '';
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  return date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
const AFFIRMATIVE_WORDS = ['oui', 'ok', "d'accord", 'daccord', 'yes', 'vas-y', 'confirme', 'valide'];
const NEGATIVE_WORDS = ['non', 'no', 'annule', 'annuler', 'stop', 'laisse tomber'];
export default function HomeScreen() {
  const [spaceGroteskLoaded] = useSpaceGrotesk({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [ibmPlexSansLoaded] = useIBMPlexSans({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      text: 'Bonjour ! Je suis votre assistant. Que puis-je faire pour vous ?',
      time: formatTime(new Date()),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [pendingAction, setPendingAction] = useState<ProposedAction | null>(null);
  const [pendingClarification, setPendingClarification] = useState<ClarificationState | null>(null);
  const [awaitingPeriodClarification, setAwaitingPeriodClarification] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const speakAssistantResponse = useCallback(
    (text: string, language: Lang = 'fr') => {
      const speechText = text.trim();
      if (!ttsEnabled || !speechText) {
        return;
      }

      try {
        Speech.stop();
        Speech.speak(speechText, { language: language === 'en' ? 'en-US' : 'fr-FR' });
      } catch (error) {
        console.error('Failed to speak assistant response', error);
      }
    },
    [ttsEnabled]
  );

  const addAssistantMessage = useCallback(
    (text: string, options?: { variant?: 'normal' | 'error'; speak?: boolean; language?: Lang }) => {
      const messageText = text.trim();
      if (!messageText) {
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          id: Math.random().toString(),
          role: 'assistant',
          text: messageText,
          time: formatTime(new Date()),
          variant: options?.variant ?? 'normal',
        },
      ]);

      if (options?.speak) {
        speakAssistantResponse(messageText, options.language);
      }
    },
    [speakAssistantResponse]
  );

  const toggleTts = () => {
    setTtsEnabled((previous) => {
      const nextEnabled = !previous;
      if (!nextEnabled) {
        Speech.stop();
      }
      return nextEnabled;
    });
  };
const startRecording = async () => {
  try {
    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => {});
      setRecording(null);
    }
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      console.error('Microphone permission not granted');
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(newRecording);
    setIsRecording(true);
  } catch (error) {
    console.error('Failed to start recording', error);
  }
};

const stopRecording = async () => {
  if (!recording) return;
  setIsRecording(false);
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (uri) {
      await transcribeAndSend(uri);
    }
  } catch (error) {
    console.error('Failed to stop recording', error);
  }
};
const handleMicPress = () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
};
const transcribeAndSend = async (uri: string) => {
  try {
    const formData = new FormData();

if (Platform.OS === "web") {
  const blob = await fetch(uri).then(r => r.blob());

  formData.append(
    "audio",
    blob,
    "audio.webm" // or .wav depending on what Expo records
  );
} else {
  formData.append("audio", {
    uri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as any);
}

    const response = await axios.post(`${API_BASE_URL}/assistant/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const transcribedText = response.data.text?.trim();
    if (transcribedText) {
      setInputText(transcribedText);
      await sendMessage('voice', transcribedText);
    } else {
      addAssistantMessage(
        "Désolé, je n'ai pas pu comprendre l'audio, réessaie ou tape ton message.",
        { variant: 'error' }
      );
    }
  } catch (error) {
    console.error('Transcription failed', error);
    addAssistantMessage(
      "Désolé, je n'ai pas pu comprendre l'audio, réessaie ou tape ton message.",
      { variant: 'error' }
    );
  }
};
 const sendMessage = useCallback(async (inputMode: 'voice' | 'text', overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text) return;

    const normalizedText = text.toLowerCase();

    if (pendingClarification) {
      const userMessage: ChatMessage = {
        id: Math.random().toString(),
        role: 'user',
        text,
        time: formatTime(new Date()),
      };
      setMessages((previous) => [...previous, userMessage]);
      setInputText('');

      const clarifiedDetails = {
        ...pendingClarification.pendingAction.details,
        [pendingClarification.missingField]: text,
      };
      const clarifiedAction: ProposedAction = {
        ...pendingClarification.pendingAction,
        details: clarifiedDetails,
      };

      setPendingClarification(null);
      setPendingAction(clarifiedAction);

      if (clarifiedAction.intent === 'modify_task') {
        const assistantText = UI_TEXT[pendingClarification.lang].modifyTaskConfirm(
          pendingClarification.targetTitle,
          text
        );
        addAssistantMessage(assistantText, { speak: true, language: pendingClarification.lang });
      } else if (clarifiedAction.intent === 'modify_event') {
        const assistantText = UI_TEXT[pendingClarification.lang].modifyEventConfirm(
          pendingClarification.targetTitle,
          text
        );
        addAssistantMessage(assistantText, { speak: true, language: pendingClarification.lang });
      }
      return;
    }

    if (pendingAction) {
      if (AFFIRMATIVE_WORDS.includes(normalizedText)) {
        const userMessage: ChatMessage = {
          id: Math.random().toString(),
          role: 'user',
          text,
          time: formatTime(new Date()),
        };
        setMessages((previous) => [...previous, userMessage]);
        setInputText('');
        await handleValidate();
        return;
      }
      if (NEGATIVE_WORDS.includes(normalizedText)) {
        const userMessage: ChatMessage = {
          id: Math.random().toString(),
          role: 'user',
          text,
          time: formatTime(new Date()),
        };
        setMessages((previous) => [...previous, userMessage]);
        setInputText('');
        handleIgnore();
        return;
      }
    }

    setPendingAction(null);

    let effectiveText = text;
    if (awaitingPeriodClarification) {
      effectiveText = awaitingPeriodClarification + ' ' + text;
      setAwaitingPeriodClarification(null);
    }

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      text,
      time: formatTime(new Date()),
    };
    setMessages((previous) => [...previous, userMessage]);
    setInputText('');

    try {
      const response = await axios.post(`${API_BASE_URL}/assistant/message`, {
        inputText: effectiveText,
        inputMode,
      });

      const { result, responseMessage, proposedAction } = response.data;
      const detectedLanguage = getLang(result?.language);

      let assistantText = responseMessage;

      if (proposedAction) {
        if (proposedAction.intent === 'create_task') {
          setPendingAction({ ...proposedAction, language: detectedLanguage });
          assistantText = UI_TEXT[detectedLanguage].createTaskConfirm(proposedAction.details.taskTitle);
        } else if (proposedAction.intent === 'create_event') {
          setPendingAction({ ...proposedAction, language: detectedLanguage });
          assistantText = UI_TEXT[detectedLanguage].createEventConfirm(
            proposedAction.details.eventTitle,
            formatLocalizedDate(proposedAction.details.eventDateTime, detectedLanguage)
          );
        } else if (proposedAction.intent === 'delete_task') {
          const targetTitle = response.data.modifyDeleteInfo?.target?.title;
          if (!targetTitle) {
            assistantText = UI_TEXT[detectedLanguage].notFound(response.data.modifyDeleteInfo?.query || '');
          } else {
            setPendingAction({ ...proposedAction, language: detectedLanguage });
            assistantText = UI_TEXT[detectedLanguage].deleteTaskConfirm(targetTitle);
          }
        } else if (proposedAction.intent === 'delete_event') {
          const targetTitle = response.data.modifyDeleteInfo?.target?.title;
          if (!targetTitle) {
            assistantText = UI_TEXT[detectedLanguage].notFound(response.data.modifyDeleteInfo?.query || '');
          } else {
            setPendingAction({ ...proposedAction, language: detectedLanguage });
            assistantText = UI_TEXT[detectedLanguage].deleteEventConfirm(targetTitle);
          }
        } else if (proposedAction.intent === 'modify_task') {
          const targetTitle = response.data.modifyDeleteInfo?.target?.title;
          const newTitle = proposedAction.details?.newTaskTitle?.trim();
          if (!targetTitle) {
            assistantText = UI_TEXT[detectedLanguage].notFound(response.data.modifyDeleteInfo?.query || '');
          } else if (!newTitle) {
            setPendingAction(null);
            setPendingClarification({
              pendingAction: proposedAction,
              targetTitle,
              lang: detectedLanguage,
              missingField: 'newTaskTitle',
            });
            assistantText = UI_TEXT[detectedLanguage].modifyTaskClarify(targetTitle);
          } else {
            setPendingAction({ ...proposedAction, language: detectedLanguage });
            assistantText = UI_TEXT[detectedLanguage].modifyTaskConfirm(targetTitle, newTitle);
          }
        } else if (proposedAction.intent === 'modify_event') {
          const targetTitle = response.data.modifyDeleteInfo?.target?.title;
          const newTitle = proposedAction.details?.newEventTitle?.trim();
          if (!targetTitle) {
            assistantText = UI_TEXT[detectedLanguage].notFound(response.data.modifyDeleteInfo?.query || '');
          } else if (!newTitle) {
            setPendingAction(null);
            setPendingClarification({
              pendingAction: proposedAction,
              targetTitle,
              lang: detectedLanguage,
              missingField: 'newEventTitle',
            });
            assistantText = UI_TEXT[detectedLanguage].modifyEventClarify(targetTitle);
          } else {
            setPendingAction({ ...proposedAction, language: detectedLanguage });
            assistantText = UI_TEXT[detectedLanguage].modifyEventConfirm(targetTitle, newTitle);
          }
        }
      } else if (response.data.modifyDeleteInfo?.status === 'not_found') {
        assistantText = UI_TEXT[detectedLanguage].notFound(response.data.modifyDeleteInfo.query || '');
      } else if (response.data.modifyDeleteInfo?.status === 'ambiguous') {
        const titles = response.data.modifyDeleteInfo.matches.map((m: any) => '- ' + m.title).join('\n');
        assistantText = UI_TEXT[detectedLanguage].ambiguous(titles);
      } else if (result?.intent === 'summarize_period') {
  if (result.summaryDates && result.summaryDates.length > 0) {
    const byDate = response.data.summaryDataByDate || {};
    const parts = result.summaryDates.map((date: string) => {
      const dayData = byDate[date] || { tasks: [], events: [] };
      const taskCount = dayData.tasks.length;
      const eventCount = dayData.events.length;
      if (taskCount === 0 && eventCount === 0) {
        return date + ' : rien de prevu.';
      }
      const taskList = dayData.tasks.map((t: any) => '  - ' + t.title).join('\n');
      const eventList = dayData.events.map((e: any) => '  - ' + e.title + ' (' + e.dateTime + ')').join('\n');
      return (
        date + ' :\n' +
        (taskCount > 0 ? '  Taches:\n' + taskList + '\n' : '') +
        (eventCount > 0 ? '  Evenements:\n' + eventList : '')
      );
    });
    assistantText = `${UI_TEXT[detectedLanguage].summaryIntro} :\n${parts.join('\n\n')}`;
  } else if (result.summaryPeriodStart && result.summaryPeriodEnd) {
    const periodLabel =
      result.summaryPeriodStart === result.summaryPeriodEnd
        ? 'pour le ' + result.summaryPeriodStart
        : 'pour la periode du ' + result.summaryPeriodStart + ' au ' + result.summaryPeriodEnd;

    const taskCount = response.data.summaryData?.tasks?.length || 0;
    const eventCount = response.data.summaryData?.events?.length || 0;

    if (taskCount === 0 && eventCount === 0) {
      const scopeLabel =
        response.data.summaryScope === 'tasks'
          ? UI_TEXT[detectedLanguage].summaryNoTasks
          : response.data.summaryScope === 'events'
          ? UI_TEXT[detectedLanguage].summaryNoEvents
          : UI_TEXT[detectedLanguage].summaryNoItems;
      assistantText = `${UI_TEXT[detectedLanguage].summaryIntro} ${periodLabel} : ${scopeLabel}`;
    } else {
      const taskList = (response.data.summaryData?.tasks || [])
        .map((t: any) => '- ' + t.title)
        .join('\n');
      const eventList = (response.data.summaryData?.events || [])
        .map((e: any) => '- ' + e.title + ' (' + e.dateTime + ')')
        .join('\n');
      assistantText =
        `${UI_TEXT[detectedLanguage].summaryIntro} ${periodLabel} :\n` +
        (taskCount > 0 ? `${detectedLanguage === 'fr' ? 'Tâches' : 'Tasks'}:\n${taskList}\n` : '') +
        (eventCount > 0 ? `${detectedLanguage === 'fr' ? 'Événements' : 'Events'}:\n${eventList}` : '');
    }
  } else {
    assistantText = UI_TEXT[detectedLanguage].summaryClarify;
    setAwaitingPeriodClarification(text);
  }
}

      addAssistantMessage(assistantText || UI_TEXT[detectedLanguage].actionFallback, { speak: true, language: detectedLanguage });
    } catch (error) {
      console.error(error);
      addAssistantMessage(UI_TEXT.fr.serverError, { variant: 'error', speak: true, language: 'fr' });
    }
  }, [inputText, awaitingPeriodClarification, addAssistantMessage]);

  const handleValidate = async () => {
  if (!pendingAction) return;
  try {
    await axios.post(`${API_BASE_URL}/assistant/confirm-action`, {
      interactionId: pendingAction.interactionId,
      intent: pendingAction.intent,
      details: pendingAction.details,
      targetId: pendingAction.targetId,
    });
      addAssistantMessage(
        pendingAction.language === 'en' ? UI_TEXT.en.actionConfirmed : UI_TEXT.fr.actionConfirmed,
        { speak: true, language: pendingAction.language || 'fr' }
      );
      setPendingAction(null);
    } catch (error) {
      console.error(error);
      addAssistantMessage(
        pendingAction.language === 'en'
          ? "Sorry, I couldn't complete the requested action."
          : "Désolé, je n'ai pas pu exécuter l'action demandée.",
        {
        variant: 'error',
          speak: true,
          language: pendingAction.language || 'fr',
        }
      );
    }
  };

  const handleIgnore = () => {
    setMessages((previous) => [
      ...previous,
      {
        id: Math.random().toString(),
        role: 'assistant',
        text: pendingAction?.language === 'en' ? UI_TEXT.en.actionCancelled : UI_TEXT.fr.actionCancelled,
        time: formatTime(new Date()),
      },
    ]);
    setPendingAction(null);
  };

  if (!spaceGroteskLoaded || !ibmPlexSansLoaded) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingWrap]}>
        <ActivityIndicator color={colors.tealDeep} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.appbar}>
        <View>
          <Text style={styles.appbarTitle}>Assistant</Text>
          <Text style={styles.appbarSub}>A l'ecoute</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTts}>
            <Feather name={ttsEnabled ? 'volume-2' : 'volume-x'} size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.iconBtn}>
            <Feather name="more-horizontal" size={18} color="#fff" />
          </View>
        </View>
      </View>

      <ScrollView
  ref={scrollViewRef}
  style={styles.content}
  contentContainerStyle={styles.contentInner}
  onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
>
        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={[styles.card, styles.userCard]}>
              <Text style={styles.subLine}>Vous, {m.time}</Text>
              <Text style={styles.titleLine}>{m.text}</Text>
            </View>
          ) : (
            <View
              key={m.id}
              style={[
                styles.card,
                styles.assistantCard,
                m.variant === 'error' && styles.errorAssistantCard,
              ]}>
              <Text style={[styles.subLine, { color: colors.tealDeep }]}>Assistant</Text>
              <Text
                style={[
                  styles.titleLine,
                  styles.assistantTitleLine,
                  m.variant === 'error' && styles.errorAssistantTitleLine,
                ]}>
                {m.text}
              </Text>
            </View>
          )
        )}

        {pendingAction && (
  <>
    <TouchableOpacity style={styles.checkRow} onPress={handleValidate}>
      <View style={styles.checkbox} />
      <Text style={styles.checkRowText}>
          {pendingAction.language === 'en' ? 'Yes, ' : 'Oui, '}
          {pendingAction.intent === 'create_task'
            ? pendingAction.language === 'en'
              ? 'create task'
              : 'créer la tâche'
            : pendingAction.intent === 'create_event'
            ? pendingAction.language === 'en'
              ? 'create event'
              : "créer l'événement"
            : pendingAction.intent === 'delete_task'
            ? pendingAction.language === 'en'
              ? 'delete task'
              : 'supprimer la tâche'
            : pendingAction.intent === 'delete_event'
            ? pendingAction.language === 'en'
              ? 'delete event'
              : "supprimer l'événement"
            : pendingAction.intent === 'modify_task'
            ? pendingAction.language === 'en'
              ? 'rename task'
              : 'renommer la tâche'
            : pendingAction.language === 'en'
            ? 'change event'
            : "modifier l'événement"}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={handleIgnore}>
      <View style={styles.checkbox} />
        <Text style={styles.checkRowText}>{pendingAction.language === 'en' ? 'No thanks' : 'Non merci'}</Text>
    </TouchableOpacity>
  </>
)}
      </ScrollView>

      <View style={styles.inputBarWrap}>
        <View style={styles.voicebar}>
         <TouchableOpacity
  style={[styles.playbtn, isRecording && styles.playbtnActive]}
  onPress={handleMicPress}
>
  <Feather name="mic" size={14} color="#fff" />
</TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Ecrivez ou dictez votre message..."
            placeholderTextColor={colors.inkSoft}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage('text')}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={() => sendMessage('text')}>
            <Feather name="arrow-up-circle" size={26} color={colors.tealDeep} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="home" size={20} color={colors.inkSoft} />
          <Text style={styles.navLabel}>Accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="check" size={20} color={colors.inkSoft} />
          <Text style={styles.navLabel}>Taches</Text>
        </TouchableOpacity>
        <View style={styles.navMicWrap}>
  <TouchableOpacity
    style={[styles.navMicBtn, isRecording && styles.playbtnActive]}
    onPress={handleMicPress}
  >
    <Feather name="mic" size={20} color="#fff" />
  </TouchableOpacity>
</View>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="calendar" size={20} color={colors.inkSoft} />
          <Text style={styles.navLabel}>Agenda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="folder" size={20} color={colors.inkSoft} />
          <Text style={styles.navLabel}>Fichiers</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appbar: {
    backgroundColor: colors.tealDeep,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appbarTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  appbarSub: {
    color: '#BFDAD3',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderRadius: 16,
    padding: 14,
  },
  userCard: {
    backgroundColor: colors.surfaceAlt,
  },
  assistantCard: {
    backgroundColor: colors.tealPale,
  },
  errorAssistantCard: {
    backgroundColor: '#FFF4EF',
    borderWidth: 1,
    borderColor: '#F1B59A',
  },
  subLine: {
    fontSize: 12.5,
    color: colors.inkSoft,
    marginBottom: 4,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  titleLine: {
    fontSize: 14.5,
    color: colors.ink,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
  assistantTitleLine: {
    fontFamily: 'IBMPlexSans_500Medium',
  },
  errorAssistantTitleLine: {
    color: '#B5502A',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
  },
  checkRowText: {
    fontSize: 13.5,
    color: colors.ink,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
  inputBarWrap: {
    padding: 16,
    backgroundColor: colors.bg,
  },
  voicebar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tealPale,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playbtn: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: colors.coral,
  alignItems: 'center',
  justifyContent: 'center',
},
playbtnActive: {
  backgroundColor: '#B5502A',
},
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 10.5,
    color: colors.inkSoft,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  navMicWrap: {
    marginTop: -28,
  },
  navMicBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});