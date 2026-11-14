import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new ConfigError(
      `Falta la variable de entorno ${name}. Copie .env.example a .env y complétela.`,
    );
  }
  return value;
}

/** chatId compartido con app-cliente y la API. */
export function getChatId(): string {
  return required('VITE_CHAT_ID');
}

let database: Database | null = null;

/** Inicializa Firebase una sola vez y devuelve la Realtime Database. */
export function getDb(): Database {
  if (database) return database;

  const options: FirebaseOptions = {
    apiKey: required('VITE_FIREBASE_API_KEY'),
    authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL: required('VITE_FIREBASE_DATABASE_URL'),
    projectId: required('VITE_FIREBASE_PROJECT_ID'),
    appId: required('VITE_FIREBASE_APP_ID'),
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  database = getDatabase(app);
  return database;
}
