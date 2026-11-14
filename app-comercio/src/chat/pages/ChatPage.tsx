import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MessageBubble } from '../components/MessageBubble';
import type { ChatMessage, Sender } from '../interfaces/chat-message.interface';
import {
  listenConnection,
  listenMessages,
  MAX_TEXT_LENGTH,
  sendTextMessage,
} from '../services/chat.service';
import './ChatPage.css';

const VIEWER: Sender = 'comercio';

interface ChatPageProps {
  chatId: string;
}

export function ChatPage({ chatId }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Listener en tiempo real de los mensajes del chat.
  useEffect(() => {
    setLoading(true);
    setListenError(null);
    const unsubscribe = listenMessages(
      chatId,
      (next) => {
        setMessages(next);
        setLoading(false);
      },
      (error) => {
        setListenError(error.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [chatId]);

  useEffect(() => listenConnection(setConnected), []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    setSendError(null);
    try {
      await sendTextMessage(chatId, VIEWER, draft);
      setDraft('');
    } catch (error: unknown) {
      setSendError(error instanceof Error ? error.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="chat">
      <header className="chat__header">
        <div>
          <h1 className="chat__title">Chat con el cliente</h1>
          <p className="chat__subtitle">
            Comercio · chat <code>{chatId}</code>
          </p>
        </div>
        <span className={`chat__status ${connected ? 'chat__status--on' : ''}`}>
          {connected ? 'En línea' : 'Sin conexión'}
        </span>
      </header>

      <main className="chat__messages" aria-live="polite">
        {loading && <p className="chat__hint">Cargando mensajes…</p>}
        {listenError && <p className="chat__error" role="alert">{listenError}</p>}
        {!loading && !listenError && messages.length === 0 && (
          <p className="chat__hint">Aún no hay mensajes. Escriba el primero.</p>
        )}

        {messages.map((message) => {
          switch (message.type) {
            case 'text':
            case 'order_accepted':
              return <MessageBubble key={message.id} message={message} viewer={VIEWER} />;
            case 'product_offer':
              // ProductOfferCard llega en la etapa E4.
              return (
                <p key={message.id} className="chat__hint">
                  Oferta: {message.product.name} ({message.status})
                </p>
              );
          }
        })}
        <div ref={listEndRef} />
      </main>

      <footer className="chat__composer">
        {sendError && <p className="chat__error" role="alert">{sendError}</p>}
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            className="composer__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escriba un mensaje…"
            rows={1}
            maxLength={MAX_TEXT_LENGTH}
            aria-label="Mensaje"
          />
          <button className="button button--primary" type="submit" disabled={sending || !draft.trim()}>
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </footer>
    </div>
  );
}
