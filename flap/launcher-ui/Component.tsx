import { useRef, useState, type CSSProperties, type ReactNode } from "react";

// Covenant Launcher detail for flap.sh (launcher-detail/v1). The host reads the getters declared in manifest.json
// into context.snapshot and, when the manifest declares transactions, submits the zero-argument actions through its
// wallet bridge. Every value shown comes from the Launcher on chain; a missing value renders as unavailable.

type Messages = Record<string, string>;
type Action = "contribute" | "finalize" | "claimRefund";
type Submission = { status: "success" | "pending" | "reverted" | "unverified"; hash: string };
type Wallet = Readonly<{
  account: string | null;
  chainId: number | null;
  pendingHash?: string | null;
  connect(): void;
  switchChain(): Promise<void>;
}>;
type Host = Readonly<{
  available?: boolean;
  wallet?: Wallet;
  submit?(input: { kind: "action"; action: Action; valueWei?: string }): Promise<Submission>;
  checkReceipt?(hash: string): Promise<Submission>;
  refresh?(): void;
  redirect?(path: string): boolean;
}>;
type Snapshot = Readonly<{
  state?: string | null;
  minRaise?: string | null;
  cap?: string | null;
  committed?: string | null;
  saleDeadline?: string | null;
  contributorCount?: string | null;
  saleAmount?: string | null;
  token?: string | null;
  vault?: string | null;
  expectedToken?: string | null;
  launchRetryUntil?: string | null;
  creator?: string | null;
  contribution?: string | null;
  refundDue?: string | null;
  allocation?: string | null;
  refunded?: boolean | null;
}>;
type LauncherProps = {
  context: Readonly<{
    identity: Readonly<{ chainId: number; factoryAddress: string }>;
    locale?: string;
    launcherAddress: string | null;
    snapshot: Snapshot | null;
    tokenTaxInfoHref?: string | null;
  }>;
  messages: Messages;
  host?: Host;
};

const ink = "#eef1f5";
const soft = "#a3abb8";
const line = "#2f3540";
const panel = "#14181f";
const raised = "#1b2029";
const accent = "#7fd4a8";
const warn = "#f0b45b";
const bad = "#f08080";

const shell: CSSProperties = {
  color: ink, background: panel, border: "1px solid " + line, borderRadius: 16, overflow: "hidden",
  fontFamily: "Inter, \"PingFang SC\", \"Apple SD Gothic Neo\", system-ui, sans-serif", lineHeight: 1.5,
  colorScheme: "dark", overflowWrap: "anywhere",
};
const pad = "clamp(14px, 4vw, 24px)";
const grid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12, margin: 0,
};
const mono: CSSProperties = { fontFamily: "\"IBM Plex Mono\", ui-monospace, monospace", fontVariantNumeric: "tabular-nums" };
const muted: CSSProperties = { margin: 0, color: soft, fontSize: 13 };
const field: CSSProperties = {
  boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 44, borderRadius: 8, border: "1px solid " + line,
  background: raised, color: ink, padding: "9px 11px", fontSize: 16, font: "inherit",
};

const addressPattern = /^0x(?!0{40}$)[0-9a-f]{40}$/i;
const hashPattern = /^0x[0-9a-f]{64}$/i;
const unsigned = /^(0|[1-9][0-9]{0,77})$/;
const unit = 10n ** 18n;

function units(value: string | null | undefined) {
  return typeof value === "string" && unsigned.test(value) ? BigInt(value) : null;
}

/** 18-decimal amount, up to `places` decimals, trailing zeros dropped. */
function decimal(value: bigint, places = 4) {
  const whole = value / unit;
  const scale = 10n ** BigInt(18 - places);
  const fraction = ((value % unit) / scale).toString().padStart(places, "0").replace(/0+$/, "");
  if (whole === 0n && fraction === "" && value > 0n) return "<0." + "0".repeat(places - 1) + "1";
  return whole.toString() + (fraction ? "." + fraction : "");
}

/** Parse a human BNB amount into wei; null if malformed. */
function parseBnb(text: string) {
  const match = /^(0|[1-9][0-9]{0,8})(?:\.([0-9]{1,18}))?$/.exec(text.trim());
  return match ? BigInt(match[1]) * unit + BigInt((match[2] ?? "").padEnd(18, "0")) : null;
}

