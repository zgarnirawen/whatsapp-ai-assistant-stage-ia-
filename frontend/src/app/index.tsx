import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
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

const API_BASE_URL = 'http://10.224.58.5:3000';

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
}

interface ProposedAction {
  interactionId: string;
  intent: string;
  details: any;
  targetId?: string | null;
  requiresValidation: boolean;
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
  const [awaitingPeriodClarification, setAwaitingPeriodClarification] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
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
    formData.append('audio', {
      uri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as any);

    const response = await axios.post(`${API_BASE_URL}/assistant/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const transcribedText = response.data.text?.trim();
    if (transcribedText) {
      setInputText(transcribedText);
      // Send it through the normal flow, reusing existing sendMessage logic
      setTimeout(() => sendMessage(), 100);
    }
  } catch (error) {
    console.error('Transcription failed', error);
  }
};
 const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;

    const normalizedText = text.toLowerCase();

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
        inputMode: 'text',
      });

      const { result, responseMessage, proposedAction } = response.data;

      let assistantText = responseMessage;

      if (proposedAction) {
  setPendingAction(proposedAction);
  if (proposedAction.intent === 'create_task') {
    assistantText = 'Creer la tache : "' + proposedAction.details.taskTitle + '" ?';
  } else if (proposedAction.intent === 'create_event') {
    assistantText =
      "Creer l'evenement : \"" +
      proposedAction.details.eventTitle +
      '" le ' +
      proposedAction.details.eventDateTime +
      ' ?';
  } else if (proposedAction.intent === 'delete_task') {
    assistantText = 'Supprimer la tache : "' + response.data.modifyDeleteInfo.target.title + '" ?';
  } else if (proposedAction.intent === 'delete_event') {
    assistantText = "Supprimer l'evenement : \"" + response.data.modifyDeleteInfo.target.title + '" ?';
  } else if (proposedAction.intent === 'modify_task') {
    assistantText =
      'Renommer la tache "' + response.data.modifyDeleteInfo.target.title + '" en "' + proposedAction.details.newTaskTitle + '" ?';
  } else if (proposedAction.intent === 'modify_event') {
    assistantText = "Modifier l'evenement \"" + response.data.modifyDeleteInfo.target.title + '" ?';
  }
} else if (response.data.modifyDeleteInfo?.status === 'not_found') {
  assistantText = 'Aucune tache ou evenement trouve correspondant a "' + response.data.modifyDeleteInfo.query + '".';
} else if (response.data.modifyDeleteInfo?.status === 'ambiguous') {
  const titles = response.data.modifyDeleteInfo.matches.map((m: any) => '- ' + m.title).join('\n');
  assistantText = 'Plusieurs elements correspondent, precisez lequel :\n' + titles;
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
    assistantText = 'Resume :\n' + parts.join('\n\n');
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
          ? 'aucune tache trouvee.'
          : response.data.summaryScope === 'events'
          ? 'aucun evenement trouve.'
          : 'aucune tache ni evenement trouve.';
      assistantText = 'Resume ' + periodLabel + ' : ' + scopeLabel;
    } else {
      const taskList = (response.data.summaryData?.tasks || [])
        .map((t: any) => '- ' + t.title)
        .join('\n');
      const eventList = (response.data.summaryData?.events || [])
        .map((e: any) => '- ' + e.title + ' (' + e.dateTime + ')')
        .join('\n');
      assistantText =
        'Resume ' + periodLabel + ' :\n' +
        (taskCount > 0 ? 'Taches:\n' + taskList + '\n' : '') +
        (eventCount > 0 ? 'Evenements:\n' + eventList : '');
    }
  } else {
    assistantText = 'Pour quelle periode voulez-vous un resume ? (ex: cette semaine, aujourd\'hui...)';
    setAwaitingPeriodClarification(text);
  }
}

      const assistantMessage: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        text: assistantText || 'Action traitee.',
        time: formatTime(new Date()),
      };
      setMessages((previous) => [...previous, assistantMessage]);
    } catch (error) {
      console.error(error);
      setMessages((previous) => [
        ...previous,
        {
          id: Math.random().toString(),
          role: 'assistant',
          text: 'Erreur de connexion au serveur.',
          time: formatTime(new Date()),
        },
      ]);
    }
  }, [inputText, awaitingPeriodClarification]);

  const handleValidate = async () => {
  if (!pendingAction) return;
  try {
    await axios.post(`${API_BASE_URL}/assistant/confirm-action`, {
      interactionId: pendingAction.interactionId,
      intent: pendingAction.intent,
      details: pendingAction.details,
      targetId: pendingAction.targetId,
    });
      setMessages((previous) => [
        ...previous,
        {
          id: Math.random().toString(),
          role: 'assistant',
          text: 'Action confirmee et executee.',
          time: formatTime(new Date()),
        },
      ]);
      setPendingAction(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleIgnore = () => {
    setMessages((previous) => [
      ...previous,
      {
        id: Math.random().toString(),
        role: 'assistant',
        text: 'Action annulee.',
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
        <View style={styles.iconBtn}>
          <Feather name="more-horizontal" size={18} color="#fff" />
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
            <View key={m.id} style={[styles.card, styles.assistantCard]}>
              <Text style={[styles.subLine, { color: colors.tealDeep }]}>Assistant</Text>
              <Text style={[styles.titleLine, styles.assistantTitleLine]}>{m.text}</Text>
            </View>
          )
        )}

        {pendingAction && (
  <>
    <TouchableOpacity style={styles.checkRow} onPress={handleValidate}>
      <View style={styles.checkbox} />
      <Text style={styles.checkRowText}>
        Oui,{' '}
        {pendingAction.intent === 'create_task'
          ? 'creer la tache'
          : pendingAction.intent === 'create_event'
          ? "creer l'evenement"
          : pendingAction.intent === 'delete_task'
          ? 'supprimer la tache'
          : pendingAction.intent === 'delete_event'
          ? "supprimer l'evenement"
          : pendingAction.intent === 'modify_task'
          ? 'renommer la tache'
          : "modifier l'evenement"}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.checkRow} onPress={handleIgnore}>
      <View style={styles.checkbox} />
      <Text style={styles.checkRowText}>Non merci</Text>
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
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={sendMessage}>
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