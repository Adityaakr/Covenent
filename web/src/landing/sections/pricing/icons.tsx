/* Phosphor line icons used on /pricing (Framer icon set "Phosphor" omX0gWFPqDwhaiWwf6ab, width 1.5, alpha 0).
   Paths are Phosphor "regular" (256 grid, stroke 16) which is width 1.5 at the 24px grid. */
type P = { size?: number; className?: string };

/** Phosphor "Check" (Plan Feature Check, 14px, Accent). */
export function IconCheck({ size = 14, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <polyline points="40 144 96 200 224 72" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Phosphor "Quotes" (Pricing Quote Mark, 28px, Accent). */
export function IconQuotes({ size = 28, className }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M108,144H40a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M224,144H156a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
