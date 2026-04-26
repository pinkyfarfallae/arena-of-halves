import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { darken } from '../../../utils/color';
import { makeFaceTexture } from '../makeFaceTexture';
import { edgeTransform, makeEdgeCylinder, makeTriangleFaceGeo } from '../dieGeometry';
import { rollFace } from '../diceRandom';

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

/** Vertex Y range for gradient mapping */
const ALL_VERTS = [V0, V1, V2, V3];
const MIN_Y = Math.min(...ALL_VERTS.map(v => v[1]));
const MAX_Y = Math.max(...ALL_VERTS.map(v => v[1]));

const EDGE_RADIUS = 0.035;
const EDGE_PAIRS: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [V0, V1], [V0, V2], [V0, V3], [V1, V2], [V1, V3], [V2, V3],
];

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
      geometry: makeTriangleFaceGeo(verts, NORMALS[fi]),
      texture: makeFaceTexture({ label: String(FACE_RESULTS[fi]), primary }),
    })),
    [primary]);

  const edges = useMemo(() =>
    EDGE_PAIRS.map(([a, b]) => ({
      geo: makeEdgeCylinder(a, b, EDGE_RADIUS, edgeBaseColor, { minY: MIN_Y, maxY: MAX_Y, tintBase: 0.9 }),
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

    targetResult.current = fixedResultRef.current ?? (rollFace(4) + 1);
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
