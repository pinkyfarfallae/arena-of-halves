import * as THREE from 'three';

/* ── Color helpers ── */

function parseColor(color: string): [number, number, number] {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  const hex = color.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(color: string): number {
  const [r, g, b] = parseColor(color).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastText(bg: string): string {
  const lum = luminance(bg);
  if (lum > 0.85) return bg;
  return lum > 0.4 ? '#000000' : '#ffffff';
}

function darken(color: string, ratio: number): string {
  const [r, g, b] = parseColor(color);
  const m = (c: number) => Math.round(c * (1 - ratio));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/* ── Flat primary face with number baked in ── */
function makeFaceTexture(num: number, primary: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);

  const textColor = contrastText(primary);
  ctx.fillStyle = textColor;
  ctx.font = 'bold 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), size / 2, size * 2 / 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

