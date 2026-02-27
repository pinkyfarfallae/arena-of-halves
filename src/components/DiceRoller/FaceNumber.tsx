export default function FaceNumber({ value, label }: { value: number | string; label?: string }) {
  return (
    <div className="dr__face-num">
      <span>{value}</span>
      {label && <span className="dr__face-label">{label}</span>}
    </div>
  );
}
