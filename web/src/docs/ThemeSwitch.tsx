"use client";
/* Light, Dark or System for the docs, the same choice the app keeps (components/app/theme.ts). */
import { setThemePref, THEME_OPTIONS, useSystemThemeSync, useThemePref } from "@/components/app/theme";

export function ThemeSwitch() {
  const pref = useThemePref();
  useSystemThemeSync();
  return (
    <div className="docs-theme" role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={pref === o.value} onClick={() => setThemePref(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
