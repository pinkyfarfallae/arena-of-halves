import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { darken } from '../../../utils/color';
import { makeFaceTexture } from '../makeFaceTexture';
import { edgeTransform, makeEdgeCylinder } from '../dieGeometry';
import { rollFace } from '../diceRandom';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
  primary: string;
  primaryDark: string;
  fixedResult?: number;
}

/* ── Geometry ──
   Regular dodecahedron: 20 vertices, 12 pentagonal faces, 30 edges.
*/
const PHI = (1 + Math.sqrt(5)) / 2;
const IPHI = 1 / PHI;
const S = 0.9; // scale

const RAW: THREE.Vector3Tuple[] = [
  // 8 cube vertices
  [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
  [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1],
  // rectangle in YZ plane
  [0,  IPHI,  PHI], [0,  IPHI, -PHI], [0, -IPHI,  PHI], [0, -IPHI, -PHI],
  // rectangle in XY plane
  [ IPHI,  PHI, 0], [ IPHI, -PHI, 0], [-IPHI,  PHI, 0], [-IPHI, -PHI, 0],
  // rectangle in XZ plane
  [ PHI, 0,  IPHI], [ PHI, 0, -IPHI], [-PHI, 0,  IPHI], [-PHI, 0, -IPHI],
];

const ALL_VERTS: THREE.Vector3Tuple[] = RAW.map(
  v => [v[0] * S, v[1] * S, v[2] * S] as THREE.Vector3Tuple,
);

/* ── 12 pentagonal faces (CCW from outside) ── */
const FACE_IDX: number[][] = [
  [0, 8, 10, 2, 16],
  [0, 16, 17, 1, 12],
  [0, 12, 14, 4, 8],
  [1, 17, 3, 11, 9],
  [1, 9, 5, 14, 12],
  [2, 10, 6, 15, 13],
  [2, 13, 3, 17, 16],
  [3, 13, 15, 7, 11],
  [4, 14, 5, 19, 18],
  [4, 18, 6, 10, 8],
  [5, 9, 11, 7, 19],
  [6, 18, 19, 7, 15],
];

const FACES: THREE.Vector3Tuple[][] = FACE_IDX.map(
  idx => idx.map(i => ALL_VERTS[i]),
);

const NUM_FACES = 12;

function computeNormal(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): THREE.Vector3 {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const vc = new THREE.Vector3(...c);
  const e1 = new THREE.Vector3().subVectors(vb, va);
  const e2 = new THREE.Vector3().subVectors(vc, va);
  return e1.cross(e2).normalize();
}

const NORMALS = FACES.map(f => computeNormal(f[0], f[1], f[2]));

const CENTROIDS = FACES.map(verts => {
  const x = verts.reduce((s, v) => s + v[0], 0) / 5;
  const y = verts.reduce((s, v) => s + v[1], 0) / 5;
  const z = verts.reduce((s, v) => s + v[2], 0) / 5;
  return new THREE.Vector3(x, y, z);
});

/* ── Face values: opposite faces sum to 13 ── */
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
    vals[bestJ] = 13 - next;
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
    for (let i = 0; i < 5; i++) {
      const a = idx[i], b = idx[(i + 1) % 5];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (!set.has(key)) {
        set.add(key);
        pairs.push([ALL_VERTS[a], ALL_VERTS[b]]);
      }
    }
  });
  return pairs;
})();

/* ── Pentagon UV coordinates ── */
const PENT_R = 0.45;
const PENT_UVS: [number, number][] = Array.from({ length: 5 }, (_, i) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
  return [0.5 + PENT_R * Math.cos(angle), 0.5 + PENT_R * Math.sin(angle)];
});
const CENTER_UV: [number, number] = [0.5, 0.5];

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

const EDGE_RADIUS = 0.03;
const SPIN_DURATION = 1.5;
const SETTLE_DURATION = 0.3;
const FLASH_DURATION = SETTLE_DURATION;
const camDir = new THREE.Vector3(0, 0, 1);

const MIN_Y = Math.min(...ALL_VERTS.map(v => v[1]));
const MAX_Y = Math.max(...ALL_VERTS.map(v => v[1]));

