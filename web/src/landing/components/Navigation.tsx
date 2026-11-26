"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button } from "./Button";
import { LogoMark } from "./LogoMark";
import { IconList, IconX } from "./icons";
import { isCurrent, navLinks, navPrimary, navSecondary, wordmark } from "./siteLinks";
import s from "./Navigation.module.css";

/* Framer component Navigation (U2c0fyMuW). Desktop variant on Desktop and Tablet, Phone variant on Phone.
   Phone -> Phone Open grows the frame from 64px to auto: spring, duration 0.45s, bounce 0. */
const drawerTransition = { type: "spring", duration: 0.45, bounce: 0 } as const;

export function Navigation({ current }: { current?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 810px)");
    const close = () => mq.matches && setOpen(false);
    mq.addEventListener("change", close);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      mq.removeEventListener("change", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className={s.nav} data-framer-name="Navigation" data-open={open ? "true" : "false"}>
      <div className={s.inner}>
        <Link href="/" className={s.logo} aria-label={`${wordmark} home`} onClick={() => setOpen(false)}>
          <LogoMark />
          <span className="t-h4">{wordmark}</span>
        </Link>

        <nav className={s.links} aria-label="Main">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="t-label link-nav"
              aria-current={isCurrent(current, l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={s.actions}>
          <Link
            href={navSecondary.href}
            className={["t-label link-nav", s.textAction].join(" ")}
            aria-current={isCurrent(current, navSecondary.href) ? "page" : undefined}
          >
            {navSecondary.label}
          </Link>
          <Button href={navPrimary.href} variant="primary" className={s.buttonAction}>
            {navPrimary.label}
          </Button>
          <button
            type="button"
            className={s.menuButton}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-nav-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconX /> : <IconList />}
          </button>
        </div>
      </div>

      <motion.div
        id="landing-nav-drawer"
        className={s.drawerClip}
        initial={false}
        animate={{ height: open ? "auto" : 0 }}
        transition={drawerTransition}
        aria-hidden={!open}
        inert={!open}
      >
        <div className={s.drawer}>
          {navLinks.map((l) => (
            <div key={l.href} className={s.drawerItem}>
              <Link
                href={l.href}
                className={["t-h3 link-nav", s.drawerLink].join(" ")}
                aria-current={isCurrent(current, l.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </div>
          ))}
          <div className={s.drawerActions}>
            <Button href={navSecondary.href} variant="secondary" size="lg" className={s.drawerButton}>
              {navSecondary.label}
            </Button>
            <Button href={navPrimary.href} variant="primary" size="lg" className={s.drawerButton}>
              {navPrimary.label}
            </Button>
          </div>
        </div>
      </motion.div>
    </header>
  );
}
