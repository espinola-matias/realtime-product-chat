export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Expo solo reemplaza `process.env.EXPO_PUBLIC_*` cuando se accede de forma
 * estática (con punto). Por eso cada variable se lee aquí explícitamente y no
 * con `process.env[nombre]`.
 */
const env = {
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_DATABASE_URL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_CHAT_ID: process.env.EXPO_PUBLIC_CHAT_ID,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
} as const;

export type EnvName = keyof typeof env;

export function requiredEnv(name: EnvName): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigError(
      `Falta la variable de entorno ${name}. Copie .env.example a .env, complétela y reinicie Expo con "npx expo start -c".`,
    );
  }
  return value;
}

/** chatId compartido con app-comercio y la API. */
export function getChatId(): string {
  return requiredEnv('EXPO_PUBLIC_CHAT_ID');
}

/** URL base de la API NestJS, sin barra final. */
export function getApiUrl(): string {
  const raw = requiredEnv('EXPO_PUBLIC_API_URL');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`EXPO_PUBLIC_API_URL no es una URL válida: "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError('EXPO_PUBLIC_API_URL debe empezar por http:// o https://');
  }
  return raw.replace(/\/+$/, '');
}
