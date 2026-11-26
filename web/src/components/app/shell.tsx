"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSwitchChain } from "wagmi";
import { useWallet } from "@/components/providers";
import { anvil, chainName, explorerTx, faucetFor } from "@/lib/chain/chains";
import { useCovenants, useSource } from "@/lib/data/hooks";
import { dismissToast, useToasts } from "@/lib/data/actions";
import { short } from "@/lib/format";
import { Icon, Mark, type IconName } from "./icons";
import { hidePromo, reopenOnboarding, setCollapsed, useCollapsed, usePromoHidden } from "./prefs";
import { Portal, Skeleton, TokenAvatar, cx, seedOf } from "./ui";
import { withBnb } from "@/components/app/bnb";
import { ThinkingMark } from "./mark";
import { GetStarted } from "./funds";
import { SETTINGS } from "./settings-nav";

const NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/app", label: "Discover", icon: "compass", exact: true },
  { href: "/app/covenants", label: "Covenants", icon: "layers" },
  { href: "/app/portfolio", label: "Portfolio", icon: "pie" },
  { href: "/app/create", label: "Create", icon: "plus" },
];

/**
 * The key that replays the page-enter motion: a new section animates in, while tabs inside one covenant or inside
 * Settings swap in place (their own content rises) so the header above them stays still.
 */
function routeKey(path: string): string {
  const p = path.split("/").filter(Boolean);
  if (p[1] === "c" || p[1] === "lite") return p.slice(0, 3).join("/");
  if (p[1] === "settings") return "app/settings";
  return path;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cmdk, setCmdk] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const collapsed = useCollapsed();
  const path = usePathname();
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); setCmdk(false); }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdk((x) => !x); }
      if (e.key === "Escape") setOpen(false);
    };
    const s = () => setScrolled(window.scrollY > 4);
    window.addEventListener("keydown", k);
    window.addEventListener("scroll", s, { passive: true });
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("scroll", s); };
  }, []);

  return (
    <div className="cv" data-open={open} data-collapsed={collapsed}>
      <div className="scrim" onClick={() => setOpen(false)} aria-hidden />
      <Sidebar collapsed={collapsed} onSearch={() => setCmdk(true)} />
      <div className="frame">
        <header className="tb" data-scrolled={scrolled}>
          <button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="menu" size={20} /></button>
          <Crumbs />
          <div className="tb-right">
            <SourcePill />
            <button className="icon-btn hide-sm" aria-label="Search (Command K)" title="Search  ⌘K" onClick={() => setCmdk(true)}><Icon name="search" size={18} /></button>
            <NetworkChip />
            <WalletMenu />
          </div>
        </header>
        <div className="pg" key={routeKey(path)}>{children}</div>
      </div>
      {/* overlays live in body, outside the transformed page wrapper (.pg), so fixed positioning is the viewport's */}
      {cmdk ? <Portal><CommandPalette onClose={() => setCmdk(false)} /></Portal> : null}
      <Portal><GetStarted /></Portal>
      <Portal><Toasts /></Portal>
    </div>
  );
}

/* ---------- Sidebar ---------- */

