import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useConvexPolyhedron } from '@react-three/cannon';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  D4_VERTICES,
  D4_FACES,
  D4_NORMALS,
  D4_FACE_RESULTS,
  D4_SCALE,
} from './d4Geometry';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
}

/* ---------- Geometry ---------- */

function makeTetraGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const norms: number[] = [];

  for (let fi = 0; fi < D4_FACES.length; fi++) {
    const [a, b, c] = D4_FACES[fi];
    const n = D4_NORMALS[fi];
    for (const idx of [a, b, c]) {
      verts.push(
        D4_VERTICES[idx][0] * D4_SCALE,
        D4_VERTICES[idx][1] * D4_SCALE,
        D4_VERTICES[idx][2] * D4_SCALE,
      );
      norms.push(n[0], n[1], n[2]);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  return geo;
}

function faceCentroid(faceIndex: number): THREE.Vector3 {
  const [a, b, c] = D4_FACES[faceIndex];
  return new THREE.Vector3(
    (D4_VERTICES[a][0] + D4_VERTICES[b][0] + D4_VERTICES[c][0]) / 3 * D4_SCALE,
    (D4_VERTICES[a][1] + D4_VERTICES[b][1] + D4_VERTICES[c][1]) / 3 * D4_SCALE,
    (D4_VERTICES[a][2] + D4_VERTICES[b][2] + D4_VERTICES[c][2]) / 3 * D4_SCALE,
  );
}

const tetraGeo = makeTetraGeometry();

/* ---------- Component ---------- */

export default function TetrahedronDie({ rollTrigger, onResult }: Props) {
  const settleFrames = useRef(0);
  const hasReported = useRef(false);
  const prevTrigger = useRef(rollTrigger);

  const [ref, api] = useConvexPolyhedron<THREE.Group>(() => ({
    mass: 1,
    args: [
      D4_VERTICES.map(v => [
        v[0] * D4_SCALE,
        v[1] * D4_SCALE,
        v[2] * D4_SCALE,
      ]) as [number, number, number][],
      D4_FACES as unknown as number[][],
      D4_NORMALS as unknown as [number, number, number][],
    ],
    position: [0, 3, 0],
    linearDamping: 0.18,
    angularDamping: 0.22,
    allowSleep: true,
    sleepSpeedLimit: 0.05,
    sleepTimeLimit: 0.4,
    material: {
      friction: 0.4,
      restitution: 0.3,
    },
  }));

  /* ---------- Physics state ---------- */

  const velocity = useRef([0, 0, 0]);
  const angularVelocity = useRef([0, 0, 0]);
  const quaternion = useRef([0, 0, 0, 1]);

  useEffect(() => {
    const unsubs = [
      api.velocity.subscribe(v => (velocity.current = v)),
      api.angularVelocity.subscribe(v => (angularVelocity.current = v)),
      api.quaternion.subscribe(q => (quaternion.current = q)),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [api]);

  /* ---------- Roll ---------- */

  useEffect(() => {
    if (rollTrigger === 0) return;
    if (rollTrigger === prevTrigger.current) return;
    prevTrigger.current = rollTrigger;

    hasReported.current = false;
    settleFrames.current = 0;

    const angle = Math.random() * Math.PI * 2;
    const dist = 1.2 + Math.random() * 1.2;

    api.position.set(
      Math.cos(angle) * dist,
      5.5,
      Math.sin(angle) * dist,
    );

    api.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    );

    api.velocity.set(
      -Math.cos(angle) * 3,
      3 + Math.random() * 2,
      -Math.sin(angle) * 3,
    );

    // Google-style: one asymmetric 3D impulse
    api.angularVelocity.set(
      (Math.random() * 2 - 1) * 35,
      (Math.random() * 2 - 1) * 55,
      (Math.random() * 2 - 1) * 45,
    );

    api.wakeUp();
  }, [rollTrigger, api]);

  /* ---------- Settle detection ---------- */

  useFrame(() => {
    if (hasReported.current || rollTrigger === 0) return;

    const v = velocity.current;
    const av = angularVelocity.current;

    const speed = Math.hypot(v[0], v[1], v[2]);
    const angSpeed = Math.hypot(av[0], av[1], av[2]);

    if (speed < 0.05 && angSpeed < 0.08) {
      settleFrames.current++;
    } else {
      settleFrames.current = 0;
    }

    if (settleFrames.current >= 20) {
      hasReported.current = true;

      const q = new THREE.Quaternion(...quaternion.current);
      const down = new THREE.Vector3(0, -1, 0);

      let bestFace = 0;
      let bestDot = -Infinity;

      for (let i = 0; i < D4_NORMALS.length; i++) {
        const n = new THREE.Vector3(...D4_NORMALS[i]).applyQuaternion(q);
        const d = n.dot(down);
        if (d > bestDot) {
          bestDot = d;
          bestFace = i;
        }
      }

      onResult(D4_FACE_RESULTS[bestFace]);
    }
  });

  /* ---------- Labels ---------- */

  const faceCentroids = D4_FACES.map((_, i) => faceCentroid(i));
  const faceNormals = D4_NORMALS.map(n => new THREE.Vector3(...n));

  return (
    <group ref={ref}>
      <mesh geometry={tetraGeo} castShadow>
        <meshStandardMaterial
          color="#43a047"
          flatShading
          metalness={0.15}
          roughness={0.4}
        />
      </mesh>

      {D4_FACES.map((_, fi) => {
        const center = faceCentroids[fi];
        const normal = faceNormals[fi];
        const pos = center.clone().add(normal.clone().multiplyScalar(0.02));
        const lookAt = pos.clone().add(normal);

        return (
          <Text
            key={fi}
            position={[pos.x, pos.y, pos.z]}
            fontSize={0.7}
            color="white"
            anchorX="center"
            anchorY="middle"
            onUpdate={self =>
              self.lookAt(lookAt.x, lookAt.y, lookAt.z)
            }
          >
            {D4_FACE_RESULTS[fi]}
          </Text>
        );
      })}
    </group>
  );
}