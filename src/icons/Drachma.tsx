/* Ancient Greek drachma coin icon */
export default function Drachma({ className, width = 24, height = 24 }: { className?: string, width?: number, height?: number }) {
  return (
    <svg className={`drachma ${className ?? ''}`} viewBox="0 0 24 24" fill="none" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1" />
      <path d="M12 5.5v13M8.5 7.5l7 9M15.5 7.5l-7 9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
