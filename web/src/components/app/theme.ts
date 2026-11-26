"use client";

/*
 * The app's theme. A visitor picks Light, Dark or System; the choice is kept in localStorage ("theme") and applied
 * before first paint by the script in app/layout.tsx, which writes the resolved theme to <html data-theme> and the
 * choice to <html data-theme-pref>. With no saved choice the app is light, whatever the OS prefers. The landing page
 * keeps its own light palette either way (landing.css).
 */
import { useEffect, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";
const KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const resolve = (p: ThemePref): Theme => (p === "system" ? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light") : p);

export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* this page only */ }
  const html = document.documentElement;
  html.dataset.themePref = p;
  html.dataset.theme = resolve(p);
}

function subscribeHtml(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-pref"] });
  return () => o.disconnect();
}

/** The theme in effect (System resolved). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeHtml, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => "light");
}

/** The visitor's choice: Light, Dark or System. */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeHtml, () => {
    const p = document.documentElement.dataset.themePref;
    return p === "dark" || p === "system" ? p : "light";
  }, () => "light");
}

/** With System chosen, follow the OS when it switches between light and dark. Mount once (the app shell). */
export function useSystemThemeSync() {
  const pref = useThemePref();
  useEffect(() => {
    if (pref !== "system") return;
    const m = window.matchMedia(DARK_QUERY);
    const on = () => { document.documentElement.dataset.theme = m.matches ? "dark" : "light"; };
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [pref]);
}
