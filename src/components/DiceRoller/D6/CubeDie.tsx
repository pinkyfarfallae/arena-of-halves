import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { darken } from '../../../utils/color';
import { makeFaceTexture } from '../makeFaceTexture';
import { edgeTransform, makeEdgeCylinder } from '../dieGeometry';

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

/* ── Component ── */

export default function CubeDie({ rollTrigger, onResult, primary, primaryDark, fixedResult }: Props) {
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

  const edgeBaseColor = useMemo(() => new THREE.Color(darken(primary, -0.35)), [primary]);
  const worldNormal = useRef(new THREE.Vector3());

  const geometry = useMemo(() => new THREE.BoxGeometry(S * 2, S * 2, S * 2), []);

  const materials = useMemo(() =>
    FACE_VALUES.map(v => new THREE.MeshBasicMaterial({ map: makeFaceTexture({ label: String(v), primary, fontSize: 180, yPosition: (sz) => sz / 2 }) })),
    [primary],
  );

  const edges = useMemo(() =>
    EDGE_INDICES.map(([ai, bi]) => ({
      geo: makeEdgeCylinder(VERTS[ai], VERTS[bi], EDGE_RADIUS, edgeBaseColor, { minY: -S, maxY: S }),
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

    targetResult.current = fixedResultRef.current ?? (Math.floor(Math.random() * 6) + 1);
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
