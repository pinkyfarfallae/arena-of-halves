import { Canvas } from '@react-three/fiber';
import CanvasContainer from '../CanvasContainer';
import ZocchihedronDie from './ZocchihedronDie';
import { isTrustedDomEvent } from '../../../utils/trustedEvent';

interface Props {
  rollTrigger: number;
  onResult: (faceValue: number) => void;
  onClick: (event: any) => void;
  primary: string;
  primaryDark: string;
  fixedResult?: number;
}

export default function D100Scene({ rollTrigger, onResult, onClick, primary, primaryDark, fixedResult }: Props) {
  return (
    <CanvasContainer>
      <Canvas
        flat
        camera={{ position: [0, 0, 5.5], fov: 40 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent', cursor: 'pointer' }}
        onClick={(event) => {
          if (!isTrustedDomEvent(event)) return;
          onClick(event);
        }}
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
    </CanvasContainer>
  );
}
