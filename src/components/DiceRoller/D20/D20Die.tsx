import type { DieRendererProps } from '../types';
import useFlatSpin from '../useFlatSpin';
import CubeShell from '../CubeShell';
import FaceNumber from '../FaceNumber';

export default function D20Die({ rolling, onResult, onRollEnd, onClick }: DieRendererProps) {
  const { rotation, result, faceNums, landed, spinCount } = useFlatSpin(20, rolling, onResult, onRollEnd);

  return (
    <CubeShell die={20} rolling={rolling} landed={landed} rotation={rotation} spinCount={spinCount} onClick={onClick}>
      <div className="dr__face dr__face--front">
        <FaceNumber value={result ?? '\u2014'} label="d20" />
      </div>
      <div className="dr__face dr__face--back">
        <FaceNumber value={faceNums[0] || '\u00B7'} />
      </div>
      <div className="dr__face dr__face--right">
        <FaceNumber value={faceNums[1] || '\u00B7'} />
      </div>
      <div className="dr__face dr__face--left">
        <FaceNumber value={faceNums[2] || '\u00B7'} />
      </div>
      <div className="dr__face dr__face--top">
        <FaceNumber value={faceNums[3] || '\u00B7'} />
      </div>
      <div className="dr__face dr__face--bottom">
        <FaceNumber value={faceNums[4] || '\u00B7'} />
      </div>
    </CubeShell>
  );
}