/* ── Geometry / texture builders ── */

function makeFaceGeo(verts: THREE.Vector3Tuple[], normal: THREE.Vector3): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const cx = verts.reduce((s, v) => s + v[0], 0) / 5;
  const cy = verts.reduce((s, v) => s + v[1], 0) / 5;
  const cz = verts.reduce((s, v) => s + v[2], 0) / 5;

  // Fan from centroid: 5 triangles
  const positions: number[] = [];
  const norms: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    positions.push(cx, cy, cz, ...verts[i], ...verts[j]);
    norms.push(
      normal.x, normal.y, normal.z,
      normal.x, normal.y, normal.z,
      normal.x, normal.y, normal.z,
    );
    uvs.push(...CENTER_UV, ...PENT_UVS[i], ...PENT_UVS[j]);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(norms), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  return geo;
}

/* ── Component ── */

export default function DodecahedronDie({ rollTrigger, onResult, primary, fixedResult }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const prevTrigger = useRef(0);
  const hasReported = useRef(false);
  const fixedResultRef = useRef(fixedResult);
  fixedResultRef.current = fixedResult;

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

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, 0.1)), [primary]);

  const faceMeshRefs = useRef<(THREE.Mesh | null)[]>(new Array(NUM_FACES).fill(null));
  const worldNormal = useRef(new THREE.Vector3());

  const faceData = useMemo(() =>
    FACES.map((verts, fi) => ({
      geometry: makeFaceGeo(verts, NORMALS[fi]),
      texture: makeFaceTexture({ label: String(FACE_VALUES[fi]), primary, fontSize: (lbl) => lbl.length > 1 ? 100 : 130, transform: (ctx, sz) => { ctx.translate(sz / 2, sz / 2); ctx.scale(-1, -1); } }),
    })),
    [primary],
  );

  const edges = useMemo(() =>
    EDGE_PAIRS.map(([a, b]) => ({
      geo: makeEdgeCylinder(a, b, EDGE_RADIUS, edgeBaseColor, { minY: MIN_Y, maxY: MAX_Y }),
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

    // If fixedResult will be set later (e.g. viewer waiting for server), useFrame applies it — do not list fixedResult in deps or prop sync re-triggers a full spin.
    const raw = fixedResultRef.current ?? (rollFace(NUM_FACES) + 1);
    targetResult.current = (typeof raw === 'number' && raw >= 1 && raw <= 12) ? raw : 0;
    if (targetResult.current > 0) {
      const quat = TARGET_QUATS[targetResult.current];
      if (quat) targetQuat.current.copy(quat);
    }
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

    for (let i = 0; i < NUM_FACES; i++) {
      const mesh = faceMeshRefs.current[i];
      if (!mesh || !NORMALS[i]) continue;
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
      // Set initial orientation to a random quat so we never show a single wrong face on the first frame (avoids jitter)
      groupRef.current.quaternion.setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * Math.PI * 2,
          (Math.random() - 0.5) * Math.PI * 2,
          (Math.random() - 0.5) * Math.PI * 2,
        ),
      );
      spinStart.current = performance.now() / 1000;
      settleStart.current = 0;
    }

    const elapsed = performance.now() / 1000 - spinStart.current;

    if (elapsed < SPIN_DURATION) {
      const progress = elapsed / SPIN_DURATION;
      const decay = Math.pow(1 - progress, 1.5);
      groupRef.current.rotateOnAxis(spinAxis.current, spinSpeed.current * decay * delta);
    } else {
      // Waiting for fixedResult (e.g. viewer): keep spinning until result arrives
      const fr = fixedResultRef.current;
      if (targetResult.current === 0 && typeof fr === 'number' && fr >= 1 && fr <= 12) {
        targetResult.current = fr;
        const quat = TARGET_QUATS[fr];
        if (quat) targetQuat.current.copy(quat);
      }
      if (targetResult.current === 0) {
        groupRef.current.rotateOnAxis(spinAxis.current, spinSpeed.current * 0.1 * delta);
        return;
      }
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
