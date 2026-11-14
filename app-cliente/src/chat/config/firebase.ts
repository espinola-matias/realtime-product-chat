import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { requiredEnv } from './env';

let database: Database | null = null;

/** Inicializa Firebase una sola vez y devuelve la Realtime Database. */
export function getDb(): Database {
  if (database) return database;

  const options: FirebaseOptions = {
    apiKey: requiredEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: requiredEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    databaseURL: requiredEnv('EXPO_PUBLIC_FIREBASE_DATABASE_URL'),
    projectId: requiredEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    appId: requiredEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
  };

  const app = getApps().length > 0 ? getApp() : initializeApp(options);
  database = getDatabase(app);
  return database;
}
