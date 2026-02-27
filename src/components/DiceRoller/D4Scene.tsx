import { Canvas } from '@react-three/fiber';
import { Physics, usePlane } from '@react-three/cannon';
import * as THREE from 'three';
import TetrahedronDie from './TetrahedronDie';

interface Props {
  rollTrigger: number;
  onResult: (result: number) => void;
  onClick: () => void;
}

/** Ground plane with subtle shadow */
function Ground() {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 0.5, restitution: 0.35 },
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <shadowMaterial transparent opacity={0.2} />
    </mesh>
  );
}

/** Invisible wall */
function Wall({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    position,
    rotation,
    material: { friction: 0.2, restitution: 0.5 },
  }));
  return <mesh ref={ref} visible={false}><planeGeometry args={[20, 20]} /></mesh>;
}

export default function D4Scene({ rollTrigger, onResult, onClick }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 6], fov: 40 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent', cursor: 'pointer' }}
      onClick={onClick}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 12, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-3, 5, -2]} intensity={0.3} />

      <Physics
        gravity={[0, -22, 0]}
        defaultContactMaterial={{ friction: 0.5, restitution: 0.35 }}
      >
        <Ground />
        {/* Invisible walls to keep the die in view */}
        <Wall position={[0, 5, -4]} rotation={[0, 0, 0]} />
        <Wall position={[0, 5, 4]} rotation={[0, Math.PI, 0]} />
        <Wall position={[-4, 5, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Wall position={[4, 5, 0]} rotation={[0, -Math.PI / 2, 0]} />

        <TetrahedronDie rollTrigger={rollTrigger} onResult={onResult} />
      </Physics>
    </Canvas>
  );
}
