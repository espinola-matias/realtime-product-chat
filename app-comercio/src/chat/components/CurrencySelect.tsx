import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CURRENCIES, type CurrencyCode } from '../services/currency';
import './CurrencySelect.css';

interface CurrencySelectProps {
  id?: string;
  /** id del texto que nombra al selector (no usar <label>: reenvía clics y reabre la lista). */
  labelledBy?: string;
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  disabled?: boolean;
}

/**
 * Selector de moneda propio (patrón ARIA "listbox").
 * Reemplaza al <select> nativo porque su lista la dibuja el sistema operativo
 * (esquinas rectas y resaltado celeste) y no se puede estilizar en todos los navegadores.
 *
 * Teclado: ↑/↓ mover · Inicio/Fin · Enter/Espacio elegir · Esc cerrar · letra = saltar.
 */
export function CurrencySelect({ id, labelledBy, value, onChange, disabled = false }: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => indexOf(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => optionDomId(baseId, index);

  const selected = CURRENCIES[indexOf(value)];

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Al abrir: foco en la lista y opción activa visible.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    document.getElementById(optionDomId(baseId, activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, baseId]);

  function openList() {
    if (disabled) return;
    setActiveIndex(indexOf(value));
    setOpen(true);
  }

  function choose(index: number) {
    onChange(CURRENCIES[index].code);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = CURRENCIES.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (event.key.length === 1) {
          const letter = event.key.toLowerCase();
          const match = CURRENCIES.findIndex((c) => c.label.toLowerCase().startsWith(letter));
          if (match !== -1) setActiveIndex(match);
        }
    }
  }

  return (
    <div className={`currency-select ${open ? 'currency-select--open' : ''}`} ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className="currency-select__button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy ? `${labelledBy} ${id ?? ''}`.trim() : undefined}
        disabled={disabled}
      >
        <span className="currency-select__symbol">{selected.symbol}</span>
        <span className="currency-select__label">{selected.label}</span>
        <svg className="currency-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className="currency-select__list"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={optionId(activeIndex)}
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : 'Moneda'}
          onKeyDown={handleListKeyDown}
        >
          {CURRENCIES.map((currency, index) => {
            const isSelected = currency.code === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={currency.code}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                className={[
                  'currency-select__option',
                  isActive ? 'currency-select__option--active' : '',
                  isSelected ? 'currency-select__option--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={(event) => {
                  event.stopPropagation(); // ningún contenedor debe reinterpretar este clic
                  choose(index);
                }}
              >
                <span className="currency-select__symbol">{currency.symbol}</span>
                <span className="currency-select__label">{currency.label}</span>
                <span className="currency-select__code">{currency.code}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function optionDomId(baseId: string, index: number): string {
  return `${baseId}-opt-${index}`;
}

function indexOf(code: CurrencyCode): number {
  const index = CURRENCIES.findIndex((c) => c.code === code);
  return index === -1 ? 0 : index;
}
