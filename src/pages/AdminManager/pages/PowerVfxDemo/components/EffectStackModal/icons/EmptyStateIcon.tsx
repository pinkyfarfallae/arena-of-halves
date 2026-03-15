interface Props {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export default function EmptyStateIcon({
  className,
  width = 32,
  height = 32,
}: Props) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="4"
        y="6"
        width="24"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M8 14h16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 18h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
