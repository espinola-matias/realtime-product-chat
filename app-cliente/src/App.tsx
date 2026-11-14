import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, fonts } from './chat/components/theme';
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

/** Mismas tipografías que app-comercio (las claves deben coincidir con `fonts` del tema). */
const FONT_MAP = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  Sora_600SemiBold,
  Sora_700Bold,
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  if (fontError) {
    // Si las fuentes fallan, la app sigue con la del sistema (no se bloquea el chat).
    console.warn('[app] No se pudieron cargar las tipografías:', fontError.message);
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPressed} />
      </View>
    );
  }

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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  errorBox: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  errorTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.dangerText, marginBottom: 8 },
  errorText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
});
