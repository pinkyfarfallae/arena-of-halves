import * as THREE from 'three';
import { contrastText } from '../../utils/color';

export interface FaceTextureOptions {
  label: string;
  primary: string;
  size?: number;
  fontSize?: number | ((label: string) => number);
  yPosition?: number | ((size: number) => number);
  /** Custom canvas transform (e.g. D12 flips text 180°). */
  transform?: (ctx: CanvasRenderingContext2D, size: number) => void;
}

/**
 * Create a canvas texture for a single die face:
 * solid primary background + contrast-colored number/label.
 */
export function makeFaceTexture(opts: FaceTextureOptions): THREE.CanvasTexture {
  const {
    label,
    primary,
    size = 512,
    fontSize = 140,
    yPosition = (sz: number) => sz * 2 / 3,
    transform,
  } = opts;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);

  const textColor = contrastText(primary);
  ctx.fillStyle = textColor;
  const fs = typeof fontSize === 'function' ? fontSize(label) : fontSize;
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (transform) {
    ctx.save();
    transform(ctx, size);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  } else {
    const y = typeof yPosition === 'function' ? yPosition(size) : yPosition;
    ctx.fillText(label, size / 2, y);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
