import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import logoUrl from '../../assets/logo-comercio.webp';
import { MessageBubble } from '../components/MessageBubble';
import { OfferForm } from '../components/OfferForm';
import { ProductOfferCard } from '../components/ProductOfferCard';
import type { ChatMessage, Product, ProductOfferMessage, Sender } from '../interfaces/chat-message.interface';
import {
  cancelOffer,
  listenConnection,
  listenMessages,
  MAX_TEXT_LENGTH,
  sendProductOffer,
  sendTextMessage,
  updateOffer,
} from '../services/chat.service';
import './ChatPage.css';

const VIEWER: Sender = 'comercio';

type OfferPanel = { mode: 'create' } | { mode: 'edit'; offer: ProductOfferMessage } | null;

/** Aviso temporal: verde (éxito) o rojo (cancelación / problema). */
type Notice = { kind: 'success' | 'danger'; text: string } | null;

/** Tiempo que un aviso queda visible antes de cerrarse solo. */
const NOTICE_DURATION_MS = 5000;

interface ChatPageProps {
  chatId: string;
}

const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const INPUT_MAX_HEIGHT = 160;

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function ChatPage({ chatId }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [offerPanel, setOfferPanel] = useState<OfferPanel>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // El campo crece en alto con el texto (nunca en ancho) hasta INPUT_MAX_HEIGHT.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, INPUT_MAX_HEIGHT)}px`;
  }, [draft]);

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

  // Cada aviso nuevo se cierra solo a los 5 s (también se puede cerrar con la X).
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  // Si el cliente responde la oferta mientras el comercio la corrige, se cierra el formulario.
  useEffect(() => {
    if (offerPanel?.mode !== 'edit') return;
    const current = messages.find((m) => m.id === offerPanel.offer.id);
    if (!current || current.type !== 'product_offer' || current.status !== 'pending') {
      setOfferPanel(null);
      setNotice({ kind: 'danger', text: 'La oferta que estaba corrigiendo ya fue respondida o eliminada.' });
    }
  }, [messages, offerPanel]);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    setActionError(null);
    try {
      await sendTextMessage(chatId, VIEWER, draft);
      setDraft('');
    } catch (error: unknown) {
      setActionError(errorText(error, 'No se pudo enviar el mensaje'));
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

  async function handleOfferSubmit(product: Product) {
    setNotice(null);
    if (offerPanel?.mode === 'edit') {
      await updateOffer(chatId, offerPanel.offer.id, product);
      setNotice({ kind: 'success', text: 'Oferta corregida.' });
    } else {
      await sendProductOffer(chatId, product);
    }
  }

  function handleEdit(offer: ProductOfferMessage) {
    setNotice(null);
    setOfferPanel({ mode: 'edit', offer });
  }

  async function handleCancel(offer: ProductOfferMessage) {
    if (!window.confirm(`¿Cancelar la oferta de "${offer.product.name}"? Se eliminará del chat.`)) return;

    setBusyOfferId(offer.id);
    setActionError(null);
    setNotice(null);
    try {
      await cancelOffer(chatId, offer.id);
      setNotice({ kind: 'danger', text: 'Oferta cancelada.' });
    } catch (error: unknown) {
      setActionError(errorText(error, 'No se pudo cancelar la oferta'));
    } finally {
      setBusyOfferId(null);
    }
  }

  const panelKey = offerPanel?.mode === 'edit' ? offerPanel.offer.id : 'create';

  return (
    <div className="chat">
      <header className="chat__header" title={`Chat ${chatId}`}>
        <div className="chat__brand">
          <img className="chat__logo" src={logoUrl} alt="App Comercio" width={44} height={44} />
          <h1 className="chat__title">
            <span className="chat__title-brand">Comercio</span>
            <span className="chat__title-sep" aria-hidden="true">
              ·
            </span>
            Chat
          </h1>
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
              return (
                <ProductOfferCard
                  key={message.id}
                  message={message}
                  onEdit={handleEdit}
                  onCancel={(offer) => void handleCancel(offer)}
                  busy={busyOfferId === message.id}
                />
              );
          }
        })}
        <div ref={listEndRef} />
      </main>

      <footer className="chat__composer">
        {offerPanel && (
          <OfferForm
            key={panelKey}
            mode={offerPanel.mode}
            initialProduct={offerPanel.mode === 'edit' ? offerPanel.offer.product : undefined}
            onSubmit={handleOfferSubmit}
            onClose={() => setOfferPanel(null)}
          />
        )}
        {actionError && <p className="chat__error" role="alert">{actionError}</p>}
        {notice && (
          <div className={`chat__notice chat__notice--${notice.kind}`} role="status">
            <span>{notice.text}</span>
            <button
              type="button"
              className="chat__notice-close"
              onClick={() => setNotice(null)}
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        )}

        <form className="composer" onSubmit={handleSubmit}>
          <button
            type="button"
            className="button button--outline"
            onClick={() => {
              setNotice(null);
              setOfferPanel(offerPanel?.mode === 'create' ? null : { mode: 'create' });
            }}
            aria-expanded={offerPanel?.mode === 'create'}
            aria-label="Enviar oferta"
          >
            <TagIcon />
            <span className="composer__offer-label">Enviar oferta</span>
          </button>
          <textarea
            ref={inputRef}
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
            {!sending && <SendIcon />}
          </button>
        </form>
      </footer>
    </div>
  );
}
