import Link from "next/link";
import { LogoMark } from "./LogoMark";
import {
  footerColumns,
  footerCopyright,
  footerNote,
  footerStatus,
  footerTagline,
  isCurrent,
  wordmark,
} from "./siteLinks";
import s from "./Footer.module.css";

/* Footer from layout template "Main" (bjIxcK_F0, frame xQFxeZ3LK). */
export function Footer({ current }: { current?: string }) {
  return (
    <footer className={s.footer} data-framer-name="Footer">
      <div className={s.inner}>
        <div className={s.top}>
          <div className={s.brand}>
            <Link href="/" className={s.logo} aria-label={`${wordmark} home`}>
              <LogoMark />
              <span className="t-h4">{wordmark}</span>
            </Link>
            <p className={["t-body", s.tagline].join(" ")}>{footerTagline}</p>
            <div className={s.status}>
              <span className={s.dot} aria-hidden="true" />
              <p className="t-small">{footerStatus}</p>
            </div>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title} className={s.column}>
              <p className="t-label">{col.title}</p>
              {col.links.map((l) =>
                /^https?:\/\//.test(l.href) ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={["t-body link-footer", s.link].join(" ")}>
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.label}
                    href={l.href}
                    className={["t-body link-footer", s.link].join(" ")}
                    aria-current={isCurrent(current, l.href) ? "page" : undefined}
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
        <div className={s.band} aria-hidden="true">
          <p className={s.bigWordmark}><span>{wordmark}</span></p>
        </div>
        <div className={s.bottom}>
          <p className="t-small c-text-2">{footerCopyright}</p>
          <p className="t-small c-text-2">{footerNote}</p>
        </div>
      </div>
    </footer>
  );
}
