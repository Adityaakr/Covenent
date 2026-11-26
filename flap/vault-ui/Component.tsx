"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VaultComponentProps } from "@/src/sdk";
import { erc20Abi, formatPercentBps, formatTokenAmount, handleTxError, isActionAvailableForPhase, parseTokenAmount, readTaxVaultHostContext, useFlapSdk } from "@/src/sdk";
import { AddressLink, Alert, Button, Card, CardContent, CardHeader, CardTitle, Countdown, DataRow, Input, Metric, StatusBadge } from "@/src/ui";
import { vaultAbi } from "./VaultABI";

type Hex = `0x${string}`;
type TrancheTuple = readonly [amount: bigint, multiple: bigint, progress: bigint, unlocked: boolean, targetUsd: bigint];
type Tranche = { amount: bigint; multiple: bigint; progress: bigint; unlocked: boolean };
type Covenant = {
  state: number; taxToken: Hex; launcher: Hex; teamWallet: Hex;
  bookValue: bigint; freeTreasury: bigint; redeemableSupply: bigint; treasuryRaised: bigint; totalRevenue: bigint; totalRedeemed: bigint;
  exitFeeBps: number; exitStreak: bigint; exitStreakNeeded: number; roundEnd: bigint; cooldownEnd: bigint;
  heartbeatDeadline: bigint; abandonable: boolean;
  tapUsdPer30d: bigint; tapCapPer30d: bigint; owedTeam: bigint; tapPaid: bigint;
  unlockWindow: number; lockedTeam: bigint; unlockedUnreleased: bigint; teamReleased: bigint;
  tranches: Tranche[]; windDownCause: number | null; reportsPosted: bigint | null;
};
type Holder = { claimable: bigint; balance: bigint; allowance: bigint };
type ActionKey = "claimTokens" | "approve" | "redeem" | "declareAbandoned" | "releaseTeam" | "claimTap" | "heartbeat" | "lowerTap" | "postReport" | "windDown";

const ZERO = /^0x0{40}$/i;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const STATE_KEYS = ["states.raising", "states.failed", "states.active", "states.exitRound", "states.cooldown", "states.windDown"] as const;

function bnb(value: bigint | null | undefined, precision = 4) {
  return value === null || value === undefined ? "—" : formatTokenAmount(value, 18, precision);
}

/** Plain decimal with `digits` significant figures, for per-token values far below 1 (no exponent notation). */
function perToken(value: bigint | null | undefined, digits = 4) {
  if (value === null || value === undefined) return "—";
  if (value === 0n) return "0";
  const text = value.toString().padStart(19, "0");
  const whole = text.slice(0, -18).replace(/^0+(?=\d)/, "");
  const fraction = text.slice(-18);
  if (whole !== "0") return formatTokenAmount(value, 18, digits);
  const lead = fraction.search(/[1-9]/);
  return "0." + fraction.slice(0, lead + digits).replace(/0+$/, "");
}

