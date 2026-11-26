"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useWallet } from "@/components/providers";
import { reopenGetStarted } from "@/components/app/funds";
import { Icon } from "@/components/app/icons";
import { reopenOnboarding, showPromo, usePromoHidden } from "@/components/app/prefs";
import { setTheme, useTheme } from "@/components/app/shell";
import { Addr, Segmented, TokenAvatar } from "@/components/app/ui";
import { chainName, explorerAddress } from "@/lib/chain/chains";
import { useSource } from "@/lib/data/hooks";
import { useNativeBalance } from "@/lib/data/faucet";

function Row({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="set-row">
      <div style={{ minWidth: 0 }}>
        <p className="set-row-t">{title}</p>
        {sub ? <p className="set-row-s">{sub}</p> : null}
      </div>
      {children ? <div className="set-row-c">{children}</div> : null}
    </div>
  );
}

/** Settings, Account: the connected wallet and this browser's preferences. */
export default function AccountSettings() {
  const w = useWallet();
  const src = useSource();
  const bal = useNativeBalance();
  const theme = useTheme();
  const promoHidden = usePromoHidden();
  const chainId = src.chainId ?? w.chainId ?? undefined;
  const scan = w.address && chainId ? explorerAddress(chainId, w.address) : null;
  const unit = chainId === 97 ? "tBNB" : "BNB";

  return (
    <div className="set-body">
      <section className="set-sec" aria-labelledby="acct-wallet">
        <div className="set-intro">
          <h2 id="acct-wallet" className="h-sec">Wallet</h2>
          <p className="t-s muted w5">The address you commit, claim and redeem from. Covenant never holds a key.</p>
        </div>
        {w.address ? (
          <div className="set-card set-wallet">
            <div className="row" style={{ gap: 14, minWidth: 0 }}>
              <TokenAvatar seed={w.address} size={48} />
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <Addr a={w.address} chainId={chainId} full />
                <span className="t-xs muted w5">Connected with {w.label ?? "a wallet"}{w.chainId ? ` · ${chainName(w.chainId)}` : ""}</span>
              </div>
            </div>
            <div className="set-wallet-bal">
              <span className="lbl">Balance</span>
              <span className="num ink">{bal.data === undefined ? "–" : `${bal.data.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`}</span>
            </div>
            <div className="row wrap-ok" style={{ gap: 8 }}>
              {scan ? <a className="btn btn-secondary btn-sm" href={scan} target="_blank" rel="noreferrer">View on BscScan<Icon name="arrowUpRight" size={13} /></a> : null}
              <Link className="btn btn-secondary btn-sm" href="/app/portfolio"><Icon name="pie" size={14} />Portfolio</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => w.disconnect()}><Icon name="exit" size={14} />Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="set-card set-empty">
            <span className="icon-tile"><Icon name="wallet" size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <p className="h-card">No wallet connected</p>
              <p className="t-s muted w5">Sign in with email or connect a browser wallet to commit to raises and see your positions.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => w.connect()}><Icon name="wallet" size={14} />Connect</button>
          </div>
        )}
      </section>

      <section className="set-sec" aria-labelledby="acct-prefs">
        <div className="set-intro">
          <h2 id="acct-prefs" className="h-sec">Preferences</h2>
          <p className="t-s muted w5">Kept in this browser only.</p>
        </div>
        <div className="set-card set-rows">
          <Row title="Theme" sub="The app follows your choice on every page.">
            <Segmented size="sm" label="Theme" value={theme} onChange={(v) => setTheme(v)} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
          </Row>
          <Row title="Discover" sub="Pick what you came to do and Discover is ordered around it.">
            <Link className="btn btn-secondary btn-sm" href="/app" onClick={reopenOnboarding}>Personalise</Link>
          </Row>
          {src.chainId === 97 && w.address ? (
            <Row title="Testnet guide" sub="The three steps from test BNB to your first position.">
              <button className="btn btn-secondary btn-sm" onClick={() => reopenGetStarted(w.address!)}>Show again</button>
            </Row>
          ) : null}
          {promoHidden ? (
            <Row title="Sidebar card" sub="The launch card at the bottom of the sidebar.">
              <button className="btn btn-secondary btn-sm" onClick={showPromo}>Show again</button>
            </Row>
          ) : null}
        </div>
      </section>
    </div>
  );
}
