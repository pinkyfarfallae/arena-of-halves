/** Parse hex or rgb() string into [r, g, b]. */
export function parseColor(color: string): [number, number, number] {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  const hex = color.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (WCAG). */
export function luminance(color: string): number {
  const [r, g, b] = parseColor(color).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Return a readable text color for the given background. */
export function contrastText(bg: string): string {
  const lum = luminance(bg);
  if (lum > 0.85) return bg;
  return lum > 0.4 ? '#000000' : '#ffffff';
}

/** Darken a color by a ratio (0–1). Negative ratio lightens. */
export function darken(color: string, ratio: number): string {
  const [r, g, b] = parseColor(color);
  const m = (c: number) => Math.round(c * (1 - ratio));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** Lighten a hex color by a ratio (0–1). */
export function lightenColor(color: string, amount: number): string {
  const m = color.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (!m) return color;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(parseInt(m[1], 16))},${mix(parseInt(m[2], 16))},${mix(parseInt(m[3], 16))})`;
}

/** Hex to RGB string. */
export const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `${r}, ${g}, ${b}`;
};

/** rgb to hex string. */
export const rgbToHex = (rgb: string) => {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

/** RGB string. */
export const rgbValues = (rgb: string) => {
  const match = rgb.match(/\d+/g);
  if (!match) return '';

  const [r, g, b] = match;
  return `${r}, ${g}, ${b}`;
};

export function colorMix(c1: string, c2: string, weight = 0.5) {
  const hex = (c: string) => c.replace('#', '');
  const num = (c: string) => parseInt(hex(c), 16);

  const r1 = (num(c1) >> 16) & 255;
  const g1 = (num(c1) >> 8) & 255;
  const b1 = num(c1) & 255;

  const r2 = (num(c2) >> 16) & 255;
  const g2 = (num(c2) >> 8) & 255;
  const b2 = num(c2) & 255;

  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  return `rgb(${r}, ${g}, ${b})`;
}