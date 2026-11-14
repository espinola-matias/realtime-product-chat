import { describe, expect, it } from 'vitest';
import {
  amountToInput,
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatAmount,
  formatPrice,
  hasValidDecimals,
  MAX_PRICE,
  parseAmountInput,
  sanitizeAmountInput,
} from './currency';

describe('monedas', () => {
  it('guaraníes es la moneda por defecto y todas tienen símbolo', () => {
    expect(DEFAULT_CURRENCY).toBe('PYG');
    expect(CURRENCIES.map((c) => c.code)).toEqual(['PYG', 'USD', 'BRL', 'ARS', 'COP', 'EUR']);
    expect(CURRENCIES.every((c) => c.symbol.length > 0)).toBe(true);
  });
});

describe('formatAmount / formatPrice', () => {
  it.each([
    [32000, 'PYG', 'Gs 32.000'],
    [5000, 'PYG', 'Gs 5.000'],
    [1234567890, 'PYG', 'Gs 1.234.567.890'],
    [12.5, 'USD', 'US$ 12,50'],
    [1999.9, 'BRL', 'R$ 1.999,90'],
    [32000, 'COP', 'COL$ 32.000'],
    [9.99, 'EUR', '€ 9,99'],
    [100, 'ARS', 'AR$ 100,00'],
  ])('%d %s → %s', (price, currency, expected) => {
    expect(formatPrice(price, currency)).toBe(expected);
  });

  it('usa el código si la moneda es desconocida', () => {
    expect(formatPrice(1500, 'XYZ')).toBe('XYZ 1.500');
  });

  it('agrupa miles con punto y decimales con coma', () => {
    expect(formatAmount(1234.5, 2)).toBe('1.234,50');
    expect(formatAmount(999, 0)).toBe('999');
  });
});

describe('sanitizeAmountInput', () => {
  it.each([
    ['32000', 0, '32.000'],
    ['32.000', 0, '32.000'],
    ['1234567', 0, '1.234.567'],
    ['00045', 0, '45'],
    ['12,5', 2, '12,5'],
    ['1234,56', 2, '1.234,56'],
    [',5', 2, '0,5'],
    ['12,', 2, '12,'],
  ])('"%s" (%d decimales) → "%s"', (raw, decimals, expected) => {
    expect(sanitizeAmountInput(raw, decimals)).toBe(expected);
  });

  it.each([
    ['letras y signos', 'abc-1e5+', 0, '15'],
    ['notación científica', '1e999', 0, '1.999'],
    ['coma en moneda sin decimales', '12,5', 0, '125'],
  ])('descarta %s', (_caso, raw, decimals, expected) => {
    expect(sanitizeAmountInput(raw, decimals)).toBe(expected);
  });

  it('rechaza más de 10 dígitos enteros', () => {
    expect(sanitizeAmountInput('9999999999', 0)).toBe('9.999.999.999');
    expect(sanitizeAmountInput('99999999999', 0)).toBeNull();
  });

  it('rechaza más decimales de los que admite la moneda', () => {
    expect(sanitizeAmountInput('12,345', 2)).toBeNull();
  });
});

describe('parseAmountInput / amountToInput', () => {
  it('convierte el texto del campo a número', () => {
    expect(parseAmountInput('32.000')).toBe(32000);
    expect(parseAmountInput('1.234,56')).toBe(1234.56);
    expect(parseAmountInput('')).toBeNaN();
  });

  it('convierte el número al texto del campo sin ceros de relleno', () => {
    expect(amountToInput(32000, 0)).toBe('32.000');
    expect(amountToInput(12.5, 2)).toBe('12,5');
    expect(amountToInput(100, 2)).toBe('100');
    expect(amountToInput(Number.NaN, 2)).toBe('');
  });

  it('ida y vuelta conserva el valor', () => {
    expect(parseAmountInput(amountToInput(MAX_PRICE, 0))).toBe(MAX_PRICE);
  });
});

describe('hasValidDecimals', () => {
  it('valida según la moneda', () => {
    expect(hasValidDecimals(32000, 0)).toBe(true);
    expect(hasValidDecimals(32000.5, 0)).toBe(false);
    expect(hasValidDecimals(12.34, 2)).toBe(true);
    expect(hasValidDecimals(12.345, 2)).toBe(false);
  });
});
