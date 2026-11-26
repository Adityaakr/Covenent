/* Test setup: jsdom has no matchMedia or ResizeObserver; motion and the chat components ask for them. */
if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  const g = globalThis as { ResizeObserver?: unknown };
  g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  const { cleanup } = await import("@testing-library/react");
  const { afterEach } = await import("vitest");
  afterEach(() => cleanup());
}
export {};
