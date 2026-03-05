interface Props {
  className?: string;
  unlocked: boolean;
}

export default function SkillOrb({ className, unlocked }: Props) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg className={className} viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={radius} className="mchip__so-track" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        className="mchip__so-arc"
        strokeDasharray={circumference}
        strokeDashoffset={unlocked ? 0 : circumference}
      />
    </svg>
  );
}
