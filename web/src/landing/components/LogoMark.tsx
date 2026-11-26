/** Logo mark from Navigation "Logo Mark" (DGdQ2M0O7): 22px square, radius 7px, Text Primary fill,
 *  padding 4px with an 8px Background dot aligned bottom right. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <rect width="22" height="22" rx="7" fill="var(--c-text)" />
      <circle cx="14" cy="14" r="4" fill="var(--c-bg)" />
    </svg>
  );
}
