import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Product } from '../interfaces/chat-message.interface';
import { validateProduct } from '../services/chat.service';
import { CurrencySelect } from './CurrencySelect';
import {
  amountToInput,
  CURRENCIES,
  currencyDecimals,
  DEFAULT_CURRENCY,
  formatAmount,
  getCurrency,
  isSupportedCurrency,
  MAX_PRICE,
  parseAmountInput,
  sanitizeAmountInput,
  type CurrencyCode,
} from '../services/currency';
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
  /** Texto del campo, ya formateado: "32.000" o "12,50". */
  price: string;
  currency: CurrencyCode;
  imageUrl: string;
}

/** Productos de ejemplo para la demo (rellenan el formulario con un clic). */
const PRESETS: readonly Product[] = [
  { id: 'p-101', name: 'Chipa tradicional (docena)', price: 36000, currency: 'PYG' }, // Gs 36.000
  { id: 'p-102', name: 'Pão de queijo', price: 6, currency: 'BRL' }, // R$ 6,00
  { id: 'p-103', name: 'Donas glaseadas (docena)', price: 12, currency: 'USD' }, // US$ 12,00
];

const EMPTY: FormState = { id: '', name: '', price: '', currency: DEFAULT_CURRENCY, imageUrl: '' };

/** Valor del chip "Otro producto". */
const OTHER = 'otro';

const isSignificant = (char: string): boolean => /[\d,]/.test(char);

/** Posición en `text` justo después del carácter significativo número `count` (dígitos y coma). */
function caretAfterSignificant(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (isSignificant(text[i])) seen++;
    if (seen === count) return i + 1;
  }
  return text.length;
}

function toFormState(product: Product): FormState {
  const currency = isSupportedCurrency(product.currency) ? product.currency : DEFAULT_CURRENCY;
  return {
    id: product.id,
    name: product.name,
    price: amountToInput(product.price, currencyDecimals(currency)),
    currency,
    imageUrl: product.imageUrl ?? '',
  };
}

function toProduct(form: FormState): Product {
  const imageUrl = form.imageUrl.trim();
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    price: parseAmountInput(form.price),
    currency: form.currency,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function OfferForm({ mode, initialProduct, onSubmit, onClose }: OfferFormProps) {
  const [form, setForm] = useState<FormState>(initialProduct ? toFormState(initialProduct) : EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  /** Qué chip está marcado: un ejemplo o "Otro producto" (formulario libre). */
  const [choice, setChoice] = useState<string>(OTHER);
  const fieldId = useId();
  const priceRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function choosePreset(preset: Product) {
    setForm(toFormState(preset));
    setChoice(preset.id);
    setErrors([]);
  }

  /** Vacía el formulario (solo quedan los placeholders) para cargar un producto propio. */
  function chooseOther() {
    setForm(EMPTY);
    setChoice(OTHER);
    setErrors([]);
    nameRef.current?.focus();
  }
  /** Posición del cursor a restaurar tras reformatear el precio. */
  const pendingCaret = useRef<number | null>(null);

  const currency = getCurrency(form.currency) ?? CURRENCIES[0];

  useLayoutEffect(() => {
    if (pendingCaret.current === null || !priceRef.current) return;
    priceRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  const update = (field: 'id' | 'name' | 'imageUrl') => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function handlePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const next = sanitizeAmountInput(raw, currency.decimals);

    if (next === null) {
      // Excede el máximo o los decimales: se ignora la tecla y el cursor vuelve a su sitio.
      const inserted = raw.length - form.price.length;
      pendingCaret.current = Math.max(0, caret - Math.max(inserted, 0));
      setForm((prev) => ({ ...prev }));
      return;
    }

    const significantBefore = [...raw.slice(0, caret)].filter(isSignificant).length;
    pendingCaret.current = caretAfterSignificant(next, significantBefore);
    setForm((prev) => ({ ...prev, price: next }));
  }

  function handleCurrencyChange(code: CurrencyCode) {
    setForm((prev) => {
      // Al pasar a una moneda sin decimales (o con menos), se recortan los sobrantes.
      const decimals = currencyDecimals(code);
      const [integer, fraction = ''] = prev.price.split(',');
      const price =
        decimals === 0 || !prev.price.includes(',') ? integer : `${integer},${fraction.slice(0, decimals)}`;
      return { ...prev, currency: code, price };
    });
  }

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
  const pricePlaceholder = currency.decimals > 0 ? '12,50' : '32.000';

  return (
    <form className="offer-form" onSubmit={handleSubmit} aria-label={title} noValidate>
      <div className="offer-form__header">
        <h2 className="offer-form__title">{title}</h2>
        <button type="button" className="button button--small" onClick={onClose} disabled={submitting}>
          Cerrar
        </button>
      </div>

      {mode === 'create' && (
        <div className="offer-form__presets" role="group" aria-label="Productos de ejemplo">
          <span className="offer-form__presets-label">Ejemplos:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`chip ${choice === preset.id ? 'chip--active' : ''}`}
              aria-pressed={choice === preset.id}
              onClick={() => choosePreset(preset)}
              disabled={submitting}
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            className={`chip chip--other ${choice === OTHER ? 'chip--active' : ''}`}
            aria-pressed={choice === OTHER}
            onClick={chooseOther}
            disabled={submitting}
          >
            ✎ Otro producto
          </button>
        </div>
      )}

      <div className="offer-form__grid">
        <label className="field" htmlFor={`${fieldId}-name`}>
          <span>Nombre</span>
          <input
            ref={nameRef}
            id={`${fieldId}-name`}
            value={form.name}
            onChange={(e) => update('name')(e.target.value)}
            placeholder="Chipa tradicional (docena)"
            maxLength={200}
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
            maxLength={100}
            required
          />
        </label>
        {/*
          No es <label>: un label reenvía cada clic interno a su control asociado,
          y eso volvía a abrir la lista justo después de elegir una moneda.
        */}
        <div className="field">
          <span id={`${fieldId}-currency-label`}>Moneda</span>
          <CurrencySelect
            id={`${fieldId}-currency`}
            labelledBy={`${fieldId}-currency-label`}
            value={form.currency}
            onChange={handleCurrencyChange}
            disabled={submitting}
          />
        </div>
        <label className="field" htmlFor={`${fieldId}-price`}>
          <span>Precio</span>
          <div className="field__affix">
            <span className="field__prefix" aria-hidden="true">
              {currency.symbol}
            </span>
            <input
              ref={priceRef}
              id={`${fieldId}-price`}
              type="text"
              inputMode={currency.decimals > 0 ? 'decimal' : 'numeric'}
              autoComplete="off"
              value={form.price}
              onChange={handlePriceChange}
              placeholder={pricePlaceholder}
              aria-describedby={`${fieldId}-price-hint`}
              required
            />
          </div>
          <small id={`${fieldId}-price-hint`} className="field__hint">
            {currency.decimals > 0 ? `Hasta ${currency.decimals} decimales con coma. ` : 'Sin decimales. '}
            Máx. {formatAmount(MAX_PRICE, 0)}
          </small>
        </label>
        <label className="field field--wide" htmlFor={`${fieldId}-image`}>
          <span>URL de la imagen (opcional)</span>
          <input
            id={`${fieldId}-image`}
            type="url"
            value={form.imageUrl}
            onChange={(e) => update('imageUrl')(e.target.value)}
            placeholder="https://…"
            maxLength={2000}
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
