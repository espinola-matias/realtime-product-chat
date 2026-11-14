import type { OrderAcceptedMessage, Sender, TextMessage } from '../interfaces/chat-message.interface';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: TextMessage | OrderAcceptedMessage;
  /** Quién está viendo el chat: sus mensajes van a la derecha. */
  viewer: Sender;
}

const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' });

const senderLabel: Record<Sender, string> = { cliente: 'Cliente', comercio: 'Comercio' };

export function MessageBubble({ message, viewer }: MessageBubbleProps) {
  const own = message.sender === viewer;
  const isConfirmation = message.type === 'order_accepted';

  const classes = [
    'bubble',
    own ? 'bubble--own' : 'bubble--other',
    isConfirmation ? 'bubble--confirmation' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`bubble-row ${own ? 'bubble-row--own' : ''}`}>
      <div className={classes}>
        {!own && <span className="bubble__sender">{senderLabel[message.sender]}</span>}
        <p className="bubble__text">{message.text}</p>
        <time className="bubble__time" dateTime={new Date(message.createdAt).toISOString()}>
          {timeFormat.format(message.createdAt)}
        </time>
      </div>
    </div>
  );
}
