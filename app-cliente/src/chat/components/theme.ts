/**
 * Tema del cliente: claro (blanco/durazno pastel) con la misma marca naranja del comercio.
 * - Mensajes propios (cliente): naranja CLARO con texto marrón oscuro (13.8:1).
 * - Mensajes del comercio: naranja MEDIO con texto marrón oscuro (7.6:1).
 * Naranjas suaves y texto oscuro: nada de naranja quemado que “choque” sobre el fondo claro.
 * Contrastes verificados con WCAG (texto normal ≥ 4.5:1; texto grande ≥ 3:1).
 */
export const colors = {
  // Fondos
  bg: '#fff6ee',
  surface: '#ffffff',
  surfaceRaised: '#fffaf6',
  border: '#f2dccb',
  borderStrong: '#e8c6ab',

  // Texto
  text: '#2a1607',
  textMuted: '#8a6a55',

  // Marca
  brand: '#f97316', // rellenos (botones): texto oscuro encima, 6.2:1
  brandPressed: '#ea580c',
  onBrand: '#2a1607',
  brandText: '#c2410c', // texto naranja pequeño sobre blanco, 5.2:1
  brandTextLarge: '#ea580c', // texto naranja grande (títulos, precios), 3.6:1
  brandBright: '#ff7a1a',
  brandTint: '#ffe8d6',

  // Burbujas
  bubbleOwn: '#ffe0c7',
  bubbleOwnText: '#2a1607',
  bubbleOwnTime: '#7a4a2a', // 5.9:1
  bubbleOther: '#fb923c',
  bubbleOtherText: '#2a1607',
  bubbleOtherTime: '#5a2a0a', // 5.2:1
  bubbleOtherName: '#5c1500', // “COMERCIO”: 5.9:1 sobre bubbleOther, tono distinto al texto

  // Estados
  successSoft: '#e7f6ec',
  successBorder: '#b7e3c5',
  successText: '#166534',
  dangerSoft: '#fdecec',
  dangerBorder: '#f5c2c2',
  dangerText: '#b42318',
  warningSoft: '#fff1e6',
  warningText: '#9a3412',
} as const;

/** Mismas tipografías que el comercio: Sora (títulos) y Plus Jakarta Sans (texto). */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;
