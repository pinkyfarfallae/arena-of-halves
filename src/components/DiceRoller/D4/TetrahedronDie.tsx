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

const FACE_RESULTS = [1, 2, 3, 4];

/*
 * Regular tetrahedron with front face normal = +Z (facing camera).
 * v0 = top of front face
 * v1 = bottom-left of front face
 * v2 = bottom-right of front face
 * v3 = apex behind
 */
const S = 1.3;
const rt3 = Math.sqrt(3);
const rt6 = Math.sqrt(6);

const V0: THREE.Vector3Tuple = [0, S * 2 / rt3, S * rt6 / 6];
const V1: THREE.Vector3Tuple = [-S, -S / rt3, S * rt6 / 6];
const V2: THREE.Vector3Tuple = [S, -S / rt3, S * rt6 / 6];
const V3: THREE.Vector3Tuple = [0, 0, -S * rt6 / 2];

// Faces: [vertices] — CCW winding from outside
const FACES: THREE.Vector3Tuple[][] = [
  [V0, V1, V2], // front  (normal ≈ +Z)
  [V0, V3, V1], // left   (normal ≈ -X)
  [V0, V2, V3], // right  (normal ≈ +X)
  [V1, V3, V2], // bottom (normal ≈ -Y/-Z)
];

/** Compute flat face normal from 3 vertices */
function computeNormal(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): THREE.Vector3 {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const vc = new THREE.Vector3(...c);
  return vb.sub(va).cross(vc.sub(new THREE.Vector3(...a))).normalize();
}

const NORMALS = FACES.map(f => computeNormal(f[0], f[1], f[2]));

/** Parse hex/rgb to [r,g,b] 0-255 */
function parseColor(color: string): [number, number, number] {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  const h = color.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (0 = black, 1 = white) */
function luminance(color: string): number {
  const [r, g, b] = parseColor(color).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pick best contrasting text color for a given background */
function contrastText(bg: string): string {
  const lum = luminance(bg);
  if (lum > 0.85) return bg;
  return lum > 0.4 ? '#000000' : '#ffffff';
}

/** Flat primary face with number baked in */
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

/** Darken a color by mixing toward black */
function darken(color: string, ratio: number): string {
  const [r, g, b] = parseColor(color);
  const m = (c: number) => Math.round(c * (1 - ratio));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/** Vertex Y range for gradient mapping */
const ALL_VERTS = [V0, V1, V2, V3];
const MIN_Y = Math.min(...ALL_VERTS.map(v => v[1]));
const MAX_Y = Math.max(...ALL_VERTS.map(v => v[1]));

/** Build a cylinder mesh between two points with vertex-color gradient */
function makeEdgeCylinder(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, radius: number, baseColor: THREE.Color): THREE.CylinderGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const height = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radius, radius, height, 8, 1);

  // Brightness at each endpoint based on world Y (higher = brighter)
  const tA = (a[1] - MIN_Y) / (MAX_Y - MIN_Y); // 0..1
  const tB = (b[1] - MIN_Y) / (MAX_Y - MIN_Y);
  // Cylinder local Y: -height/2 = point A, +height/2 = point B (after transform)
  const positions = geo.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const along = (y + height / 2) / height; // 0 at bottom (A), 1 at top (B)
    const tint = 0.9 + 0.45 * (tA + (tB - tA) * along); // 0.55–1.0
    colors[i * 3] = baseColor.r * tint;
    colors[i * 3 + 1] = baseColor.g * tint;
    colors[i * 3 + 2] = baseColor.b * tint;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Compute position + quaternion to place a cylinder between two points */
function edgeTransform(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return { pos: mid, quat };
}

const EDGE_RADIUS = 0.035;
const EDGE_PAIRS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [V0, V1], [V0, V2], [V0, V3], [V1, V2], [V1, V3], [V2, V3],
];

/** Build a single-triangle geometry with UVs */
function makeFaceGeo(verts: THREE.Vector3Tuple[], normal: THREE.Vector3): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    ...verts[0], ...verts[1], ...verts[2],
  ]);
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

