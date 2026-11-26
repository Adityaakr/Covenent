/* Phosphor icons (regular weight), the set the Framer template uses (set omX0gWFPqDwhaiWwf6ab, stroke 1.5 at 24px).
 * Framer IconNodes cannot be exported with tree.toSVG, so the same named icons come from @phosphor-icons/core 2.1.1
 * assets/regular (MIT). Colour is currentColor; size follows the Framer node (14, 16 or 20px). */
type P = { size?: number; className?: string };

function Ph({ d, size, className }: { d: string; size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* Arrow Right / Arrow Left as the live template renders them: Framer's Phosphor vectors stroke the arrow head as a
   closed triangle (path "M 0 0 L 6.75 6.75 L 0 13.5 Z" at translate(13.5 5.25)) plus a 9.75px shaft, 24 viewBox,
   stroke 1.5, round caps and joins. Read from the published site's SVG symbols. */
function Arrow({ d, size, className }: { d: string; size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowRight({ size = 14, className }: P) {
  return <Arrow size={size} className={className} d="M3.75 12H13.5M13.5 5.25L20.25 12L13.5 18.75Z" />;
}

export function IconArrowLeft({ size = 14, className }: P) {
  return <Arrow size={size} className={className} d="M20.25 12H10.5M10.5 5.25L3.75 12L10.5 18.75Z" />;
}

export function IconBell({ size = 20, className }: P) {
  return <Ph size={size} className={className} d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" />;
}
