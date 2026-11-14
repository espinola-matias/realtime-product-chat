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
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run start:dev         # http://localhost:3000
```

| Script               | Qué hace                                      |
| -------------------- | --------------------------------------------- |
| `npm run start:dev`  | Servidor con recarga automática               |
| `npm test`           | Pruebas unitarias de `orders.service.ts`      |
| `npm run test:e2e`   | Pruebas HTTP de `/orders` (archivo temporal)  |
| `npm run typecheck`  | `tsc --noEmit`                                |

**Endpoints**

| Método | Ruta          | Respuesta                                                                 |
| ------ | ------------- | ------------------------------------------------------------------------- |
| POST   | `/orders`     | 201 pedido creado · 400 datos inválidos · 409 la oferta ya tiene pedido    |
| GET    | `/orders/:id` | 200 pedido · 404 no existe                                                 |

Validaciones de `POST /orders`: `chatId`, `messageId` y `product.id` obligatorios; `product.price` número mayor que cero; `product.currency` código ISO de 3 letras; `product.imageUrl` URL opcional; campos extra rechazados; si `CHAT_ID` está definido, el `chatId` debe coincidir. Los pedidos se guardan en `orders.json` (`ORDERS_FILE`).

**Probar a mano (PowerShell)**

```powershell
$body = @{
  chatId    = "chat-demo-001"
  messageId = "-Omsg1"
  product   = @{ id = "p-101"; name = "Bandeja paisa"; price = 32000; currency = "COP"; imageUrl = "https://ejemplo.com/bandeja.jpg" }
} | ConvertTo-Json
$order = Invoke-RestMethod -Method Post -Uri http://localhost:3000/orders -ContentType "application/json" -Body $body
$order
Invoke-RestMethod http://localhost:3000/orders/$($order.id)
```

**Probar a mano (Git Bash / macOS / Linux)**

```bash
curl -i -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"chatId":"chat-demo-001","messageId":"-Omsg1","product":{"id":"p-101","name":"Bandeja paisa","price":32000,"currency":"COP","imageUrl":"https://ejemplo.com/bandeja.jpg"}}'

curl -i http://localhost:3000/orders/<id-devuelto>
```

### Comercio web

```bash
cd app-comercio
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env  → completar con los datos de Firebase
npm run dev               # http://localhost:5173
```

| Script               | Qué hace                                         |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo de Vite                   |
| `npm test`           | Pruebas de `chat.service.ts` (Vitest)            |
| `npm run typecheck`  | `tsc --noEmit`                                   |
| `npm run build`      | Typecheck + build de producción                  |

Si falta alguna variable `VITE_*`, la app muestra en pantalla cuál es en lugar de quedar en blanco.

### Cliente móvil

Expo SDK 58 (React Native 0.88). Se ejecuta en **Expo Go**, sin compilar código nativo.

```bash
cd app-cliente
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env  → mismos datos de Firebase que app-comercio
```

Elija **una** forma de ejecutarlo:

| Opción | Comando | ¿Cuenta de Expo? | Requisitos | `EXPO_PUBLIC_API_URL` |
| ------ | ------- | ---------------- | ---------- | --------------------- |
| **Navegador** (la más rápida para evaluar) | `npm run web` → http://localhost:8081 | No | Ninguno | `http://localhost:3000` |
| **Emulador Android** | `npm run android` | No | Android Studio con un emulador encendido | `http://10.0.2.2:3000` |
| **Teléfono Android** | `npx expo start` → escanear QR desde Expo Go | No | Expo Go, misma Wi-Fi que la PC | `http://<IP-LAN-de-la-PC>:3000` |
| **Simulador iOS** | `npm run ios` | No | macOS con Xcode | `http://localhost:3000` |
| **iPhone físico** | `npx expo start` → escanear QR con la cámara | **Sí** (ver abajo) | Expo Go, misma Wi-Fi que la PC | `http://<IP-LAN-de-la-PC>:3000` |

La opción **Navegador** ejecuta el mismo código React Native con `react-native-web`: sirve para probar el flujo completo sin dispositivo ni cuentas. Con `npm run dev` del comercio abierto en otra pestaña se ven ambos lados a la vez.

**iPhone físico:** por política de Apple, Expo Go en iOS solo abre proyectos de un usuario con sesión iniciada. Cree una cuenta gratuita en expo.dev e inicie sesión con **la misma cuenta** en la app Expo Go y en la PC, de una de estas dos formas:

- Interactiva: `npx expo login`.
- Sin prompt, con token: en expo.dev → *Account settings → Access tokens* cree un token y defínalo antes de arrancar (no lo guarde en el repo):

  ```powershell
  $env:EXPO_TOKEN = "<su-token>"; npx expo start
  ```

Si el teléfono no conecta por la red local, use `npx expo start --tunnel`. La IP LAN de la PC se obtiene con `ipconfig` → "Dirección IPv4" del adaptador Wi-Fi.

**Variables:** Expo lee `.env` al arrancar. Si cambia un valor, reinicie con `npx expo start -c` (limpia la caché).

| Script               | Qué hace                                         |
| -------------------- | ------------------------------------------------ |
| `npm run web`        | `expo start --web` (cliente en el navegador)     |
| `npm run android`    | `expo start --android`                           |
| `npm run ios`        | `expo start --ios`                               |
| `npm test`           | Pruebas de `chat.service.ts` (jest-expo)         |
| `npm run typecheck`  | `tsc --noEmit`                                   |
