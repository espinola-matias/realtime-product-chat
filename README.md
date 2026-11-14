# Chat de producto con Firebase Realtime

Prueba técnica: chat en tiempo real entre un **cliente móvil** (React Native / Expo) y un **comercio web** (React / Vite) usando Firebase Realtime Database. El comercio puede enviar ofertas de producto en cualquier momento; el cliente las aprueba o rechaza, y al aprobar guarda el pedido en una **API NestJS**.

> 🚧 README en construcción: se completa por etapas.

## Estructura

```
├── api/            NestJS — POST /orders, GET /orders/:id
├── app-cliente/    React Native (Expo) — cliente móvil
├── app-comercio/   React + Vite — comercio web
├── firebase/
│   └── database.rules.json   reglas de Realtime Database usadas
└── firebase.json             apunta a las reglas (para desplegarlas con Firebase CLI, opcional)
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

> Alternativa al paso 3 (opcional): `npx firebase-tools login` y `npx firebase-tools deploy --only database --project <id-del-proyecto>` desde la raíz del repo.

### Reglas de Realtime Database

[`firebase/database.rules.json`](firebase/database.rules.json) protege la estructura y el ciclo de vida de los mensajes en `/chats/{chatId}/messages/{messageId}`:

| Regla | Qué impide |
| ----- | ---------- |
| Solo se puede leer/escribir bajo `chats/{chatId}/messages`; `chatId` con letras, números, `-` o `_` (máx. 64) | Escribir en cualquier otra ruta de la base |
| Campos obligatorios `sender`, `type`, `createdAt`; `sender` ∈ {`cliente`, `comercio`}; `type` ∈ {`text`, `product_offer`, `order_accepted`}; campos desconocidos rechazados | Mensajes mal formados o con datos extra (p. ej. guardar `id` dentro del nodo) |
| `sender`, `type` y `createdAt` no cambian después de creados; `createdAt` no puede estar en el futuro (> 5 min) | Reescribir la autoría o la fecha de un mensaje |
| `text`: 1–1000 caracteres | Mensajes vacíos o gigantes |
| Los mensajes `text` y `order_accepted` no se pueden editar ni borrar | Alterar el historial |
| `product_offer` solo con `sender: comercio`, nace con `status: pending` y con `product` válido (`id`, `name`, `price` entre 0 y 9.999.999.999, `currency` de 3 letras mayúsculas, `imageUrl` http/https opcional) | Ofertas del cliente, ofertas ya aceptadas, precios ≤ 0 o desmesurados |
| Una oferta solo se modifica mientras está `pending`: puede pasar **una vez** a `accepted` (exige `orderId`) o `rejected`; el comercio puede corregir el producto o borrarla (cancelar) | Responder dos veces, “desaceptar”, cambiar el producto de una oferta ya respondida |
| `order_accepted` solo con `sender: cliente` y referenciando una oferta `accepted` con el mismo `orderId` | Confirmaciones falsas |

**Limitación conocida:** la prueba no usa Firebase Authentication, así que las reglas validan *qué* se escribe pero no *quién* lo escribe: cualquiera con la configuración web podría escribir como `cliente` o `comercio` respetando estas reglas. Mejora futura: Firebase Auth (anónimo o con cuenta) guardando el `uid` de cada parte en `chats/{chatId}/members` y exigiendo `auth.uid` en las reglas.

**Probar las reglas** en la consola (Realtime Database → Reglas → *Área de prueba de reglas*, sin autenticación), ubicación `/chats/chat-demo-001/messages/prueba1`, tipo *set*:

| Datos | Resultado esperado |
| ----- | ------------------ |
| `{"sender":"cliente","type":"text","text":"Hola","createdAt":1731023940000}` | Permitido |
| `{"sender":"cliente","type":"product_offer","status":"pending","product":{"id":"p-101","name":"Bandeja paisa","price":32000,"currency":"COP"},"createdAt":1731024000000}` | Denegado (oferta del cliente) |
| igual pero `"sender":"comercio"` y `"price":0` | Denegado (precio) |
| igual pero `"sender":"comercio"` y `"status":"accepted"` | Denegado (debe nacer pending) |
| igual pero `"sender":"comercio"` | Permitido |
| `{"sender":"cliente","type":"text","text":"Hola","createdAt":1731023940000,"id":"x"}` | Denegado (campo extra) |

Para las transiciones use la ruta de una oferta real del chat: *update* con `{"status":"accepted"}` sobre una oferta `pending` → denegado (falta `orderId`); `{"status":"accepted","orderId":"abc"}` → permitido; cualquier *update* sobre una oferta ya `accepted`/`rejected` → denegado; *set* `null` sobre un mensaje `text` → denegado.

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
| POST   | `/orders`     | 201 pedido creado · 400 datos inválidos · 409 la oferta ya tiene pedido (incluye `orderId` del pedido existente) |
| GET    | `/orders/:id` | 200 pedido · 404 no existe                                                 |

Validaciones de `POST /orders`: `chatId`, `messageId` y `product.id` obligatorios; `product.price` número mayor que cero, máximo 9.999.999.999 y hasta 2 decimales; `product.currency` código ISO de 3 letras; `product.imageUrl` URL opcional; campos extra rechazados; si `CHAT_ID` está definido, el `chatId` debe coincidir. Los pedidos se guardan en `orders.json` (`ORDERS_FILE`).

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
