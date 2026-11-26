"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { SETTINGS } from "@/components/app/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <main className="page set-page">
      <header className="set-head">
        <h1 className="h-page">Settings</h1>
        <p className="t-s muted w5">Your account, test funds, the contracts this app reads, and the tools around them.</p>
      </header>
      <nav className="ptabs set-tabs" aria-label="Settings">
        {SETTINGS.map((t, i) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          const split = i > 0 && SETTINGS[i - 1]!.group !== t.group;
          return (
            <span key={t.href} className="set-tab">
              {split ? <span className="set-sep" aria-hidden /> : null}
              <Link href={t.href} aria-current={active ? "page" : undefined}><Icon name={t.icon} size={15} />{t.label}</Link>
            </span>
          );
        })}
      </nav>
      {children}
    </main>
  );
}
