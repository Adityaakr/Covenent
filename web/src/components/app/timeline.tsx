"use client";

/*
 * A vertical timeline for on-chain activity: the icon sits in a left rail joined by a line, the title and one-line
 * detail on the left, the time on the right, the transaction as a small muted link under the detail (never wraps;
 * copy and the explorer on hover). Runs of the same routine event (heartbeats, observations) fold into one row.
 */
import { useState, type ReactNode } from "react";
import { explorerTx } from "@/lib/chain/chains";
import { dateTime, relative } from "@/lib/covenant/time";
import { short } from "@/lib/format";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

export interface TimelineItem {
  key: string;
  /** rows with the same group key next to each other fold into one ("2 heartbeats") */
  group?: string;
  icon: IconName;
  tone?: string;
  title: ReactNode;
  /** plural noun for a folded run, e.g. "heartbeats" */
  plural?: string;
  detail?: ReactNode;
  body?: ReactNode;
  at: number;
  tx?: string;
}

interface Folded extends TimelineItem { count: number; txs: string[] }

export function foldRuns(items: TimelineItem[]): Folded[] {
  const out: Folded[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && it.group && last.group === it.group) {
      last.count++;
      if (it.tx) last.txs.push(it.tx);
      continue;
    }
    out.push({ ...it, count: 1, txs: it.tx ? [it.tx] : [] });
  }
  return out;
}

export function TxLink({ chainId, hash }: { chainId?: number; hash: string }) {
  const [done, setDone] = useState(false);
  const href = chainId ? explorerTx(chainId, hash) : null;
  return (
    <span className="tl-tx">
      {href ? <a href={href} target="_blank" rel="noreferrer" title={`${hash} on the explorer`}>{short(hash, 8, 4)}</a> : <span title={hash}>{short(hash, 8, 4)}</span>}
      <button type="button" className="tl-tx-btn" aria-label={done ? "Copied" : "Copy transaction hash"} title={done ? "Copied" : "Copy"} onClick={() => { void navigator.clipboard?.writeText(hash).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}>
        <Icon name={done ? "check" : "copy"} size={11} />
      </button>
      {href ? <a className="tl-tx-btn" href={href} target="_blank" rel="noreferrer" aria-label="Open on the explorer" title="Open on the explorer"><Icon name="arrowUpRight" size={11} /></a> : null}
    </span>
  );
}

export function Timeline({ items, now, chainId, initial = 5, empty }: { items: TimelineItem[]; now: number; chainId?: number; initial?: number; empty?: ReactNode }) {
  const [all, setAll] = useState(false);
  const rows = foldRuns(items);
  const shown = all ? rows : rows.slice(0, initial);
  if (rows.length === 0) return <div className="tl-empty">{empty ?? "Nothing on-chain yet."}</div>;
  return (
    <>
      <ol className="tl">
        {shown.map((r) => (
          <li key={r.key} className="tl-row">
            <span className={cx("tl-ic", r.tone)}><Icon name={r.icon} size={14} /></span>
            <div className="tl-main">
              <div className="tl-title">{r.count > 1 && r.plural ? <>{r.count} {r.plural}</> : r.title}</div>
              {r.detail ? <div className="tl-det">{r.detail}</div> : null}
              {r.body}
              {r.txs[0] ? <TxLink chainId={chainId} hash={r.txs[0]} /> : null}
            </div>
            <time className="tl-time" dateTime={new Date(r.at * 1000).toISOString()} title={dateTime(r.at)}>{relative(r.at, now)}</time>
          </li>
        ))}
      </ol>
      {rows.length > initial ? (
        <button type="button" className="tl-more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${rows.length}`}<Icon name={all ? "up" : "down"} size={13} />
        </button>
      ) : null}
    </>
  );
}
