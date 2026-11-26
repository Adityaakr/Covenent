"use client";

/*
 * Per-visitor UI preferences in localStorage (never data a screen depends on): the intents picked at first run,
 * whether the intent picker was finished or skipped, the collapsed sidebar and the dismissed promo card.
 * Storage can throw in private windows; every read falls back to the default and every write is best effort.
 */
import { useSyncExternalStore } from "react";

export type Intent = "invest" | "raise" | "agent" | "watch";
export const INTENTS: Intent[] = ["invest", "raise", "agent", "watch"];

const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
function subscribe(cb: () => void) {
  subs.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(cb); window.removeEventListener("storage", onStorage); };
}
function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* this page only */ }
  emit();
}

function useKey(key: string, server: string | null = null): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => server);
}

/** "unset" until the picker is finished or skipped, so the first render on the server never shows it. */
export function useOnboarded(): "yes" | "no" | "unset" {
  const v = useSyncExternalStore(subscribe, () => read("cv-onboarded") ?? "no", () => "unset");
  return v === "yes" ? "yes" : v === "unset" ? "unset" : "no";
}
export function useIntents(): Intent[] {
  const raw = useKey("cv-intents");
  if (!raw) return [];
  return raw.split(",").filter((x): x is Intent => (INTENTS as string[]).includes(x));
}
export function saveIntents(list: Intent[]) {
  write("cv-intents", list.join(","));
  write("cv-onboarded", "yes");
}
export function skipOnboarding() { write("cv-onboarded", "yes"); }
export function reopenOnboarding() { write("cv-onboarded", "no"); }

export function useCollapsed(): boolean { return useKey("cv-sidebar") === "collapsed"; }
export function setCollapsed(on: boolean) { write("cv-sidebar", on ? "collapsed" : null); }

export function usePromoHidden(): boolean { return useKey("cv-promo", "hidden") === "hidden"; }
export function hidePromo() { write("cv-promo", "hidden"); }
export function showPromo() { write("cv-promo", "shown"); }