function Sidebar({ collapsed, onSearch }: { collapsed: boolean; onSearch: () => void }) {
  const path = usePathname();
  const { list, source, loading } = useCovenants();
  const promoHidden = usePromoHidden();
  const online = source.mode === "live";
  const live = online ? list.filter((v) => v.source === "live" && v.state !== "FAILED") : [];
  return (
    <aside className="sb" aria-label="App navigation">
      <div className="sb-top">
        <Link href="/" className="sb-logo" title="Covenant home"><Mark size={22} /><span>Covenant</span></Link>
        <button className="sb-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}><Icon name="sidebar" size={18} /></button>
      </div>
      <button className="sb-item" onClick={onSearch} title="Search">
        <Icon name="search" size={18} /><span className="lab">Search</span>
        <span className="kbd" aria-hidden><kbd>⌘</kbd><kbd>K</kbd></span>
      </button>
      {NAV.map((n) => {
        const active = n.exact ? path === n.href : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className="sb-item" aria-current={active ? "page" : undefined} title={n.label}>
            <Icon name={n.icon} size={18} /><span className="lab">{n.label}</span>
            {n.href === "/app/covenants" && online ? <span className="count">{live.length}</span> : null}
          </Link>
        );
      })}
      <div className="sb-label">Covenants</div>
      <div className="sb-covs" style={{ display: "grid", gap: 2 }}>
        {live.map((v) => {
          const href = `/app/c/${v.id}`;
          return (
            <Link key={v.id} href={href} className="sb-cov" aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined} title={`${v.terms.name} · ${v.terms.symbol}`}>
              <TokenAvatar seed={seedOf(v)} size={22} />
              <span className="name">{v.terms.name}</span>
              <span className="tick">{v.terms.symbol}</span>
            </Link>
          );
        })}
        {!online ? (
          <Link href="/app" className="sb-offline" title={source.reason}><Icon name="alert" size={15} /><span>{source.mode === "checking" ? "Checking the chain" : `Not connected to ${source.payload?.deployment ? chainName(source.payload.deployment.chainId) : "the chain"}`}</span></Link>
        ) : loading ? [0, 1, 2].map((k) => <span key={k} className="sb-cov" aria-hidden><Skeleton h={22} w={22} r={22} /><Skeleton h={12} w={`${60 - k * 12}%`} /></span>)
          : live.length === 0 ? <Link href="/app/create" className="sb-empty"><span>No covenants yet</span><span className="sb-empty-a">Create the first<Icon name="arrow" size={13} /></span></Link> : null}
      </div>
      <div className="sb-spacer" />
      {!promoHidden ? (
        <>
          <section className="promo promo-v2" aria-label="Start a covenant">
            <span className="promo-glow" aria-hidden />
            <button className="promo-x" aria-label="Hide this card" onClick={hidePromo}><Icon name="x" size={12} /></button>
            <div className="promo-top" aria-hidden>
              <span className="promo-mark"><Mark size={20} /></span>
              <span className="promo-bots">{["issuer-a", "keeper-b", "investor-c"].map((s) => <TokenAvatar key={s} seed={s} size={20} />)}</span>
            </div>
            <p className="promo-eb">For founders and agents</p>
            <p className="promo-t">Launch your autonomous venture</p>
            <ol className="promo-flow" aria-label="Raise with refunds, a treasury on a budget, an exit at book">
              <li><i />Raise</li>
              <li><i />Treasury</li>
              <li><i />Exit at book</li>
            </ol>
            <Link href="/app/create" className="promo-go">Start a covenant<Icon name="arrow" size={14} /></Link>
          </section>
          <Link href="/app/create" className="promo-mini" title="Start a covenant" aria-label="Start a covenant"><span className="promo-glow" aria-hidden /><Icon name="rocket" size={17} /></Link>
        </>
      ) : null}
      <Link href="/app/settings" className="sb-item sb-settings" aria-current={path.startsWith("/app/settings") ? "page" : undefined} title="Settings">
        <Icon name="sliders" size={18} /><span className="lab">Settings</span>
      </Link>
      <div className="sb-foot">
        <Link href="/features" title="Docs"><Icon name="book" size={16} /><span className="lab">Docs</span></Link>
        <ThemeSwitch />
      </div>
    </aside>
  );
}

function Crumbs() {
  const path = usePathname();
  const { list } = useCovenants();
  const parts = path.split("/").filter(Boolean).slice(1);
  const top: Record<string, string> = { lite: "Four.meme covenant", create: "Create a covenant", portfolio: "Portfolio", covenants: "Covenants" };
  if (parts[0] === "settings") {
    const sub = SETTINGS.find((t) => t.href !== "/app/settings" && path.startsWith(t.href));
    return (
      <nav className="crumbs" aria-label="Breadcrumb">
        {sub ? <><Link href="/app/settings" className="hide-sm">Settings</Link><span className="sep hide-sm">/</span><b>{sub.label}</b></> : <b>Settings</b>}
      </nav>
    );
  }
  if (parts[0] === "c") {
    const v = list.find((x) => x.id.toLowerCase() === (parts[1] ?? "").toLowerCase());
    const sub = parts[2] ? { raise: "Raise", settle: "Settlement", redeem: "Redeem", team: v?.issuer.kind === "agent" ? "Agent console" : "Team console" }[parts[2]] ?? null : null;
    return (
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/app/covenants" className="hide-sm">Covenants</Link>
        <span className="sep hide-sm">/</span>
        {sub ? <Link href={`/app/c/${parts[1]}`} className="trunc">{v?.terms.name ?? "Covenant"}</Link> : <b>{v?.terms.name ?? "Covenant"}</b>}
        {sub ? <><span className="sep">/</span><b>{sub}</b></> : null}
      </nav>
    );
  }
  return <nav className="crumbs" aria-label="Breadcrumb"><b>{parts[0] ? top[parts[0]] ?? "Covenant" : "Discover"}</b></nav>;
}

