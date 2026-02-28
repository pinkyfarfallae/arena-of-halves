import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
  primary: string;
  primaryDark: string;
}

/* ── Geometry ──
   Regular icosahedron: 12 vertices, 20 triangular faces, 30 edges.
*/
const PHI = (1 + Math.sqrt(5)) / 2;
const S = 0.85; // scale

const RAW: THREE.Vector3Tuple[] = [
  [0,  1,  PHI], [0,  1, -PHI], [0, -1,  PHI], [0, -1, -PHI],
  [ 1,  PHI, 0], [ 1, -PHI, 0], [-1,  PHI, 0], [-1, -PHI, 0],
  [ PHI, 0,  1], [ PHI, 0, -1], [-PHI, 0,  1], [-PHI, 0, -1],
];

const ALL_VERTS: THREE.Vector3Tuple[] = RAW.map(
  v => [v[0] * S, v[1] * S, v[2] * S] as THREE.Vector3Tuple,
);

/* ── 20 triangular faces (CCW from outside) ── */
const FACE_IDX: number[][] = [
  [0, 2, 8],  [0, 8, 4],  [0, 4, 6],  [0, 6, 10], [0, 10, 2],
  [3, 1, 9],  [3, 9, 5],  [3, 5, 7],  [3, 7, 11], [3, 11, 1],
  [2, 5, 8],  [8, 9, 4],  [4, 1, 6],  [6, 11, 10],[10, 7, 2],
  [5, 2, 7],  [9, 8, 5],  [1, 4, 9],  [11, 6, 1], [7, 10, 11],
];

const FACES: THREE.Vector3Tuple[][] = FACE_IDX.map(
  idx => idx.map(i => ALL_VERTS[i]),
);

const NUM_FACES = 20;

function computeNormal(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): THREE.Vector3 {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const vc = new THREE.Vector3(...c);
  return vb.sub(va).cross(vc.sub(new THREE.Vector3(...a))).normalize();
}

const NORMALS = FACES.map(f => computeNormal(f[0], f[1], f[2]));

const CENTROIDS = FACES.map(verts => new THREE.Vector3(
  (verts[0][0] + verts[1][0] + verts[2][0]) / 3,
  (verts[0][1] + verts[1][1] + verts[2][1]) / 3,
  (verts[0][2] + verts[1][2] + verts[2][2]) / 3,
));

// Verify normals point outward; flip if needed
(() => {
  FACES.forEach((verts, fi) => {
    if (CENTROIDS[fi].dot(NORMALS[fi]) < 0) {
      // Swap vertices 1 and 2 to flip winding
      const tmp = verts[1];
      verts[1] = verts[2];
      verts[2] = tmp;
      const tmpIdx = FACE_IDX[fi][1];
      FACE_IDX[fi][1] = FACE_IDX[fi][2];
      FACE_IDX[fi][2] = tmpIdx;
      NORMALS[fi].negate();
    }
  });
})();

/* ── Face values: opposite faces sum to 21 ── */
const FACE_VALUES = (() => {
  const vals = new Array(NUM_FACES).fill(0);
  const paired = new Set<number>();
  let next = 1;
  for (let i = 0; i < NUM_FACES; i++) {
    if (paired.has(i)) continue;
    let bestJ = -1, bestDot = Infinity;
    for (let j = i + 1; j < NUM_FACES; j++) {
      if (paired.has(j)) continue;
      const dot = CENTROIDS[i].dot(CENTROIDS[j]);
      if (dot < bestDot) { bestDot = dot; bestJ = j; }
    }
    vals[i] = next;
    vals[bestJ] = 21 - next;
    paired.add(i);
    paired.add(bestJ);
    next++;
  }
  return vals;
})();

/* ── 30 edges ── */
const EDGE_PAIRS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = (() => {
  const set = new Set<string>();
  const pairs: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [];
  FACE_IDX.forEach(idx => {
    for (let i = 0; i < 3; i++) {
      const a = idx[i], b = idx[(i + 1) % 3];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!set.has(key)) {
        set.add(key);
        pairs.push([ALL_VERTS[a], ALL_VERTS[b]]);
      }
    }
  });
  return pairs;
})();

