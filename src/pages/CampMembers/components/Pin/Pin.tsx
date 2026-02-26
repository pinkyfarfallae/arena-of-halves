import './Pin.scss';

function Pin({ color }: { color: string }) {
  return (
    <svg className="camp__pin" viewBox="0 0 28 36" fill="none">
      <ellipse cx="14" cy="28" rx="5" ry="1.5" fill="rgba(0,0,0,0.12)" />
      <path d="M14 18v10" stroke="#888" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="11" r="8" fill={color} />
      <circle cx="14" cy="11" r="5.5" fill={`color-mix(in srgb, ${color} 65%, #fff)`} />
      <ellipse cx="12" cy="9" rx="2.5" ry="1.8" fill={`color-mix(in srgb, ${color} 30%, #fff)`} opacity="0.8" />
    </svg>
  );
}

export default Pin;
