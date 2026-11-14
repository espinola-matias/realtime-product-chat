import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
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

interface ChatPageProps {
  chatId: string;
}

const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function ChatPage({ chatId }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [offerPanel, setOfferPanel] = useState<OfferPanel>(null);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
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

  // Si el cliente responde la oferta mientras el comercio la corrige, se cierra el formulario.
  useEffect(() => {
    if (offerPanel?.mode !== 'edit') return;
    const current = messages.find((m) => m.id === offerPanel.offer.id);
    if (!current || current.type !== 'product_offer' || current.status !== 'pending') {
      setOfferPanel(null);
      setNotice('La oferta que estaba corrigiendo ya fue respondida o eliminada.');
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
      setNotice('Oferta corregida.');
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
      setNotice('Oferta cancelada.');
    } catch (error: unknown) {
      setActionError(errorText(error, 'No se pudo cancelar la oferta'));
    } finally {
      setBusyOfferId(null);
    }
  }

  const panelKey = offerPanel?.mode === 'edit' ? offerPanel.offer.id : 'create';

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
        {notice && <p className="chat__notice" role="status">{notice}</p>}

        <form className="composer" onSubmit={handleSubmit}>
          <button
            type="button"
            className="button"
            onClick={() => {
              setNotice(null);
              setOfferPanel(offerPanel?.mode === 'create' ? null : { mode: 'create' });
            }}
            aria-expanded={offerPanel?.mode === 'create'}
          >
            Enviar oferta
          </button>
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
