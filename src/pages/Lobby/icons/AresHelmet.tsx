import type { SVGProps } from 'react';

export default function AresHelmet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      {/* Helmet dome */}
      <path d="M12 2C7.5 2 4 5.5 4 10v2c0 .5.1 1 .3 1.4L5 15h2l.5-2H8v4.5c0 .8.3 1.5.8 2L10 21h4l1.2-1.5c.5-.5.8-1.2.8-2V13h.5l.5 2h2l.7-1.6c.2-.4.3-.9.3-1.4v-2c0-4.5-3.5-8-8-8z" />
      {/* Eye slit */}
      <path d="M8 10h8v1.5H8z" fill="var(--helmet-slit, #fff)" />
      {/* Crest */}
      <path d="M12 2c-.5 0-1 .4-1 1v5h2V3c0-.6-.5-1-1-1z" />
    </svg>
  );
}
