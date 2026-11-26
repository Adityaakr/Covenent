"use client";
import { useState } from "react";
import { short as shortAddress } from "@/lib/format";
import { explorerUrl, type ChainAddress } from "../content/integrations";
import s from "./Address.module.css";

/** A contract address as a short BscScan link (testnet or mainnet) with a copy button. */
export function Address({ a }: { a: ChainAddress }) {
  const [copied, setCopied] = useState(false);
  const short = shortAddress(a.address);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(a.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; the link still works */
    }
  };
  return (
    <span className={s.row}>
      <span className="t-small c-text-2">{a.label}</span>
      <span className={s.right}>
        <a
          href={explorerUrl(a)}
          target="_blank"
          rel="noopener noreferrer"
          className={["t-small", s.addr].join(" ")}
          title={`${a.address} on ${a.chain === "bsc-testnet" ? "BscScan testnet" : "BscScan"}`}
        >
          {short}
          <span className={s.net}>{a.chain === "bsc-testnet" ? "testnet" : "mainnet"}</span>
        </a>
        <button type="button" className={s.copy} onClick={copy} aria-label={`Copy ${a.label} address`}>
          {copied ? (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4.5 12.75 9.75 18 19.5 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="8.25" y="8.25" width="12" height="12" rx="2" stroke="currentColor" strokeWidth={1.5} />
              <path d="M15.75 8.25V5.25a1.5 1.5 0 0 0-1.5-1.5h-9a1.5 1.5 0 0 0-1.5 1.5v9a1.5 1.5 0 0 0 1.5 1.5h3" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          )}
        </button>
      </span>
    </span>
  );
}
