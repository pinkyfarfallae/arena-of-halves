import { useEffect, useRef, useState } from 'react';

interface FlatSpinState {
  rotation: { x: number; y: number; z: number };
  result: number | null;
  faceNums: number[];
  landed: boolean;
  spinCount: number;
}

/**
 * Shared rolling logic for CSS flat-spin dice (everything except d6).
 * Returns rotation/result/faceNums state + the spinCount for transition control.
 */
export default function useFlatSpin(
  max: number,
  rolling: boolean,
  onResult: (n: number) => void,
  onRollEnd: () => void,
): FlatSpinState {
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [result, setResult] = useState<number | null>(null);
  const [faceNums, setFaceNums] = useState<number[]>([0, 0, 0, 0, 0]);
  const [landed, setLanded] = useState(false);
  const spinCountRef = useRef(0);
  const [spinCount, setSpinCount] = useState(0);
  const prevRolling = useRef(false);

  useEffect(() => {
    if (rolling && !prevRolling.current) {
      prevRolling.current = true;
      spinCountRef.current++;
      setSpinCount(spinCountRef.current);

      const finalResult = Math.floor(Math.random() * max) + 1;
      setFaceNums(Array.from({ length: 5 }, () => Math.floor(Math.random() * max) + 1));
      setResult(null);

      const extraZ = (1 + Math.floor(Math.random() * 3)) * 360;
      const dirZ = Math.random() > 0.5 ? 1 : -1;
      setRotation({ x: 0, y: 0, z: dirZ * extraZ });

      const t1 = setTimeout(() => {
        setResult(finalResult);
        onResult(finalResult);
      }, 1500);
      const t2 = setTimeout(() => {
        setLanded(true);
        onRollEnd();
        setTimeout(() => setLanded(false), 500);
      }, 2000);

      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!rolling) prevRolling.current = false;
  }, [rolling, max, onResult, onRollEnd]);

  return { rotation, result, faceNums, landed, spinCount };
}
