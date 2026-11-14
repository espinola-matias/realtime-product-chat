/**
 * Monedas, símbolos y formato de precios.
 * Formato regional: punto para miles y coma para decimales (32.000 · 12,50).
 */

export interface CurrencyInfo {
  code: string;
  label: string;
  symbol: string;
  /** Cantidad de decimales permitidos al ofertar. */
  decimals: number;
}

export const CURRENCIES = [
  { code: 'PYG', label: 'Guaraníes', symbol: 'Gs', decimals: 0 },
  { code: 'USD', label: 'Dólares', symbol: 'US$', decimals: 2 },
  { code: 'BRL', label: 'Reales', symbol: 'R$', decimals: 2 },
  { code: 'ARS', label: 'Pesos argentinos', symbol: 'AR$', decimals: 2 },
  { code: 'COP', label: 'Pesos colombianos', symbol: 'COL$', decimals: 0 },
  { code: 'EUR', label: 'Euros', symbol: '€', decimals: 2 },
] as const satisfies readonly CurrencyInfo[];

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export const DEFAULT_CURRENCY: CurrencyCode = 'PYG';

/** Precio máximo admitido (10 dígitos enteros): 9.999.999.999. */
export const MAX_PRICE = 9_999_999_999;
export const MAX_INTEGER_DIGITS = 10;

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

export function getCurrency(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** Decimales de la moneda (2 si es una moneda desconocida). */
export function currencyDecimals(code: string): number {
  return getCurrency(code)?.decimals ?? 2;
}

/** Agrupa los miles con punto: "1234567" → "1.234.567". */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Número → texto con miles y decimales: (32000, 0) → "32.000"; (12.5, 2) → "12,50". */
export function formatAmount(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split('.');
  const sign = value < 0 ? '-' : '';
  return `${sign}${groupThousands(integer)}${fraction ? `,${fraction}` : ''}`;
}

/** Precio listo para mostrar: "Gs 32.000", "US$ 12,50". */
export function formatPrice(price: number, currency: string): string {
  const info = getCurrency(currency);
  const decimals = info?.decimals ?? (Number.isInteger(price) ? 0 : 2);
  return `${info?.symbol ?? currency} ${formatAmount(price, decimals)}`;
}

/* ───────────────────────────── Campo de precio ───────────────────────────── */

/**
 * Limpia lo que escribe el usuario en el campo de precio y lo devuelve formateado.
 * - Solo dígitos y, si la moneda tiene decimales, una coma decimal (el punto se trata como miles).
 * - Máximo MAX_INTEGER_DIGITS enteros y los decimales de la moneda.
 * Devuelve null si la entrada excede los límites (el campo conserva el valor anterior).
 */
export function sanitizeAmountInput(raw: string, decimals: number): string | null {
  const cleaned = raw.replace(/[^\d,]/g, '');
  const commaIndex = cleaned.indexOf(',');
  const hasComma = decimals > 0 && commaIndex !== -1;

  let integer = (hasComma ? cleaned.slice(0, commaIndex) : cleaned).replace(/,/g, '');
  const fraction = hasComma ? cleaned.slice(commaIndex + 1).replace(/,/g, '') : '';

  integer = integer.replace(/^0+(?=\d)/, ''); // sin ceros a la izquierda
  if (integer.length > MAX_INTEGER_DIGITS || fraction.length > decimals) return null;
  if (hasComma && integer === '') integer = '0';

  return `${groupThousands(integer)}${hasComma ? `,${fraction}` : ''}`;
}

/** "32.000,5" → 32000.5 ; "" → NaN */
export function parseAmountInput(text: string): number {
  const normalized = text.replace(/\./g, '').replace(',', '.');
  if (normalized === '' || normalized === '.') return Number.NaN;
  return Number(normalized);
}

/** Valor numérico → texto del campo ("32.000", "12,5"), sin decimales de relleno. */
export function amountToInput(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '';
  const text = formatAmount(value, decimals);
  return decimals > 0 ? text.replace(/,?0+$/, '') : text;
}

/** ¿El precio respeta la cantidad de decimales de la moneda? */
export function hasValidDecimals(price: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(price * factor - Math.round(price * factor)) < 1e-6;
}
