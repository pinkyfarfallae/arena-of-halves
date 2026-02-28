import type { ReactNode } from 'react';

interface Props {
  die: number;
  rolling: boolean;
  landed: boolean;
  rotation: { x: number; y: number; z: number };
  spinCount: number;
  onClick: () => void;
  children: ReactNode;
}

/** Shared wrapper: cube-scene (throw animation) + cube (3D transform) */
export default function CubeShell({ die, rolling, landed, rotation, spinCount, onClick, children }: Props) {
  return (
    <div
      className={`dr__cube-scene${rolling ? ' dr__cube-scene--rolling' : ''}${landed ? ' dr__cube-scene--landed' : ''}`}
      onClick={onClick}
    >
      <div
        className="dr__cube"
        data-die={die}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
          transition: spinCount === 0
            ? 'none'
            : 'transform 2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
