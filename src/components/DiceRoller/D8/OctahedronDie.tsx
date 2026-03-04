import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { darken } from '../../../utils/color';
import { makeFaceTexture } from '../makeFaceTexture';
import { edgeTransform, makeEdgeCylinder, makeTriangleFaceGeo } from '../dieGeometry';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
  primary: string;
  primaryDark: string;
}

const S = 1.4;

/* ── Vertices ── */
const TOP: THREE.Vector3Tuple = [0, S, 0];
const BOT: THREE.Vector3Tuple = [0, -S, 0];
const RGT: THREE.Vector3Tuple = [S, 0, 0];
const LFT: THREE.Vector3Tuple = [-S, 0, 0];
const FRT: THREE.Vector3Tuple = [0, 0, S];
const BCK: THREE.Vector3Tuple = [0, 0, -S];

const ALL_VERTS: THREE.Vector3Tuple[] = [TOP, BOT, RGT, LFT, FRT, BCK];

/* ── 8 faces (CCW from outside) — opposite faces sum to 9 ── */
const FACES: THREE.Vector3Tuple[][] = [
  [TOP, FRT, RGT],  // 0: value 1
  [TOP, LFT, FRT],  // 1: value 2
  [TOP, RGT, BCK],  // 2: value 3
  [TOP, BCK, LFT],  // 3: value 4
  [BOT, RGT, FRT],  // 4: value 5
  [BOT, FRT, LFT],  // 5: value 6
  [BOT, BCK, RGT],  // 6: value 7
  [BOT, LFT, BCK],  // 7: value 8
];

const FACE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];

function computeNormal(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): THREE.Vector3 {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const vc = new THREE.Vector3(...c);
  return vb.sub(va).cross(vc.sub(new THREE.Vector3(...a))).normalize();
}

const NORMALS = FACES.map(f => computeNormal(f[0], f[1], f[2]));

/* ── 12 edges ── */
const EDGE_PAIRS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [TOP, RGT], [TOP, LFT], [TOP, FRT], [TOP, BCK],
  [BOT, RGT], [BOT, LFT], [BOT, FRT], [BOT, BCK],
  [RGT, FRT], [FRT, LFT], [LFT, BCK], [BCK, RGT],
];

/**
 * Target quaternions with full basis so numbers settle upright.
 * Build rotation from {right, up, normal} → {+X, +Y, +Z}.
 */
const TARGET_QUATS: Record<number, THREE.Quaternion> = {};
FACES.forEach((verts, fi) => {
  const normal = NORMALS[fi];
  const cx = (verts[0][0] + verts[1][0] + verts[2][0]) / 3;
  const cy = (verts[0][1] + verts[1][1] + verts[2][1]) / 3;
  const cz = (verts[0][2] + verts[1][2] + verts[2][2]) / 3;
  const up = new THREE.Vector3(
    verts[0][0] - cx, verts[0][1] - cy, verts[0][2] - cz,
  ).normalize();
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, normal).transpose();
  TARGET_QUATS[FACE_VALUES[fi]] = new THREE.Quaternion().setFromRotationMatrix(m);
});

const EDGE_RADIUS = 0.035;
const SPIN_DURATION = 1.5;
const SETTLE_DURATION = 0.3;
const FLASH_DURATION = SETTLE_DURATION;
const camDir = new THREE.Vector3(0, 0, 1);

const MIN_Y = Math.min(...ALL_VERTS.map(v => v[1]));
const MAX_Y = Math.max(...ALL_VERTS.map(v => v[1]));

/* ── Component ── */

export default function OctahedronDie({ rollTrigger, onResult, primary, primaryDark }: Props) {
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

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, 0.02)), [primary]);

  const faceMeshRefs = useRef<(THREE.Mesh | null)[]>(new Array(8).fill(null));
  const worldNormal = useRef(new THREE.Vector3());

  const faceData = useMemo(() =>
    FACES.map((verts, fi) => ({
      geometry: makeTriangleFaceGeo(verts, NORMALS[fi]),
      texture: makeFaceTexture({ label: String(FACE_VALUES[fi]), primary }),
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

    targetResult.current = Math.floor(Math.random() * 8) + 1;
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

    for (let i = 0; i < 8; i++) {
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
