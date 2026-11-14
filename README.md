# Chat de producto con Firebase Realtime

Prueba técnica: chat en tiempo real entre un **cliente móvil** (React Native / Expo) y un **comercio web** (React / Vite) usando Firebase Realtime Database. El comercio puede enviar ofertas de producto en cualquier momento; el cliente las aprueba o rechaza, y al aprobar guarda el pedido en una **API NestJS**.

> 🚧 README en construcción: se completa por etapas.

## Estructura

```
├── api/            NestJS — POST /orders, GET /orders/:id
├── app-cliente/    React Native (Expo) — cliente móvil
├── app-comercio/   React + Vite — comercio web
└── firebase/
    └── database.rules.json   reglas de Realtime Database usadas
```

Cada pieza sigue el patrón `src/[entidad]/[componentes]`.

## Requisitos

- Node.js 20 o superior (probado con Node 22) y npm 10.
- Cuenta de Firebase.
- Para el cliente móvil: Android Studio (emulador) o Xcode (simulador iOS), o la app Expo Go en un teléfono.

## Firebase

1. En la [consola de Firebase](https://console.firebase.google.com) cree un proyecto.
2. **Compilación → Realtime Database → Crear base de datos** (elija la región y empiece en modo bloqueado).
3. En la pestaña **Reglas**, pegue el contenido de [`firebase/database.rules.json`](firebase/database.rules.json) y publique.
4. **Configuración del proyecto → Tus apps → Web (`</>`)**: registre una app web y copie `apiKey`, `authDomain`, `databaseURL`, `projectId` y `appId`.
5. Esos valores van en los `.env` de `app-comercio` y `app-cliente` (ver abajo). No se suben al repositorio.

## Variables de entorno

Cada pieza tiene un `.env.example`. Cópielo a `.env` y complete los valores:

| Pieza          | Archivo                    | chatId                 |
| -------------- | -------------------------- | ---------------------- |
| `api`          | `api/.env`                 | `CHAT_ID`              |
| `app-comercio` | `app-comercio/.env`        | `VITE_CHAT_ID`         |
| `app-cliente`  | `app-cliente/.env`         | `EXPO_PUBLIC_CHAT_ID`  |

**chatId usado en la demostración:** `chat-demo-001`

## Instalación y ejecución

_Se completa en las siguientes etapas._

### API

```bash
cd api
npm install
npm run start:dev
```

### Comercio web

```bash
cd app-comercio
npm install
npm run dev
```

### Cliente móvil

```bash
cd app-cliente
npm install
npm run android   # o: npm run ios
```
