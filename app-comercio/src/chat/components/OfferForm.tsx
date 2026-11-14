import { useId, useState, type FormEvent } from 'react';
import type { Product } from '../interfaces/chat-message.interface';
import { validateProduct } from '../services/chat.service';
import './OfferForm.css';

interface OfferFormProps {
  /** 'create' = nueva oferta; 'edit' = corregir una oferta pending. */
  mode: 'create' | 'edit';
  initialProduct?: Product;
  onSubmit: (product: Product) => Promise<void>;
  onClose: () => void;
}

interface FormState {
  id: string;
  name: string;
  price: string;
  currency: string;
  imageUrl: string;
}

/** Productos de ejemplo para la demo (rellenan el formulario con un clic). */
const PRESETS: readonly Product[] = [
  { id: 'p-101', name: 'Bandeja paisa', price: 32000, currency: 'COP', imageUrl: 'https://ejemplo.com/bandeja.jpg' },
  { id: 'p-102', name: 'Ajiaco santafereño', price: 28000, currency: 'COP' },
  { id: 'p-103', name: 'Limonada de coco', price: 9500, currency: 'COP' },
];

const EMPTY: FormState = { id: '', name: '', price: '', currency: 'COP', imageUrl: '' };

function toFormState(product: Product): FormState {
  return {
    id: product.id,
    name: product.name,
    price: String(product.price),
    currency: product.currency,
    imageUrl: product.imageUrl ?? '',
  };
}

function toProduct(form: FormState): Product {
  const imageUrl = form.imageUrl.trim();
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    price: form.price.trim() === '' ? Number.NaN : Number(form.price),
    currency: form.currency.trim().toUpperCase(),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function OfferForm({ mode, initialProduct, onSubmit, onClose }: OfferFormProps) {
  const [form, setForm] = useState<FormState>(initialProduct ? toFormState(initialProduct) : EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fieldId = useId();

  const update = (field: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const product = toProduct(form);
    const validation = validateProduct(product);
    setErrors(validation);
    if (validation.length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(product);
      onClose();
    } catch (error: unknown) {
      setErrors([error instanceof Error ? error.message : 'No se pudo guardar la oferta']);
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === 'create' ? 'Nueva oferta de producto' : 'Corregir oferta';

  return (
    <form className="offer-form" onSubmit={handleSubmit} aria-label={title} noValidate>
      <div className="offer-form__header">
        <h2 className="offer-form__title">{title}</h2>
        <button type="button" className="button button--small" onClick={onClose} disabled={submitting}>
          Cerrar
        </button>
      </div>

      {mode === 'create' && (
        <div className="offer-form__presets">
          <span className="offer-form__presets-label">Ejemplos:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chip"
              onClick={() => setForm(toFormState(preset))}
              disabled={submitting}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      <div className="offer-form__grid">
        <label className="field" htmlFor={`${fieldId}-name`}>
          <span>Nombre</span>
          <input
            id={`${fieldId}-name`}
            value={form.name}
            onChange={(e) => update('name')(e.target.value)}
            placeholder="Bandeja paisa"
            required
          />
        </label>
        <label className="field" htmlFor={`${fieldId}-id`}>
          <span>Id del producto</span>
          <input
            id={`${fieldId}-id`}
            value={form.id}
            onChange={(e) => update('id')(e.target.value)}
            placeholder="p-101"
            required
          />
        </label>
        <label className="field" htmlFor={`${fieldId}-price`}>
          <span>Precio</span>
          <input
            id={`${fieldId}-price`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.price}
            onChange={(e) => update('price')(e.target.value)}
            placeholder="32000"
            required
          />
        </label>
        <label className="field" htmlFor={`${fieldId}-currency`}>
          <span>Moneda</span>
          <input
            id={`${fieldId}-currency`}
            value={form.currency}
            onChange={(e) => update('currency')(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="COP"
            required
          />
        </label>
        <label className="field field--wide" htmlFor={`${fieldId}-image`}>
          <span>URL de la imagen (opcional)</span>
          <input
            id={`${fieldId}-image`}
            type="url"
            value={form.imageUrl}
            onChange={(e) => update('imageUrl')(e.target.value)}
            placeholder="https://…"
          />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="offer-form__errors" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="offer-form__footer">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Guardando…' : mode === 'create' ? 'Enviar oferta' : 'Guardar corrección'}
        </button>
      </div>
    </form>
  );
}
