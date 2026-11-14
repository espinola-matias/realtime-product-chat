import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

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
} as const;

type EnvName = keyof typeof env;

function required(name: EnvName): string {
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
  return required('EXPO_PUBLIC_CHAT_ID');
}

let database: Database | null = null;

/** Inicializa Firebase una sola vez y devuelve la Realtime Database. */
export function getDb(): Database {
  if (database) return database;

  const options: FirebaseOptions = {
    apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: required('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    databaseURL: required('EXPO_PUBLIC_FIREBASE_DATABASE_URL'),
    projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    appId: required('EXPO_PUBLIC_FIREBASE_APP_ID'),
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  database = getDatabase(app);
  return database;
}