function parseAmount(text: string) {
  try {
    const value = parseTokenAmount(text.trim(), 18);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

export default function CovenantVault(_props: VaultComponentProps) {
  const sdk = useFlapSdk();
  const { context, i18n, wallet } = sdk;
  const t = i18n.t;
  const host = readTaxVaultHostContext(context.host);
  const riskLevel = host.vaultInfo?.riskLevel ?? host.taxInfo?.vaultInfo?.riskLevel ?? null;
  const riskLabel = riskLevel === 1 ? t("risk.low") : riskLevel === 2 ? t("risk.lowMedium") : riskLevel === 3 ? t("risk.medium") : riskLevel === 4 ? t("risk.high") : riskLevel === 0 ? t("risk.unverified") : t("risk.missing");
  const riskTone = riskLevel === null || riskLevel === 0 || riskLevel >= 4 ? "danger" : riskLevel >= 3 ? "warning" : "success";
  // Covenant tokens launch straight into a DEX pool (Flap Pool Launch); the vault's rules do not depend on the market phase.
  const stageAvailable = isActionAvailableForPhase("both", host.marketPhase);
  const validVault = ADDRESS.test(context.vaultAddress) && !ZERO.test(context.vaultAddress);

  const [covenant, setCovenant] = useState<Covenant | null>(null);
  const [holder, setHolder] = useState<Holder | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [redeemText, setRedeemText] = useState("");
  const [preview, setPreview] = useState<bigint | null>(null);
  const [tapText, setTapText] = useState("");
  const [report, setReport] = useState({ period: "", uri: "", hash: "" });
  const [windDownArmed, setWindDownArmed] = useState(false);
  const lock = useRef(false);
  const revision = useRef(0);
  const txMessages = useMemo(() => ({ userRejected: t("errors.userRejected"), walletDisconnected: t("errors.walletDisconnected"), insufficientFunds: t("errors.insufficientFunds"), simulationFailed: t("errors.simulationFailed"), reverted: t("errors.reverted"), unknown: t("errors.transaction") }), [t]);

  const read = useCallback(<T,>(functionName: string, args: readonly unknown[] = []) =>
    sdk.readContract<T>({ contract: "vault", address: context.vaultAddress, abi: vaultAbi, functionName, args }), [context.vaultAddress, sdk]);

  const loadData = useCallback(async () => {
    const current = ++revision.current;
    if (!validVault) { setCovenant(null); setHolder(null); setLoading(false); setReadError(t("errors.binding")); return; }
    try {
      const [state, taxToken, launcher, teamWallet, bookValue, freeTreasury, redeemableSupply, treasuryRaised, totalRevenue, totalRedeemed] = await Promise.all([
        read<number>("state"), read<Hex>("taxToken"), read<Hex>("launcher"), read<Hex>("teamWallet"), read<bigint>("bookValue"),
        read<bigint>("freeTreasury"), read<bigint>("redeemableSupply"), read<bigint>("treasuryRaised"), read<bigint>("totalRevenue"), read<bigint>("totalRedeemed"),
      ]);
      if (current !== revision.current) return;
      if (taxToken.toLowerCase() !== context.tokenAddress.toLowerCase()) { setCovenant(null); setHolder(null); setReadError(t("errors.binding")); return; }
      const [exitFeeBps, exitStreak, exitStreakNeeded, roundEnd, cooldownEnd, heartbeatDeadline, abandonable, tapUsdPer30d, tapCapPer30d, owedTeam, tapPaid, unlockWindow, lockedTeam, unlockedUnreleased, teamReleased, trancheCount] = await Promise.all([
        read<number>("exitFeeBps"), read<bigint>("exitStreak"), read<number>("exitStreakNeeded"), read<bigint>("roundEnd"), read<bigint>("cooldownEnd"),
        read<bigint>("heartbeatDeadline"), read<boolean>("abandonable"), read<bigint>("tapUsdPer30d"), read<bigint>("tapCapPer30d"), read<bigint>("owedTeam"),
        read<bigint>("tapPaid"), read<number>("unlockWindow"), read<bigint>("lockedTeam"), read<bigint>("unlockedUnreleased"), read<bigint>("teamReleased"), read<bigint>("trancheCount"),
      ]);
      const count = Number(trancheCount > 8n ? 8n : trancheCount);
      const [tranches, windDownCause, reportsPosted] = await Promise.all([
        Promise.all(Array.from({ length: count }, (_, k) => read<TrancheTuple>("trancheProgress", [BigInt(k)]))),
        read<number>("windDownCause").catch(() => null),
        read<bigint>("reportsPosted").catch(() => null),
      ]);
      if (current !== revision.current) return;
      setCovenant({
        state: Number(state), taxToken, launcher, teamWallet, bookValue, freeTreasury, redeemableSupply, treasuryRaised, totalRevenue, totalRedeemed,
        exitFeeBps: Number(exitFeeBps), exitStreak, exitStreakNeeded: Number(exitStreakNeeded), roundEnd, cooldownEnd, heartbeatDeadline, abandonable,
        tapUsdPer30d, tapCapPer30d, owedTeam, tapPaid, unlockWindow: Number(unlockWindow), lockedTeam, unlockedUnreleased, teamReleased,
        tranches: tranches.map(([amount, multiple, progress, unlocked]) => ({ amount, multiple, progress, unlocked })),
        windDownCause: windDownCause === null ? null : Number(windDownCause), reportsPosted,
      });
      if (context.userAddress && !wallet.isWrongNetwork) {
        const user = context.userAddress;
        const [claimable, balance, allowance] = await Promise.all([
          read<bigint>("claimableTokens", [user]),
          sdk.readContract<bigint>({ contract: "token", address: context.tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [user] }),
          sdk.readContract<bigint>({ contract: "token", address: context.tokenAddress, abi: erc20Abi, functionName: "allowance", args: [user, context.vaultAddress] }),
        ]);
        if (current !== revision.current) return;
        setHolder({ claimable, balance, allowance });
      } else setHolder(null);
      setReadError(null);
    } catch {
      if (current === revision.current) { setCovenant(null); setHolder(null); setReadError(t("errors.read")); }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, [context.tokenAddress, context.userAddress, context.vaultAddress, read, sdk, t, validVault, wallet.isWrongNetwork]);

  useEffect(() => {
    setLoading(true); setCovenant(null); setHolder(null); setDone(null);
    void loadData();
    const timer = setInterval(() => void loadData(), 30000);
    return () => { clearInterval(timer); revision.current += 1; };
  }, [loadData, sdk.refetchNonce]);

  const state = covenant?.state ?? null;
  const redeemOpen = state === 3 || state === 5;
  const redeemWei = parseAmount(redeemText);

  useEffect(() => {
    let live = true;
    if (!redeemOpen || redeemWei === null || !validVault) { setPreview(null); return; }
    read<bigint>("previewRedeem", [redeemWei]).then(out => { if (live) setPreview(out); }).catch(() => { if (live) setPreview(null); });
    return () => { live = false; };
  }, [read, redeemOpen, redeemWei, validVault, covenant]);

  const isTeam = !!covenant && !!context.userAddress && covenant.teamWallet.toLowerCase() === context.userAddress.toLowerCase();
  const walletBlock = !validVault ? t("errors.binding") : wallet.isWrongNetwork ? t("states.wrongNetwork") : !context.userAddress || !wallet.isConnected ? t("states.connect") : !stageAvailable ? t("states.phaseUnavailable") : loading || !covenant ? t("states.loading") : null;

  async function send(key: ActionKey, functionName: string, args: readonly unknown[], success: string, target: "vault" | "token" = "vault") {
    if (walletBlock || lock.current) return;
    lock.current = true; setBusy(key); setTxError(null); setDone(null);
    try {
      const simulation = await sdk.simulateContract(target === "vault"
        ? { contract: "vault", address: context.vaultAddress, abi: vaultAbi, functionName, args }
        : { contract: "token", address: context.tokenAddress, abi: erc20Abi, functionName, args });
      const hash = await sdk.writeContract(simulation.request);
      const receipt = await sdk.waitForTx(hash);
      if (receipt.status !== "success") { setTxError(t("errors.reverted")); return; }
      setDone(success);
      sdk.notify.success(success);
      if (key === "redeem") setRedeemText("");
      if (key === "lowerTap") setTapText("");
      if (key === "postReport") setReport({ period: "", uri: "", hash: "" });
      if (key === "windDown") setWindDownArmed(false);
      await loadData();
    } catch (error) {
      setTxError(handleTxError(error, txMessages));
    } finally {
      lock.current = false; setBusy(null);
    }
  }

  const stateLabel = state === null ? t("states.unknown") : t(STATE_KEYS[state] ?? "states.unknown");
  const stateTone = state === 3 || state === 5 ? "warning" : state === 2 || state === 4 ? "success" : state === 1 ? "danger" : "neutral";
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const streakPct = covenant && covenant.exitStreakNeeded > 0 ? Math.min(100, Number(covenant.exitStreak * 100n / BigInt(covenant.exitStreakNeeded))) : null;
  const needsApproval = redeemWei !== null && holder !== null && holder.allowance < redeemWei;
  const overBalance = redeemWei !== null && holder !== null && redeemWei > holder.balance;
  const minOut = preview === null ? null : preview - preview / 100n;
  const tapNew = parseAmount(tapText);
  const reportReady = /^[1-9][0-9]{0,5}$/.test(report.period) && /^(ipfs|https):\/\/\S{3,}$/.test(report.uri) && HASH.test(report.hash);
  const causeLabel = covenant?.windDownCause === 1 ? t("labels.causeTeam") : covenant?.windDownCause === 2 ? t("labels.causeGuardian") : covenant?.windDownCause === 3 ? t("labels.causeAbandoned") : null;

  return <div className="w-full min-w-0 space-y-4">
    <Card className="overflow-hidden rounded-[18px] border-white/10 bg-black/25">
      <CardHeader className="space-y-3 p-4 pb-3 sm:p-5 sm:pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("title")}</CardTitle>
          <div className="flex flex-wrap gap-2"><StatusBadge tone={riskTone}>{riskLabel}</StatusBadge><StatusBadge tone={stateTone}>{stateLabel}</StatusBadge></div>
        </div>
        {riskLevel === null ? <Alert tone="danger">{t("notices.riskMissing")}</Alert> : riskLevel === 0 || riskLevel >= 4 ? <Alert tone="warning">{t("notices.review")}</Alert> : null}
        <p className="text-sm leading-6 text-white/60">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label={t("labels.bookValue")} value={covenant ? perToken(covenant.bookValue) : "—"} hint={t("units.bnbPerToken")} tone="primary" />
          <Metric label={t("labels.treasury")} value={covenant ? bnb(covenant.freeTreasury) : "—"} hint={t("units.bnb")} />
          <Metric label={t("labels.exitStreak")} value={streakPct === null ? "—" : streakPct + "%"} hint={t("hints.exitStreak")} />
        </div>

        <section aria-label={t("sections.holder")} className="space-y-3 rounded-[14px] border border-white/10 bg-black/30 p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-white">{t("sections.holder")}</h3>
          {walletBlock ? <Alert tone="warning">{walletBlock}</Alert> : null}
          {readError && readError !== walletBlock ? <Alert tone="danger">{readError}</Alert> : null}

          {holder && holder.claimable > 0n ? (
            <div className="space-y-2">
              <DataRow label={t("labels.claimable")} value={formatTokenAmount(holder.claimable, 18, 2) + " " + (context.tokenSymbol ?? "")} />
              <Button className="w-full" type="button" disabled={Boolean(walletBlock) || busy !== null} loading={busy === "claimTokens"} onClick={() => void send("claimTokens", "claimTokens", [], t("messages.claimed"))}>{t("actions.claimTokens")}</Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs leading-5 text-white/55">{redeemOpen ? (state === 5 ? t("notices.redeemWindDown") : t("notices.redeemRound")) : t("notices.redeemClosed")}</p>
            {state === 3 && covenant ? <DataRow label={t("labels.roundEnds")} value={<Countdown targetTimeMs={Number(covenant.roundEnd) * 1000} />} /> : null}
            {state === 4 && covenant ? <DataRow label={t("labels.cooldownEnds")} value={<Countdown targetTimeMs={Number(covenant.cooldownEnd) * 1000} />} /> : null}
            {redeemOpen ? <>
              <div className="flex gap-2">
                <Input name="redeemAmount" inputMode="decimal" value={redeemText} placeholder={t("labels.redeemAmount")} aria-label={t("labels.redeemAmount")} disabled={busy !== null} onChange={event => { setRedeemText(event.target.value); setDone(null); }} />
                <Button type="button" variant="outline" disabled={!holder || holder.balance === 0n || busy !== null} onClick={() => holder && setRedeemText(formatTokenAmount(holder.balance, 18, 18))}>{t("actions.max")}</Button>
              </div>
              <DataRow label={t("labels.balance")} value={holder ? formatTokenAmount(holder.balance, 18, 2) + " " + (context.tokenSymbol ?? "") : "—"} />
              <DataRow label={t("labels.youReceive")} value={preview === null ? "—" : bnb(preview, 8) + " " + t("units.bnb")} detail={state === 3 && covenant ? t("hints.exitFee") + " " + formatPercentBps(covenant.exitFeeBps) : t("hints.noFee")} />
              {overBalance ? <Alert tone="warning">{t("states.overBalance")}</Alert> : null}
              {needsApproval
                ? <Button className="w-full" type="button" disabled={Boolean(walletBlock) || overBalance || busy !== null} loading={busy === "approve"} onClick={() => redeemWei !== null && void send("approve", "approve", [context.vaultAddress, redeemWei], t("messages.approved"), "token")}>{t("actions.approve")}</Button>
                : <Button className="w-full" type="button" disabled={Boolean(walletBlock) || redeemWei === null || overBalance || minOut === null || minOut === 0n || busy !== null} loading={busy === "redeem"} onClick={() => redeemWei !== null && minOut !== null && void send("redeem", "redeem", [redeemWei, minOut], t("messages.redeemed"))}>{t("actions.redeem")}</Button>}
              <p className="text-xs leading-5 text-white/55">{t("hints.slippage")}</p>
            </> : null}
          </div>

          {covenant && (covenant.abandonable || covenant.unlockedUnreleased > 0n) ? (
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {covenant.abandonable ? <Button type="button" variant="destructive" disabled={Boolean(walletBlock) || busy !== null} loading={busy === "declareAbandoned"} onClick={() => void send("declareAbandoned", "declareAbandoned", [], t("messages.abandoned"))}>{t("actions.declareAbandoned")}</Button> : null}
              {covenant.unlockedUnreleased > 0n ? <Button type="button" variant="secondary" disabled={Boolean(walletBlock) || busy !== null} loading={busy === "releaseTeam"} onClick={() => void send("releaseTeam", "releaseTeam", [], t("messages.released"))}>{t("actions.releaseTeam")}</Button> : null}
            </div>
          ) : null}
          {done ? <Alert tone="success">{done}</Alert> : null}
          {txError ? <Alert tone="danger">{txError}</Alert> : null}
          <Button variant="outline" type="button" disabled={loading || busy !== null} onClick={() => { setLoading(true); void loadData(); }}>{t("actions.refresh")}</Button>
        </section>

        {isTeam && covenant ? (
          <section aria-label={t("sections.team")} className="space-y-3 rounded-[14px] border border-white/10 bg-black/30 p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-white">{t("sections.team")}</h3>
            <p className="text-xs leading-5 text-white/55">{t("notices.teamOnly")}</p>
            <DataRow label={t("labels.owedTeam")} value={bnb(covenant.owedTeam, 6) + " " + t("units.bnb")} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={Boolean(walletBlock) || covenant.owedTeam === 0n || busy !== null} loading={busy === "claimTap"} onClick={() => void send("claimTap", "claimTap", [], t("messages.tapClaimed"))}>{t("actions.claimTap")}</Button>
              <Button type="button" variant="secondary" disabled={Boolean(walletBlock) || state === 5 || busy !== null} loading={busy === "heartbeat"} onClick={() => void send("heartbeat", "heartbeat", [], t("messages.heartbeat"))}>{t("actions.heartbeat")}</Button>
            </div>
            <div className="flex gap-2">
              <Input name="newTapUsd" inputMode="decimal" value={tapText} placeholder={t("labels.newTap")} aria-label={t("labels.newTap")} disabled={busy !== null} onChange={event => setTapText(event.target.value)} />
              <Button type="button" variant="outline" disabled={Boolean(walletBlock) || tapNew === null || tapNew >= covenant.tapUsdPer30d || state === 5 || busy !== null} loading={busy === "lowerTap"} onClick={() => tapNew !== null && void send("lowerTap", "lowerTap", [tapNew], t("messages.tapLowered"))}>{t("actions.lowerTap")}</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="reportPeriod" inputMode="numeric" value={report.period} placeholder={t("labels.reportPeriod")} aria-label={t("labels.reportPeriod")} disabled={busy !== null} onChange={event => setReport({ ...report, period: event.target.value.trim() })} />
              <Input name="reportUri" value={report.uri} placeholder={t("labels.reportUri")} aria-label={t("labels.reportUri")} disabled={busy !== null} onChange={event => setReport({ ...report, uri: event.target.value.trim() })} />
              <Input name="reportHash" value={report.hash} placeholder={t("labels.reportHash")} aria-label={t("labels.reportHash")} disabled={busy !== null} onChange={event => setReport({ ...report, hash: event.target.value.trim() })} />
            </div>
            <Button type="button" variant="outline" disabled={Boolean(walletBlock) || !reportReady || busy !== null} loading={busy === "postReport"} onClick={() => void send("postReport", "postReport", [BigInt(report.period), report.uri, report.hash as Hex], t("messages.reportPosted"))}>{t("actions.postReport")}</Button>
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs leading-5 text-white/55">{t("notices.windDown")}</p>
              {windDownArmed
                ? <Button type="button" variant="destructive" disabled={Boolean(walletBlock) || state === 5 || busy !== null} loading={busy === "windDown"} onClick={() => void send("windDown", "windDown", [], t("messages.woundDown"))}>{t("actions.confirmWindDown")}</Button>
                : <Button type="button" variant="outline" disabled={state === 5 || busy !== null} onClick={() => setWindDownArmed(true)}>{t("actions.windDown")}</Button>}
            </div>
          </section>
        ) : null}

        <details className="border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-sm text-white/70">{t("sections.rules")}</summary>
          {covenant ? <div className="mt-3 space-y-2">
            <DataRow label={t("labels.tapBudget")} value={formatTokenAmount(covenant.tapUsdPer30d, 18, 2) + " " + t("units.usdPer30d")} detail={t("hints.tapCap") + " " + bnb(covenant.tapCapPer30d, 6) + " " + t("units.bnb")} />
            <DataRow label={t("labels.tapPaid")} value={bnb(covenant.tapPaid, 6) + " " + t("units.bnb")} detail={t("labels.owedTeam") + " " + bnb(covenant.owedTeam, 6)} />
            {covenant.tranches.map((tranche, k) => (
              <DataRow key={k} label={t("labels.tranche") + " " + (k + 1) + " · " + (Number(tranche.multiple) / 100) + "×"} value={tranche.unlocked ? t("states.unlocked") : Math.min(100, covenant.unlockWindow > 0 ? Number(tranche.progress * 100n / BigInt(covenant.unlockWindow)) : 0) + "%"} detail={formatTokenAmount(tranche.amount, 18, 0) + " " + (context.tokenSymbol ?? "")} />
            ))}
            <DataRow label={t("labels.teamTokens")} value={formatTokenAmount(covenant.lockedTeam, 18, 0)} detail={t("labels.released") + " " + formatTokenAmount(covenant.teamReleased, 18, 0)} />
            <DataRow label={t("labels.heartbeat")} value={state === 5 ? (causeLabel ?? t("states.windDown")) : covenant.heartbeatDeadline > nowSec ? <Countdown targetTimeMs={Number(covenant.heartbeatDeadline) * 1000} /> : t("states.lapsed")} detail={t("hints.heartbeat")} />
            <DataRow label={t("labels.treasuryRaised")} value={bnb(covenant.treasuryRaised) + " " + t("units.bnb")} detail={t("labels.revenue") + " " + bnb(covenant.totalRevenue) + " · " + t("labels.redeemed") + " " + bnb(covenant.totalRedeemed)} />
            <DataRow label={t("labels.redeemableSupply")} value={formatTokenAmount(covenant.redeemableSupply, 18, 0)} />
            {covenant.reportsPosted !== null ? <DataRow label={t("labels.reports")} value={covenant.reportsPosted.toString()} /> : null}
            <DataRow label={t("labels.teamWallet")} value={<AddressLink address={covenant.teamWallet} explorerBaseUrl={context.explorerBaseUrl} />} />
            <DataRow label={t("labels.launcher")} value={<AddressLink address={covenant.launcher} explorerBaseUrl={context.explorerBaseUrl} />} />
            <DataRow label={t("labels.vault")} value={<AddressLink address={context.vaultAddress} explorerBaseUrl={context.explorerBaseUrl} />} />
            <p className="text-xs leading-6 text-white/55">{t("notices.guardian")}</p>
          </div> : <p className="mt-3 text-xs text-white/55">{loading ? t("states.loading") : t("errors.read")}</p>}
        </details>
      </CardContent>
    </Card>
  </div>;
}
