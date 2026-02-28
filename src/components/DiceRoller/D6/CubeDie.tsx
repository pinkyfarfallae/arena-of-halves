import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
  primary: string;
  primaryDark: string;
  fixedResult?: number;
}

/** Cube half-size */
const S = 0.85;

/** 8 vertices of the cube */
const VERTS: THREE.Vector3Tuple[] = [
  [-S, -S, -S], [-S, -S, S], [-S, S, -S], [-S, S, S],
  [S, -S, -S], [S, -S, S], [S, S, -S], [S, S, S],
];

/** 12 edges (vertex index pairs) */
const EDGE_INDICES: [number, number][] = [
  [0, 1], [1, 5], [5, 4], [4, 0], // bottom face
  [2, 3], [3, 7], [7, 6], [6, 2], // top face
  [0, 2], [1, 3], [4, 6], [5, 7], // verticals
];

/** Face normals for BoxGeometry groups: +X, -X, +Y, -Y, +Z, -Z */
const FACE_NORMALS: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

/** Pip value per BoxGeometry group: +X=2, -X=5, +Y=3, -Y=4, +Z=1, -Z=6 */
const FACE_VALUES = [2, 5, 3, 4, 1, 6];


/** Target quaternions: rotate so face N points toward +Z (camera) */
const TARGET_QUATS: Record<number, THREE.Quaternion> = {
  1: new THREE.Quaternion(),
  2: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
  3: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  4: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  5: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
  6: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
};

const EDGE_RADIUS = 0.02;
const SPIN_DURATION = 1.5;
const SETTLE_DURATION = 0.3;
const FLASH_DURATION = SETTLE_DURATION;
const camDir = new THREE.Vector3(0, 0, 1);

/* ── Color helpers ── */

function parseColor(color: string): [number, number, number] {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  const h = color.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
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

/* ── Texture / geometry builders ── */

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
  ctx.font = 'bold 180px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeEdgeCylinder(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, radius: number, baseColor: THREE.Color): THREE.CylinderGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const height = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1);

  const tA = (a[1] + S) / (2 * S);
  const tB = (b[1] + S) / (2 * S);
  const positions = geo.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const along = (y + height / 2) / height;
    const tint = 0.5 + 0.45 * (tA + (tB - tA) * along);
    colors[i * 3] = baseColor.r * tint;
    colors[i * 3 + 1] = baseColor.g * tint;
    colors[i * 3 + 2] = baseColor.b * tint;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function edgeTransform(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return { pos: mid, quat };
}

/* ── Component ── */

export default function CubeDie({ rollTrigger, onResult, primary, primaryDark, fixedResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const prevTrigger = useRef(0);
  const hasReported = useRef(false);

  const spinning = useRef(false);
  const spinStart = useRef(0);
  const spinAxis = useRef(new THREE.Vector3(1, 1, 0).normalize());
  const spinSpeed = useRef(8);
  const targetResult = useRef(0);
  const targetQuat = useRef(new THREE.Quaternion());
  const settleStartQuat = useRef(new THREE.Quaternion());
  const settleStart = useRef(0);

  const flashing = useRef(false);
  const flashStart = useRef(0);

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, -0.35)), [primary]);
  const worldNormal = useRef(new THREE.Vector3());

  const geometry = useMemo(() => new THREE.BoxGeometry(S * 2, S * 2, S * 2), []);

  const materials = useMemo(() =>
    FACE_VALUES.map(v => new THREE.MeshBasicMaterial({ map: makeFaceTexture(v, primary) })),
    [primary],
  );

  const edges = useMemo(() =>
    EDGE_INDICES.map(([ai, bi]) => ({
      geo: makeEdgeCylinder(VERTS[ai], VERTS[bi], EDGE_RADIUS, edgeBaseColor),
      ...edgeTransform(VERTS[ai], VERTS[bi]),
    })),
    [edgeBaseColor],
  );

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(EDGE_RADIUS, 8, 8), []);

  // Roll trigger
  useEffect(() => {
    if (rollTrigger === 0) return;
    if (rollTrigger === prevTrigger.current) return;
    prevTrigger.current = rollTrigger;

    hasReported.current = false;
    spinning.current = true;
    spinStart.current = 0;

    const sx = Math.random() < 0.5 ? -1 : 1;
    const sy = Math.random() < 0.5 ? -1 : 1;
    const sz = Math.random() < 0.5 ? -1 : 1;

    spinAxis.current
      .set(
        sx * (0.5 + Math.random() * 0.5),
        sy * (0.5 + Math.random() * 0.5),
        sz * (0.5 + Math.random() * 0.5),
      )
      .normalize();

    spinSpeed.current = 14 + Math.random() * 4;

    targetResult.current = fixedResult ?? (Math.floor(Math.random() * 6) + 1);
    targetQuat.current.copy(TARGET_QUATS[targetResult.current]);
  }, [rollTrigger]);

  // Tint faces based on camera-facing direction + flash
  const tintFaces = () => {
    if (!groupRef.current) return;

    let flash = 0;
    if (flashing.current && flashStart.current > 0) {
      const flashElapsed = performance.now() / 1000 - flashStart.current;
      const ft = Math.min(flashElapsed / FLASH_DURATION, 1);
      flash = 1 - ft;
      if (ft >= 1) flashing.current = false;

      const scalePunch = 1 + 0.08 * Math.sin(ft * Math.PI);
      groupRef.current.scale.setScalar(scalePunch);
    }

    for (let i = 0; i < 6; i++) {
      worldNormal.current.copy(FACE_NORMALS[i]).applyQuaternion(groupRef.current.quaternion);
      const dot = worldNormal.current.dot(camDir);
      let brightness = 0.55 + 0.45 * Math.max(0, dot);
      if (flash > 0) {
        brightness = brightness + (2.0 - brightness) * flash * 0.6;
      }
      materials[i].color.setScalar(brightness);
    }
  };

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    tintFaces();

    if (!spinning.current) return;

    if (spinStart.current === 0) {
      spinStart.current = performance.now() / 1000;
      settleStart.current = 0;
    }

    const elapsed = performance.now() / 1000 - spinStart.current;

    if (elapsed < SPIN_DURATION) {
      const progress = elapsed / SPIN_DURATION;
      const decay = Math.pow(1 - progress, 1.5);
      groupRef.current.rotateOnAxis(spinAxis.current, spinSpeed.current * decay * delta);
    } else {
      if (settleStart.current === 0) {
        settleStart.current = performance.now() / 1000;
        settleStartQuat.current.copy(groupRef.current.quaternion);
      }

      const settleElapsed = performance.now() / 1000 - settleStart.current;
      const t = Math.min(settleElapsed / SETTLE_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      groupRef.current.quaternion.copy(settleStartQuat.current).slerp(targetQuat.current, eased);

      if (t >= 1) {
        spinning.current = false;
        groupRef.current.quaternion.copy(targetQuat.current);

        if (!hasReported.current) {
          hasReported.current = true;
          flashing.current = true;
          flashStart.current = performance.now() / 1000;
          onResult(targetResult.current);
        }
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      <mesh geometry={geometry} material={materials} />
      {edges.map((edge, i) => (
        <mesh key={`edge-${i}`} geometry={edge.geo} position={edge.pos} quaternion={edge.quat}>
          <meshBasicMaterial vertexColors />
        </mesh>
      ))}
      {VERTS.map((v, i) => (
        <mesh key={`corner-${i}`} geometry={sphereGeo} position={v}>
          <meshBasicMaterial color={edgeBaseColor} />
        </mesh>
      ))}
    </group>
  );
}
