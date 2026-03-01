import { Canvas } from '@react-three/fiber';
import ZocchihedronDie from './ZocchihedronDie';

interface Props {
  rollTrigger: number;
  onResult: (faceValue: number) => void;
  onClick: () => void;
  primary: string;
  primaryDark: string;
  fixedResult?: number;
}

export default function D100Scene({ rollTrigger, onResult, onClick, primary, primaryDark, fixedResult }: Props) {
  return (
    <Canvas
      flat
      camera={{ position: [0, 0, 5.5], fov: 40 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent', cursor: 'pointer' }}
      onClick={onClick}
    >
      <ambientLight intensity={0.55} color="#ffffff" />
      <directionalLight position={[0, 0, 5]} intensity={0.45} color="#ffffff" />
      <directionalLight position={[3, 5, 5]} intensity={0.15} color="#ffffff" />
      <ZocchihedronDie
        rollTrigger={rollTrigger}
        onResult={onResult}
        primary={primary}
        primaryDark={primaryDark}
        fixedResult={fixedResult}
      />
    </Canvas>
  );
}