/* ── Target quaternions ── */
const TARGET_QUATS: Record<number, THREE.Quaternion> = {};
FACES.forEach((verts, fi) => {
  const normal = NORMALS[fi];
  const c = CENTROIDS[fi];
  const up = new THREE.Vector3(
    verts[0][0] - c.x, verts[0][1] - c.y, verts[0][2] - c.z,
  ).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, normal).transpose();
  TARGET_QUATS[FACE_VALUES[fi]] = new THREE.Quaternion().setFromRotationMatrix(m);
});

const EDGE_RADIUS = 0.025;
const SPIN_DURATION = 1.5;
const SETTLE_DURATION = 0.3;
const FLASH_DURATION = SETTLE_DURATION;
const camDir = new THREE.Vector3(0, 0, 1);

const MIN_Y = Math.min(...ALL_VERTS.map(v => v[1]));
const MAX_Y = Math.max(...ALL_VERTS.map(v => v[1]));

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

/* ── Geometry / texture builders ── */

function makeFaceGeo(verts: THREE.Vector3Tuple[], normal: THREE.Vector3): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([...verts[0], ...verts[1], ...verts[2]]);
  const norms = new Float32Array([
    normal.x, normal.y, normal.z,
    normal.x, normal.y, normal.z,
    normal.x, normal.y, normal.z,
  ]);
  const uvs = new Float32Array([0.5, 1.0, 0.0, 0.0, 1.0, 0.0]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function makeFaceTexture(label: string, primary: string): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, size, size);

  const textColor = contrastText(primary);
  ctx.fillStyle = textColor;
  ctx.font = `bold ${label.length > 1 ? 100 : 140}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, size / 2, size * 2 / 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeEdgeCylinder(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, radius: number, baseColor: THREE.Color): THREE.CylinderGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const height = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1);

  const tA = (a[1] - MIN_Y) / (MAX_Y - MIN_Y);
  const tB = (b[1] - MIN_Y) / (MAX_Y - MIN_Y);
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

export default function IcosahedronDie({ rollTrigger, onResult, primary }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const prevTrigger = useRef(rollTrigger);
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

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, 0.3)), [primary]);

  const faceMeshRefs = useRef<(THREE.Mesh | null)[]>(new Array(NUM_FACES).fill(null));
  const worldNormal = useRef(new THREE.Vector3());

  const faceData = useMemo(() =>
    FACES.map((verts, fi) => ({
      geometry: makeFaceGeo(verts, NORMALS[fi]),
      texture: makeFaceTexture(String(FACE_VALUES[fi]), primary),
    })),
    [primary],
  );

  const edges = useMemo(() =>
    EDGE_PAIRS.map(([a, b]) => ({
      geo: makeEdgeCylinder(a, b, EDGE_RADIUS, edgeBaseColor),
      ...edgeTransform(a, b),
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

    targetResult.current = Math.floor(Math.random() * NUM_FACES) + 1;
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

      const scalePunch = 1 + 0.15 * Math.sin(ft * Math.PI);
      groupRef.current.scale.setScalar(scalePunch);
    }

    for (let i = 0; i < NUM_FACES; i++) {
      const mesh = faceMeshRefs.current[i];
      if (!mesh) continue;
      worldNormal.current.copy(NORMALS[i]).applyQuaternion(groupRef.current.quaternion);
      const dot = worldNormal.current.dot(camDir);
      let brightness = 0.55 + 0.45 * Math.max(0, dot);
      if (flash > 0) {
        brightness = brightness + (2.0 - brightness) * flash * 0.6;
      }
      (mesh.material as THREE.MeshBasicMaterial).color.setScalar(brightness);
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
    <group ref={groupRef} position={[0, -0.15, 0]}>
      {faceData.map((face, i) => (
        <mesh key={i} ref={el => { faceMeshRefs.current[i] = el; }} geometry={face.geometry}>
          <meshBasicMaterial map={face.texture} />
        </mesh>
      ))}
      {edges.map((edge, i) => (
        <mesh key={`edge-${i}`} geometry={edge.geo} position={edge.pos} quaternion={edge.quat}>
          <meshBasicMaterial vertexColors />
        </mesh>
      ))}
      {ALL_VERTS.map((v, i) => (
        <mesh key={`corner-${i}`} geometry={sphereGeo} position={v}>
          <meshBasicMaterial color={edgeBaseColor} />
        </mesh>
      ))}
    </group>
  );
}
