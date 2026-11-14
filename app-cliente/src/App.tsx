import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './chat/components/theme';
import { getApiUrl, getChatId } from './chat/config/env';
import { getDb } from './chat/config/firebase';
import { ChatScreen } from './chat/screens/ChatScreen';

type Setup = { ok: true; chatId: string; apiUrl: string } | { ok: false; message: string };

/** Valida toda la configuración al arrancar para mostrar un error claro en vez de fallar después. */
function loadSetup(): Setup {
  try {
    getDb();
    return { ok: true, chatId: getChatId(), apiUrl: getApiUrl() };
  } catch (error: unknown) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

const setup = loadSetup();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {setup.ok ? (
        <ChatScreen chatId={setup.chatId} apiUrl={setup.apiUrl} />
      ) : (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorTitle}>No se pudo iniciar el chat</Text>
          <Text style={styles.errorText}>{setup.message}</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorBox: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  errorTitle: { fontSize: 18, fontWeight: '700', color: colors.dangerText, marginBottom: 8 },
  errorText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
