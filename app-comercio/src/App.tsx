import { getChatId, getDb } from './chat/config/firebase';
import { ChatPage } from './chat/pages/ChatPage';

type Setup = { ok: true; chatId: string } | { ok: false; message: string };

function loadSetup(): Setup {
  try {
    getDb(); // valida las variables de Firebase al arrancar
    return { ok: true, chatId: getChatId() };
  } catch (error: unknown) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

const setup = loadSetup();

export default function App() {
  if (!setup.ok) {
    return (
      <div className="config-error" role="alert">
        <h1>No se pudo iniciar el chat</h1>
        <p>{setup.message}</p>
      </div>
    );
  }
  return <ChatPage chatId={setup.chatId} />;
}
