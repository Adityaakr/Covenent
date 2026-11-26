"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSwitchChain } from "wagmi";
import { privyOriginAllowed, useWallet } from "@/components/providers";
import { ANVIL_ROLES, anvil, chainName, explorerTx } from "@/lib/chain/chains";
import { useCovenants, useSource } from "@/lib/data/hooks";
import { dismissToast, useToasts } from "@/lib/data/actions";
import { short } from "@/lib/format";
import { Icon, Mark, type IconName } from "./icons";
import { StateDot } from "./ui";

const NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/app", label: "Covenants", icon: "grid", exact: true },
  { href: "/app/create", label: "Create", icon: "plus" },
  { href: "/app/simulator", label: "Simulator", icon: "flask" },
  { href: "/app/demo", label: "Demo", icon: "play" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const path = usePathname();
  const { list } = useCovenants();
  const search = useRef<HTMLInputElement>(null);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); }

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const shown = list.filter((v) => !q || `${v.terms.name} ${v.terms.symbol}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cv shell">
      <div className="scrim" data-open={open} onClick={() => setOpen(false)} />
      <aside className="side" data-open={open} aria-label="App navigation">
        <Link href="/" className="brand"><span className="brand-mark"><Mark /></span>Covenant</Link>
        <label className="side-search">
          <Icon name="search" size={15} />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search covenants" aria-label="Search covenants" />
          <kbd>⌘K</kbd>
        </label>
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className="nav-item" aria-current={active ? "page" : undefined}>
              <Icon name={n.icon} size={17} />{n.label}
              {n.href === "/app" ? <span className="count">{list.length}</span> : null}
            </Link>
          );
        })}
        <div className="side-label">Covenants</div>
        {shown.map((v) => {
          const href = `/app/c/${v.id}`;
          return (
            <Link key={v.id} href={href} className="side-cov" aria-current={path.startsWith(href) ? "page" : undefined}>
              <StateDot state={v.state} />
              <span className="sym">{v.terms.name}</span>
              {v.issuer.kind === "agent" ? <Icon name="agent" size={14} style={{ color: "var(--agent)" }} /> : null}
            </Link>
          );
        })}
        {shown.length === 0 ? <p className="tiny faint" style={{ padding: "4px 10px" }}>No match</p> : null}
        <div className="side-foot">
          <SourceChip />
          <div className="row between" style={{ padding: "0 4px" }}>
            <Link className="tiny muted" href="/">covenant · BNB Chain</Link>
            <ThemeSwitch />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <Crumbs />
          <div className="right">
            <NetworkChip />
            <WalletMenu />
          </div>
        </header>
        {children}
      </div>
      <Toasts />
    </div>
  );
}

function Crumbs() {
  const path = usePathname();
  const { list } = useCovenants();
  const parts = path.split("/").filter(Boolean).slice(1);
  let title = "Covenants";
  let sub: string | null = null;
  if (parts[0] === "create") title = "Create a covenant";
  else if (parts[0] === "simulator") title = "Launch simulator";
  else if (parts[0] === "demo") title = "Demo";
  else if (parts[0] === "c") {
    const v = list.find((x) => x.id.toLowerCase() === (parts[1] ?? "").toLowerCase());
    title = v ? `${v.terms.name}` : "Covenant";
    sub = parts[2] ? { raise: "Raise", settle: "Settle", redeem: "Redeem", team: "Team console" }[parts[2]] ?? null : "Covenant sheet";
  }
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <b>{title}</b>
      {sub ? <><span className="faint">/</span><span className="hide-sm" style={{ whiteSpace: "nowrap" }}>{sub}</span></> : null}
    </nav>
  );
}

export function SourceChip() {
  const s = useSource();
  const tone = s.mode === "live" ? "chip-good" : s.mode === "checking" ? "" : "chip-warn";
  return (
    <div className="card" style={{ padding: 10, display: "grid", gap: 6, boxShadow: "none" }}>
      <span className={`chip ${tone}`} style={{ justifySelf: "start" }}><span className="dot" />{s.mode === "live" ? "Live contracts" : s.mode === "checking" ? "Checking" : "Demo data"}</span>
      <span className="tiny muted" style={{ overflowWrap: "anywhere" }}>{s.reason}</span>
    </div>
  );
}

function NetworkChip() {
  const w = useWallet();
  const { switchChain } = useSwitchChain();
  if (!w.address || !w.chainId) return null;
  const wrong = w.chainId !== anvil.id && w.chainId !== 97;
  return (
    <button className={`chip chip-outline hide-sm ${wrong ? "chip-warn" : ""}`} onClick={() => switchChain?.({ chainId: anvil.id })} title="Switch to the local chain">
      <span className="dot" style={{ color: wrong ? "var(--warn)" : "var(--good)" }} />{chainName(w.chainId)}
    </button>
  );
}

function subscribeTheme(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => o.disconnect();
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeTheme, () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"), () => "light");
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}
      onClick={() => { document.documentElement.dataset.theme = next; try { localStorage.setItem("theme", next); } catch { /* this page only */ } }}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}

function WalletMenu() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {w.address ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="state-dot" style={{ background: "var(--good)" }} /><span className="mono">{short(w.address)}</span>
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}><Icon name="wallet" size={15} />Connect</button>
      )}
      {open ? (
        <div className="pop" role="menu">
          {w.address ? (
            <>
              <div className="pop-label">Connected with {w.label ?? "wallet"}</div>
              <div style={{ padding: "4px 10px 10px" }}><span className="mono small" style={{ overflowWrap: "anywhere" }}>{w.address}</span></div>
              <button className="pop-item" onClick={() => { void navigator.clipboard?.writeText(w.address!); setOpen(false); }}><Icon name="copy" size={16} />Copy address</button>
              <button className="pop-item" onClick={() => { w.disconnect(); setOpen(false); }}><Icon name="x" size={16} />Disconnect</button>
            </>
          ) : (
            <>
              <div className="pop-label">Connect a wallet</div>
              {w.mode === "privy" ? (
                <button className="pop-item" onClick={() => { w.connect(); setOpen(false); }}><Icon name="wallet" size={16} /><span>Privy<span className="tiny muted" style={{ display: "block" }}>Wallet or email login</span></span></button>
              ) : (
                <button className="pop-item" onClick={() => { w.connect(); setOpen(false); }}><Icon name="wallet" size={16} /><span>Browser wallet<span className="tiny muted" style={{ display: "block" }}>MetaMask, Rabby or any injected wallet</span></span></button>
              )}
              {w.mode === "browser" && w.devWallet ? (
                <>
                  <div className="pop-label">Local chain (anvil test accounts)</div>
                  {ANVIL_ROLES.map((role, i) => (
                    <button key={i} className="pop-item" onClick={() => { w.connectLocal(i); setOpen(false); }}><Icon name="user" size={16} /><span>Account #{i}<span className="tiny muted" style={{ display: "block" }}>{role}</span></span></button>
                  ))}
                </>
              ) : null}
              <div className="hr" style={{ margin: "6px 0" }} />
              {w.mode === "privy" ? (
                <button className="pop-item" onClick={() => w.setMode("browser")}><Icon name="refresh" size={16} /><span>Use a browser wallet instead<span className="tiny muted" style={{ display: "block" }}>Skips Privy; adds local test accounts</span></span></button>
              ) : w.privyAvailable ? (
                <>
                  <button className="pop-item" onClick={() => w.setMode("privy")}><Icon name="refresh" size={16} /><span>Use Privy login{!privyOriginAllowed() ? <span className="tiny muted" style={{ display: "block" }}>This origin is not on the Privy app&apos;s allow list; open http://localhost:8080 (pnpm dev)</span> : null}</span></button>
                </>
              ) : <p className="tiny muted" style={{ padding: "4px 10px" }}>Privy is off: no NEXT_PUBLIC_PRIVY_APP_ID.</p>}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => {
        const href = t.hash && t.chainId ? explorerTx(t.chainId, t.hash) : null;
        return (
          <div key={t.id} className="glass toast" role="status">
            {t.status === "pending" ? <span className="spin" /> : <Icon name={t.status === "done" ? "check" : "alert"} size={18} style={{ color: t.status === "done" ? "var(--good)" : "var(--bad)" }} />}
            <div style={{ minWidth: 0 }}>
              <div className="t">{t.title}{t.status === "done" ? " confirmed" : t.status === "error" ? " failed" : ""}</div>
              {t.detail ? <div className="tiny muted">{t.detail}</div> : null}
              {t.hash ? <div className="tiny mono faint">{href ? <a href={href} target="_blank" rel="noreferrer">{short(t.hash, 10, 6)}</a> : short(t.hash, 10, 6)}</div> : null}
            </div>
            <button aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="faint"><Icon name="x" size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
