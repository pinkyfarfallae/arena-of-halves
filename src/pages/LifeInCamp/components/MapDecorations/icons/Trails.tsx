import type { SVGProps } from 'react';

export default function Trails(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 1000 625" preserveAspectRatio="none" {...props}>
      <path d="M500 81 C480 110, 460 145, 450 175" />
      <path d="M450 175 C410 195, 350 220, 300 250" />
      <path d="M300 250 C260 240, 220 220, 180 200" />
      <path d="M450 175 C520 160, 600 140, 700 125" />
      <path d="M450 175 C480 200, 520 230, 550 263" />
      <path d="M550 263 C510 285, 450 310, 400 338" />
      <path d="M550 263 C620 275, 680 290, 750 313" />
      <path d="M750 313 C780 280, 810 250, 850 213" />
      <path d="M750 313 C800 325, 860 340, 900 363" />
      <path d="M750 313 C730 350, 710 390, 680 425" />
      <path d="M680 425 C720 430, 770 440, 820 450" />
      <path d="M400 338 C390 370, 370 420, 350 469" />
      <path d="M350 469 C400 490, 460 520, 520 550" />
      <path d="M350 469 C310 460, 270 450, 220 438" />
      <path d="M220 438 C185 410, 150 380, 120 344" />
      <path d="M220 438 C175 465, 130 500, 80 531" />
    </svg>
  );
}
