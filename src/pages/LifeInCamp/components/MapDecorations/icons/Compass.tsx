import type { SVGProps } from 'react';

export default function Compass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="50" cy="50" r="46" stroke="#8B7355" strokeWidth="1.5" opacity="0.3" />
      <circle cx="50" cy="50" r="43" stroke="#8B7355" strokeWidth="0.5" opacity="0.2" />
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i * 360) / 32 - 90;
        const rad = (angle * Math.PI) / 180;
        const major = i % 8 === 0;
        const minor = i % 4 === 0;
        const r1 = major ? 38 : minor ? 40 : 41.5;
        const r2 = 43;
        return (
          <line
            key={`tick-${i}`}
            x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)}
            x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)}
            stroke="#8B7355" strokeWidth={major ? 1.2 : 0.6} opacity={major ? 0.5 : minor ? 0.3 : 0.15}
          />
        );
      })}
      <circle cx="50" cy="50" r="36" stroke="#8B7355" strokeWidth="0.8" opacity="0.2" />
      <polygon points="50,12 53,44 50,50 47,44" fill="#C4463A" opacity="0.85" />
      <polygon points="50,88 47,56 50,50 53,56" fill="#8B7355" opacity="0.35" />
      <polygon points="88,50 56,47 50,50 56,53" fill="#8B7355" opacity="0.35" />
      <polygon points="12,50 44,53 50,50 44,47" fill="#8B7355" opacity="0.35" />
      <polygon points="76,24 55,45 50,50 45,55" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
      <polygon points="24,24 45,45 50,50 55,55" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
      <polygon points="76,76 55,55 50,50 45,45" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
      <polygon points="24,76 45,55 50,50 55,45" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
      <path d="M50 12L53 44 50 50 47 44Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.6" />
      <path d="M50 88L47 56 50 50 53 56Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
      <path d="M88 50L56 47 50 50 56 53Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
      <path d="M12 50L44 53 50 50 44 47Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
      <circle cx="50" cy="50" r="4" fill="#8B7355" opacity="0.25" />
      <circle cx="50" cy="50" r="2" fill="#C4463A" opacity="0.6" />
      <text x="50" y="9" textAnchor="middle" fontSize="8" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#C4463A" opacity="0.9">N</text>
      <text x="50" y="98" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">S</text>
      <text x="96" y="53" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">E</text>
      <text x="4" y="53" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">W</text>
    </svg>
  );
}
