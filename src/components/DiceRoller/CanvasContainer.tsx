import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Wraps React Three Fiber Canvas so it only mounts after the container is in the DOM
 * and the browser has had a frame to attach layout (R3F connect() expects a real target
 * for pointer events — React 19 Strict Mode + lazy dice scenes can otherwise hit
 * "Cannot read properties of null (reading 'addEventListener')").
 */
export default function CanvasContainer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        if (containerRef.current !== el || !el.isConnected) return;
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      setReady(false);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {ready ? children : null}
    </div>
  );
}