/** The chain the app reads, named the way the rest of the site names it, with the BNB mark before it. */
export function SourcePill() {
  const s = useSource();
  const cls = s.mode === "live" ? "live" : s.mode === "checking" ? "" : "mock";
  // Only the live chain is named here; an offline source says why on the page itself, not in a status pill.
  if (s.mode !== "live" || !s.chainId) return null;
  return <span className={cx("srcpill hide-sm", cls)} title={`Live: ${s.reason}`}>{withBnb(chainName(s.chainId))}</span>;
}

function NetworkChip() {
  const w = useWallet();
  const src = useSource();
  const { switchChain } = useSwitchChain();
  if (!w.address || !w.chainId) return null;
  const wrong = src.chainId ? w.chainId !== src.chainId : w.chainId !== anvil.id && w.chainId !== 97;
  // The source pill already names the network; this chip only shows when the wallet is on a different one.
  if (!wrong && src.mode === "live") return null;
  return (
    <button className={cx("netpill hide-sm", wrong && "warn")} onClick={() => switchChain?.({ chainId: src.chainId ?? anvil.id })} title={wrong ? `Wrong network: switch to ${chainName(src.chainId ?? anvil.id)}` : "Connected network"}>
      {wrong ? <Icon name="alert" size={14} /> : null}{withBnb(chainName(w.chainId))}
    </button>
  );
}

function subscribeTheme(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}
export function setTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch { /* this page only */ }
}
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"), () => "dark");
}

export function ThemeSwitch() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-btn sm" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => setTheme(next)}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}

/* ---------- Wallet ---------- */

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