/**
 * Precompute target quaternion for each face.
 * Build rotation from orthonormal basis: {right, up, normal} → {+X, +Y, +Z}
 */
const TARGET_QUATS = FACES.map((verts, fi) => {
  const normal = NORMALS[fi];
  const cx = (verts[0][0] + verts[1][0] + verts[2][0]) / 3;
  const cy = (verts[0][1] + verts[1][1] + verts[2][1]) / 3;
  const cz = (verts[0][2] + verts[1][2] + verts[2][2]) / 3;
  const up = new THREE.Vector3(
    verts[0][0] - cx, verts[0][1] - cy, verts[0][2] - cz,
  ).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, normal).transpose();
  return new THREE.Quaternion().setFromRotationMatrix(m);
});

export default function TetrahedronDie({ rollTrigger, onResult, primary, primaryDark, fixedResult }: Props) {
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

  const SPIN_DURATION = 1.5;
  const SETTLE_DURATION = 0.3;
  const FLASH_DURATION = SETTLE_DURATION;

  const flashing = useRef(false);
  const flashStart = useRef(0);

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, 0.1)), [primary]);

  const faceMeshRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const worldNormal = useRef(new THREE.Vector3());
  const camDir = new THREE.Vector3(0, 0, 1);

  const faceData = useMemo(() =>
    FACES.map((verts, fi) => ({
      geometry: makeFaceGeo(verts, NORMALS[fi]),
      texture: makeFaceTexture(FACE_RESULTS[fi], primary),
    })),
    [primary]);

  const edges = useMemo(() =>
    EDGE_PAIRS.map(([a, b]) => ({
      geo: makeEdgeCylinder(a, b, EDGE_RADIUS, edgeBaseColor),
      ...edgeTransform(a, b),
    })),
    [edgeBaseColor]);

  // Roll trigger
  useEffect(() => {
    if (rollTrigger === 0) return;
    if (rollTrigger === prevTrigger.current) return;
    prevTrigger.current = rollTrigger;

    hasReported.current = false;
    spinning.current = true;
    spinStart.current = 0;

    // Random axis with balanced components for varied tumble
    const sx = Math.random() < 0.5 ? -1 : 1;
    const sy = Math.random() < 0.5 ? -1 : 1;
    const sz = Math.random() < 0.5 ? -1 : 1;

    spinAxis.current
      .set(
        sx * (0.5 + Math.random() * 0.5),
        sy * (0.5 + Math.random() * 0.5),
        sz * (0.5 + Math.random() * 0.5)
      )
      .normalize();

    spinSpeed.current = 14 + Math.random() * 4;

    targetResult.current = fixedResult ?? (Math.floor(Math.random() * 4) + 1);
    const faceIndex = FACE_RESULTS.indexOf(targetResult.current);
    targetQuat.current.copy(TARGET_QUATS[faceIndex]);
  }, [rollTrigger]);

  // Tint faces: front-facing = true color, others darken + flash & scale punch
  const tintFaces = () => {
    if (!groupRef.current) return;

    // Flash decay: 1 → 0 over FLASH_DURATION
    let flash = 0;
    if (flashing.current && flashStart.current > 0) {
      const flashElapsed = performance.now() / 1000 - flashStart.current;
      const ft = Math.min(flashElapsed / FLASH_DURATION, 1);
      flash = 1 - ft;
      if (ft >= 1) flashing.current = false;

      // Scale punch: 1 → 1.15 → 1 (quick pop out then back)
      const scalePunch = 1 + 0.08 * Math.sin(ft * Math.PI);
      groupRef.current.scale.setScalar(scalePunch);
    }

    for (let i = 0; i < 4; i++) {
      const mesh = faceMeshRefs.current[i];
      if (!mesh) continue;
      worldNormal.current.copy(NORMALS[i]).applyQuaternion(groupRef.current.quaternion);
      const dot = worldNormal.current.dot(camDir);
      let brightness = 0.35 + 0.9 * Math.max(0, dot);
      // Flash: all faces wash toward white then fade back
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
    <group ref={groupRef} position={[0, -0.35, 0]}>
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
    </group>
  );
}
