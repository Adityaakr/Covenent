import { IconArrowUpRight } from "./icons";
import s from "./SourceLink.module.css";

/** A cited source: Text/Small in Text Secondary, footer-link hover (to Text Primary), opens in a new tab. */
export function SourceLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={["t-small", "link-footer", s.link, className ?? ""].filter(Boolean).join(" ")}
    >
      <span className={s.text}>{children}</span>
      <IconArrowUpRight size={12} />
    </a>
  );
}