function when(seconds: bigint | null, locale: string, fallback: string) {
  if (seconds === null || seconds <= 0n || seconds > 253402300799n) return fallback;
  return Intl.DateTimeFormat(locale, {
    timeZone: "UTC", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(Number(seconds) * 1000) + " UTC";
}

function short(address: string) {
  return address.slice(0, 6) + "…" + address.slice(-4);
}

function errorText(cause: unknown, m: Messages) {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "walletUnavailable") return m.walletUnavailable;
  if (code === "connectWallet") return m.connectWallet;
  if (code === "wrongChain") return m.switchChain;
  if (code === "walletRejected") return m.walletRejected;
  if (code === "walletBusy") return m.walletBusy;
  if (code === "simulationFailed") return m.simulationFailed;
  if (code === "receiptUnavailable") return m.receiptError;
  return m.submitError;
}

function statusText(receipt: Submission, m: Messages) {
  if (receipt.status === "success") return m.txSuccess;
  if (receipt.status === "pending") return m.txPending;
  if (receipt.status === "reverted") return m.txReverted;
  return m.txUnverified;
}

function Datum({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={muted}>{label}</dt>
      <dd style={{ ...mono, margin: "2px 0 0", fontSize: 15 }}>{children}</dd>
    </div>
  );
}

function buttonStyle(disabled: boolean, secondary = false): CSSProperties {
  return {
    minHeight: 44, borderRadius: 8, padding: "8px 16px", font: "inherit", fontSize: 14, fontWeight: 700,
    border: secondary ? "1px solid " + line : "0", background: secondary ? "transparent" : accent,
    color: secondary ? ink : "#0b1a12", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
  };
}

export function Launcher({ context, messages: m, host }: LauncherProps) {
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState<{ action: Action; account: string; valueWei?: string } | null>(null);
  const [result, setResult] = useState<{ account: string; action: Action; receipt: Submission } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const lock = useRef(false);

  const { identity, launcherAddress, snapshot } = context;
  const locale = context.locale || "en";
  const unknown = m.unavailable;
  const native = identity.chainId === 97 ? "tBNB" : "BNB";
  const bnb = (value: bigint | null) => (value === null ? unknown : decimal(value) + " " + native);

  const state = units(snapshot?.state);
  const minRaise = units(snapshot?.minRaise);
  const cap = units(snapshot?.cap);
  const committed = units(snapshot?.committed);
  const deadline = units(snapshot?.saleDeadline);
  const saleAmount = units(snapshot?.saleAmount);
  const retryUntil = units(snapshot?.launchRetryUntil);
  const contributors = units(snapshot?.contributorCount);
  const contribution = units(snapshot?.contribution);
  const refundDue = units(snapshot?.refundDue);
  const allocation = units(snapshot?.allocation);
  const token = snapshot?.token && addressPattern.test(snapshot.token) ? snapshot.token.toLowerCase() : null;
  const reserved = snapshot?.expectedToken && addressPattern.test(snapshot.expectedToken)
    ? snapshot.expectedToken.toLowerCase() : null;
  const vault = snapshot?.vault && addressPattern.test(snapshot.vault) ? snapshot.vault : null;
  const creator = snapshot?.creator && addressPattern.test(snapshot.creator) ? snapshot.creator : null;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const raising = state === 0n;
  const saleOpen = raising && deadline !== null && now < deadline;
  const awaitingFinalize = raising && deadline !== null && now >= deadline;
  const failed = state === 1n;
  const launched = state === 2n;
  const minReached = committed !== null && minRaise !== null && committed >= minRaise;
  const oversubscribed = committed !== null && cap !== null && committed > cap;

  const stateLabel = saleOpen ? m.stateOpen : awaitingFinalize ? m.stateAwaiting : failed ? m.stateFailed
    : launched ? m.stateLaunched : unknown;
  const stateColor = saleOpen || launched ? accent : failed ? bad : awaitingFinalize ? warn : soft;

  const progress = committed !== null && cap !== null && cap > 0n
    ? Number((committed > cap ? cap : committed) * 10_000n / cap) / 100 : null;
  const minMark = minRaise !== null && cap !== null && cap > 0n ? Number(minRaise * 10_000n / cap) / 100 : null;
  const priceLow = minRaise !== null && saleAmount !== null && saleAmount > 0n ? minRaise * unit / saleAmount : null;
  const priceHigh = cap !== null && saleAmount !== null && saleAmount > 0n ? cap * unit / saleAmount : null;

  const wallet = host?.wallet;
  const account = wallet?.account ? wallet.account.toLowerCase() : null;
  const wrongChain = !!wallet && wallet.chainId !== identity.chainId;
  const canTransact = !!launcherAddress && host?.available !== false && !!wallet && !!host?.submit;
  const ownResult = result && result.account === account ? result : null;
  const pendingHash = wallet?.pendingHash && hashPattern.test(wallet.pendingHash) ? wallet.pendingHash : null;
  const receipt: Submission | null = pendingHash && ownResult?.receipt.hash !== pendingHash
    ? { status: "pending", hash: pendingHash } : ownResult?.receipt ?? null;
  const waiting = receipt?.status === "pending" || receipt?.status === "unverified";
  const inputWei = parseBnb(amount);

  const ready: Record<Action, boolean> = {
    contribute: saleOpen && inputWei !== null && inputWei > 0n,
    finalize: awaitingFinalize,
    claimRefund: (failed || launched) && refundDue !== null && refundDue > 0n && snapshot?.refunded !== true,
  };
  const labels: Record<Action, string> = {
    contribute: m.contribute, finalize: m.finalize, claimRefund: m.claimRefund,
  };

  const chainSlug = identity.chainId === 97 ? "bnb-testnet" : "bnb";
  const taxInfoPath = typeof context.tokenTaxInfoHref === "string" && /^\/[A-Za-z0-9/_?=&.-]*$/.test(context.tokenTaxInfoHref)
    ? context.tokenTaxInfoHref : token ? "/" + chainSlug + "/" + token + "/taxinfo" : null;

  function openVault() {
    if (!taxInfoPath || !host?.redirect) { setRedirectFailed(true); return; }
    setRedirectFailed(host.redirect(taxInfoPath) !== true);
  }

  function edit(value: string) {
    setAmount(value);
    setReview(null);
    setError(null);
  }

  async function switchNetwork() {
    if (!wallet || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try { await wallet.switchChain(); }
    catch (cause) { setError(errorText(cause, m)); }
    finally { lock.current = false; setBusy(false); }
  }

  function start(action: Action) {
    if (!canTransact || !account || wrongChain || !ready[action] || waiting || lock.current) return;
    setError(null);
    setReview({ action, account, ...(action === "contribute" && inputWei !== null ? { valueWei: inputWei.toString() } : {}) });
  }

  function settle(next: Submission, owner: string, action: Action) {
    setResult({ account: owner, action, receipt: next });
    if (next.status === "success") {
      if (action === "contribute") setAmount("");
      host?.refresh?.();
    }
  }

  async function confirm() {
    if (!review || !canTransact || !ready[review.action] || waiting || lock.current || wrongChain
      || account !== review.account || (review.action === "contribute" && review.valueWei !== inputWei?.toString())) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    const { action, valueWei } = review;
    try {
      const sent = await host?.submit?.({ kind: "action", action, ...(valueWei === undefined ? {} : { valueWei }) });
      if (sent) settle(sent, review.account, action);
    } catch (cause) {
      setError(errorText(cause, m));
    } finally {
      setReview(null);
      lock.current = false;
      setBusy(false);
    }
  }

  async function recheck() {
    if (!account || !receipt || !hashPattern.test(receipt.hash) || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await host?.checkReceipt?.(receipt.hash);
      if (next) settle(next, account, ownResult?.action ?? "contribute");
    } catch (cause) {
      setError(errorText(cause, m));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const stale = !!review && (!ready[review.action] || review.account !== account || wrongChain);
  const offered = (["contribute", "finalize", "claimRefund"] as const).filter(action =>
    action === "contribute" ? saleOpen : ready[action]);

  return (
    <section style={shell} aria-label={m.title}>
      <header style={{ padding: pad, borderBlockEnd: "1px solid " + line, display: "flex", gap: 12, flexWrap: "wrap",
        justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: "clamp(20px, 4vw, 28px)", lineHeight: 1.2 }}>{m.title}</h2>
          <p style={{ ...muted, marginBlockStart: 6 }}>{m.intro}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 10px", borderRadius: 20, border: "1px solid " + stateColor, color: stateColor,
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{stateLabel}</span>
          <span style={{ padding: "3px 10px", borderRadius: 20, border: "1px solid " + line, color: soft, fontSize: 12,
            whiteSpace: "nowrap" }}>{identity.chainId === 97 ? m.networkTestnet : m.networkMainnet}</span>
        </div>
      </header>

      <div style={{ padding: pad, display: "grid", gap: 20 }}>
        {!launcherAddress ? <p role="status" style={muted}>{m.noInstance}</p> : (
          <>
            <div style={{ background: raised, border: "1px solid " + line, borderRadius: 12, padding: pad, display: "grid", gap: 10 }}>
              <p style={muted}>{m.committed}</p>
              <p style={{ ...mono, margin: 0, fontSize: "clamp(24px, 6vw, 36px)", fontWeight: 700, lineHeight: 1.15 }}>{bnb(committed)}</p>
              {progress !== null && (
                <div style={{ display: "grid", gap: 6 }}>
                  <div role="progressbar" aria-label={m.progress} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                    style={{ position: "relative", height: 10, borderRadius: 6, background: "#262c36", overflow: "hidden" }}>
                    <div style={{ width: progress + "%", height: "100%", background: minReached ? accent : warn }} />
                    {minMark !== null && minMark > 0 && minMark < 100 && (
                      <div style={{ position: "absolute", insetBlock: 0, insetInlineStart: minMark + "%", width: 2, background: ink }} />
                    )}
                  </div>
                  <p style={muted}>{progress + "% " + m.ofCap}{minReached ? " · " + m.minReached : ""}</p>
                </div>
              )}
              {oversubscribed && <p style={{ ...muted, color: warn }}>{m.oversubscribed}</p>}
              {!snapshot && <p role="status" style={muted}>{m.loading}</p>}
            </div>

            <dl style={grid}>
              <Datum label={m.minRaise}>{bnb(minRaise)}</Datum>
              <Datum label={m.cap}>{bnb(cap)}</Datum>
              <Datum label={m.saleEnds}>{when(deadline, locale, unknown)}</Datum>
              {contributors !== null && <Datum label={m.contributors}>{contributors.toString()}</Datum>}
              {saleAmount !== null && <Datum label={m.tokensForSale}>{decimal(saleAmount, 0)}</Datum>}
              {priceLow !== null && priceHigh !== null && (
                priceLow === priceHigh
                  ? <Datum label={m.salePriceFixed}>{decimal(priceLow, 10) + " " + native}</Datum>
                  : <Datum label={m.salePrice}>{decimal(priceLow, 10) + " – " + decimal(priceHigh, 10) + " " + native}</Datum>
              )}
              {launched && token ? <Datum label={m.token}><span title={token}>{short(token)}</span></Datum>
                : reserved ? <Datum label={m.reservedToken}><span title={reserved}>{short(reserved)}</span></Datum> : null}
            </dl>
            <p style={muted}>{m.rules}</p>

            {awaitingFinalize && (
              <p style={{ ...muted, color: warn }}>
                {minReached ? m.finalizeHint : committed !== null && minRaise !== null ? m.finalizeFailHint : m.finalizeUnknownHint}
                {retryUntil !== null ? " " + m.retryUntil + " " + when(retryUntil, locale, unknown) + "." : ""}
              </p>
            )}
            {failed && <p style={{ ...muted, color: bad }}>{m.failedHint}</p>}

            {launched && (
              <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                <p style={muted}>{m.launchedHint}</p>
                {taxInfoPath && host?.redirect && (
                  <button type="button" style={buttonStyle(false)} onClick={openVault}>{m.openVault}</button>
                )}
                {redirectFailed && <p role="status" style={muted}>{m.redirectFailed}</p>}
              </div>
            )}

            {canTransact ? (
              <section aria-label={m.participation}
                style={{ display: "grid", gap: 12, borderBlockStart: "1px solid " + line, paddingBlockStart: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>{m.participation}</h3>
                {account && (
                  <dl style={grid}>
                    <Datum label={m.yourCommitment}>{bnb(contribution)}</Datum>
                    {launched && <Datum label={m.yourAllocation}>{allocation === null ? unknown : decimal(allocation, 2)}</Datum>}
                    {(failed || launched) && <Datum label={m.yourRefund}>{snapshot?.refunded === true ? m.refundTaken : bnb(refundDue)}</Datum>}
                  </dl>
                )}
                {saleOpen && (
                  <label style={{ display: "grid", gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{m.amountLabel + " (" + native + ")"}</span>
                    <input name="contribution" value={amount} inputMode="decimal" maxLength={28} autoComplete="off"
                      disabled={busy || waiting} style={field} onChange={event => edit(event.target.value)} />
                    <span style={muted}>{m.contributeHelp}</span>
                  </label>
                )}
                {review && (
                  <div style={{ border: "1px solid " + line, borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
                    <h4 style={{ margin: 0 }}>{labels[review.action]}</h4>
                    {review.valueWei && <p style={{ ...mono, margin: 0 }}>{bnb(units(review.valueWei))}</p>}
                    {review.action === "finalize" && <p style={muted}>{m.finalizeGas}</p>}
                    <p style={muted}>{stale ? m.reviewChanged : m.confirmReady}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" disabled={busy || stale} style={buttonStyle(busy || stale)} onClick={() => void confirm()}>
                        {busy ? m.working : m.confirm}
                      </button>
                      <button type="button" disabled={busy} style={buttonStyle(busy, true)} onClick={() => setReview(null)}>{m.back}</button>
                    </div>
                  </div>
                )}
                {!review && !waiting && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!account ? (
                      <button type="button" style={buttonStyle(false)} onClick={() => wallet?.connect()}>{m.connectWallet}</button>
                    ) : wrongChain ? (
                      <button type="button" disabled={busy} style={buttonStyle(busy)} onClick={() => void switchNetwork()}>{m.switchChain}</button>
                    ) : offered.length ? offered.map(action => (
                      <button key={action} type="button" disabled={busy || !ready[action]} style={buttonStyle(busy || !ready[action])}
                        onClick={() => start(action)}>{busy ? m.working : labels[action]}</button>
                    )) : <p style={muted}>{m.nothingToDo}</p>}
                  </div>
                )}
                {error && <p role="alert" style={{ ...muted, color: bad }}>{error}</p>}
                {receipt && (
                  <div role="status" style={{ ...muted, display: "grid", gap: 4 }}>
                    <span>{statusText(receipt, m)}</span>
                    {hashPattern.test(receipt.hash) && <span style={mono}>{receipt.hash}</span>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {waiting && host?.checkReceipt && (
                    <button type="button" disabled={busy} style={buttonStyle(busy)} onClick={() => void recheck()}>{m.checkReceipt}</button>
                  )}
                  {host?.refresh && (
                    <button type="button" disabled={busy} style={buttonStyle(busy, true)} onClick={() => host?.refresh?.()}>{m.refresh}</button>
                  )}
                </div>
              </section>
            ) : (
              <p style={{ ...muted, borderBlockStart: "1px solid " + line, paddingBlockStart: 14 }}>{m.readOnly}</p>
            )}
          </>
        )}

        <details style={{ borderBlockStart: "1px solid " + line, paddingBlockStart: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700 }}>{m.contracts}</summary>
          <dl style={{ ...grid, marginBlockStart: 12 }}>
            <Datum label={m.factory}>{identity.factoryAddress}</Datum>
            {launcherAddress && <Datum label={m.launcher}>{launcherAddress}</Datum>}
            {creator && <Datum label={m.creator}>{creator}</Datum>}
            {vault && <Datum label={m.vault}>{vault}</Datum>}
            {token && <Datum label={m.token}>{token}</Datum>}
            {!token && reserved && <Datum label={m.reservedToken}>{reserved}</Datum>}
          </dl>
        </details>
      </div>
    </section>
  );
}
