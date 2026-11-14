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
npm run dev
```

### Cliente móvil

```bash
cd app-cliente
npm install
npm run android   # o: npm run ios
```
