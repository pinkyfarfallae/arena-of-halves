import { useCallback, useState, type ReactNode } from 'react';

/**
 * Wraps React Three Fiber Canvas so it only mounts after the container is in the DOM.
 * Prevents "Cannot read properties of null (reading 'addEventListener')" when R3F
 * connects events before the container ref is set (e.g. lazy load, Strict Mode).
 */
export default function CanvasContainer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (el) setReady(true);
  }, []);

  return (
    <div ref={setContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {ready ? children : null}
    </div>
  );
}