function WalletMenu() {
  const w = useWallet();
  const src = useSource();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {w.address ? (
        <button className="walletbtn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
          <TokenAvatar seed={w.address} size={26} /><span className="lab mono">{short(w.address, 6, 4)}</span><Icon name="chevronDown" size={14} style={{ color: "var(--muted)" }} />
        </button>
      ) : (
        // Straight to Privy (email and wallets in one popup); without Privy, straight to the browser's wallet.
        <button className="btn btn-primary btn-sm connectbtn" onClick={() => w.connect()} disabled={!w.ready}><Icon name="wallet" size={15} />Connect</button>
      )}
      {open && w.address ? (
        <div className="pop" role="menu">
          {w.address ? (
            <>
              <div className="wallet-head">
                <TokenAvatar seed={w.address} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div className="mono ink" style={{ fontSize: 14 }}>{short(w.address, 8, 6)}</div>
                  <div className="t-xs muted w5">Connected with {w.label ?? "a wallet"}{w.chainId ? ` · ${chainName(w.chainId)}` : ""}</div>
                </div>
              </div>
              <div className="pop-sep" />
              <button className="pop-item" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(w.address!); setCopied(true); setTimeout(() => setCopied(false), 1200); }}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Copied" : "Copy address"}</button>
              <Link className="pop-item" role="menuitem" href="/app/portfolio" onClick={() => setOpen(false)}><Icon name="pie" size={16} />Portfolio</Link>
              {(() => {
                const fc = faucetFor(src.chainId);
                if (!fc) return null;
                return fc.external
                  ? <a className="pop-item" role="menuitem" href={fc.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><Icon name="drop" size={16} />{fc.label}</a>
                  : <Link className="pop-item" role="menuitem" href={fc.href} onClick={() => setOpen(false)}><Icon name="drop" size={16} />{fc.label}</Link>;
              })()}
              <Link className="pop-item" role="menuitem" href="/app/settings" onClick={() => setOpen(false)}><Icon name="sliders" size={16} />Settings</Link>
              {w.switchAccount ? <button className="pop-item" role="menuitem" onClick={() => { w.switchAccount!(); setOpen(false); }}><Icon name="users" size={16} />Switch account</button> : null}
              <button className="pop-item" role="menuitem" onClick={() => { w.disconnect(); setOpen(false); }}><Icon name="exit" size={16} />{w.mode === "privy" ? "Log out" : "Disconnect"}</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Command palette (⌘K) ---------- */

type Cmd = { id: string; group: string; label: string; hint?: string; icon?: IconName; symbol?: string; run: () => void };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { list } = useCovenants();
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const go = (href: string) => () => { router.push(href); onClose(); };
  const all = useMemo<Cmd[]>(() => [
    ...NAV.map((n) => ({ id: n.href, group: "Pages", label: n.label, icon: n.icon, run: go(n.href) })),
    ...SETTINGS.map((n) => ({ id: n.href, group: "Settings", label: n.label === "Account" ? "Settings" : n.label, icon: n.icon, run: go(n.href) })),
    ...list.filter((v) => v.source === "live").map((v) => ({ id: v.id, group: "Covenants", label: v.terms.name, hint: v.terms.symbol, symbol: seedOf(v), run: go(`/app/c/${v.id}`) })),
    { id: "theme", group: "Actions", label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, icon: theme === "dark" ? "sun" : "moon", run: () => { setTheme(theme === "dark" ? "light" : "dark"); onClose(); } },
    { id: "intents", group: "Actions", label: "Personalise Discover", icon: "sparkle", run: () => { reopenOnboarding(); router.push("/app"); onClose(); } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [list, theme]);
  const shown = all.filter((c) => !q || `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((c) => c.group))];
  const active = Math.min(sel, Math.max(0, shown.length - 1));

  return (
    <div className="modal-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cmdk-in">
          <Icon name="search" size={18} />
          <input autoFocus value={q} placeholder="Search covenants, pages and actions" aria-label="Search"
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(shown.length - 1, s + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter") shown[active]?.run();
              if (e.key === "Escape") onClose();
            }} />
          <span className="kbd"><kbd>esc</kbd></span>
        </div>
        <div className="cmdk-list" role="listbox">
          {shown.length === 0 ? <p className="t-s muted w5" style={{ padding: "18px 12px" }}>Nothing matches &ldquo;{q}&rdquo;.</p> : groups.map((g) => (
            <div key={g}>
              <div className="pop-label">{g}</div>
              {shown.filter((c) => c.group === g).map((c) => {
                const i = shown.indexOf(c);
                return (
                  <button key={c.id} className="pop-item" role="option" aria-selected={i === active} data-active={i === active} onMouseEnter={() => setSel(i)} onClick={c.run}>
                    {c.symbol ? <TokenAvatar seed={c.symbol} size={22} /> : <Icon name={c.icon ?? "arrow"} size={16} />}
                    <span className="grow">{c.label}</span>
                    {c.hint ? <span className="mono t-xs muted">{c.hint}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></div>
      </div>
    </div>
  );
}

/* ---------- Transaction toasts ---------- */

function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => {
        const href = t.hash && t.chainId ? explorerTx(t.chainId, t.hash) : null;
        return (
          <div key={t.id} className="toast" role="status">
            <span className={cx("toast-ic", t.status)}>{t.status === "pending" ? <ThinkingMark size={16} /> : <Icon name={t.status === "done" ? "check" : "alert"} size={16} />}</span>
            <div style={{ minWidth: 0 }}>
              <div className="t">{t.title}{t.status === "done" ? " confirmed" : t.status === "error" ? " failed" : ""}</div>
              {t.detail ? <div className="d anywhere">{t.detail}</div> : null}
              {t.hash ? <div className="t-xs mono faint" style={{ marginTop: 4 }}>{href ? <a href={href} target="_blank" rel="noreferrer" className="link">{short(t.hash, 10, 6)}</a> : short(t.hash, 10, 6)}</div> : null}
            </div>
            <button aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="icon-btn sm"><Icon name="x" size={14} /></button>
            {t.status === "pending" ? <span className="bar"><i /></span> : null}
          </div>
        );
      })}
    </div>
  );
}
