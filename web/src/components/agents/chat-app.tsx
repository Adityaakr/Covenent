"use client";

/*
 * ChatApp (beUI's chat-app shell): a conversation pane with an optional left sidebar. Where the shell is wide enough
 * the sidebar docks and collapses off-canvas; where it is narrow (a phone, a side panel) it becomes a drawer over the
 * conversation with a backdrop. The shell measures its own box, not the viewport, so it works inside any column.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";

const MIN_DOCKED = 760;
interface Ctx { open: boolean; toggle: () => void; close: () => void; wide: boolean; hasSidebar: boolean }
const SidebarCtx = createContext<Ctx>({ open: false, toggle: () => {}, close: () => {}, wide: true, hasSidebar: false });
export const useChatSidebar = () => useContext(SidebarCtx);

export function ChatApp({ sidebar, sidebarLabel = "Recent chats", children, className }: { sidebar?: ReactNode; sidebarLabel?: string; children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  const [docked, setDocked] = useState(true);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWide((e?.contentRect.width ?? MIN_DOCKED) >= MIN_DOCKED));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const open = sidebar ? (wide ? docked : drawer) : false;
  const ctx: Ctx = { open, wide, hasSidebar: Boolean(sidebar), toggle: () => (wide ? setDocked(!docked) : setDrawer(!drawer)), close: () => setDrawer(false) };
  return (
    <SidebarCtx.Provider value={ctx}>
      <div ref={root} className={cx("ag-app", wide ? "is-wide" : "is-narrow", open && "side-open", className)}>
        {sidebar ? (
          <>
            <aside className="ag-side" aria-label={sidebarLabel} inert={!open} aria-hidden={!open}>{sidebar}</aside>
            {!wide && open ? <button type="button" className="ag-side-backdrop" aria-label="Close recent chats" onClick={() => setDrawer(false)} /> : null}
          </>
        ) : null}
        <div className="ag-main">{children}</div>
      </div>
    </SidebarCtx.Provider>
  );
}

export function ChatSidebarTrigger({ label = "Recent chats" }: { label?: string }) {
  const s = useChatSidebar();
  if (!s.hasSidebar) return null;
  return (
    <button type="button" className="ag-icon-btn" aria-label={s.open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-expanded={s.open} onClick={s.toggle}>
      <Icon name="sidebar" size={16} />
    </button>
  );
}
