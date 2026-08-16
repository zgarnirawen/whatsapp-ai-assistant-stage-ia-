import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InteractionHistory from '@/components/InteractionHistory';

const API_BASE_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.224.58.5:3000';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <InteractionHistory apiBaseUrl={API_BASE_URL} limit={30} language="fr" />
    </SafeAreaView>
  );
}
