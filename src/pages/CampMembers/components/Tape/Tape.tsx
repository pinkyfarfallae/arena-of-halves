import './Tape.scss';

function Tape({ side, color }: { side: 'l' | 'r' | 'c'; color: string }) {
  return (
    <div className={`camp__tape camp__tape--${side}`}>
      <svg viewBox="0 0 70 20" fill="none" preserveAspectRatio="none">
        <rect x="0" y="2" width="70" height="16" rx="1" fill={`color-mix(in srgb, ${color} 35%, #d2c39b)`} />
        <rect x="0" y="2" width="70" height="16" rx="1" fill="rgba(255,255,255,0.18)" />
      </svg>
    </div>
  );
}

export default Tape;
