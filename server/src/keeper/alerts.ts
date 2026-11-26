import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Alert, CovenantSheet } from '../schema.js';

/** Alerts derived from a sheet. Ids are stable per situation so restarts and repeat ticks do not re-alert. */
export function alertsFor(s: CovenantSheet, now: number): Alert[] {
  const out: Alert[] = [];
  const v = s.vault;
  const { exit, heartbeat } = s;
  if (s.state === 'ACTIVE' && exit.progress !== null && exit.progress >= 0.25 && exit.streakSeconds) {
    const quarter = Math.min(3, Math.floor(exit.progress * 4));
    out.push({
      id: `${v}:exit-streak:round${exit.roundsOpened}:q${quarter}`,
      kind: 'exit-streak-building',
      vault: v,
      at: now,
      message: `Exit streak at ${(exit.progress * 100).toFixed(0)}% (${exit.streakSeconds}s of ${exit.targetSeconds}s below book). ${
        exit.etaSeconds !== null ? `Round opens in about ${exit.etaSeconds}s of observed time if the price stays below book.` : ''
      }`.trim(),
      data: { streakSeconds: exit.streakSeconds, targetSeconds: exit.targetSeconds, premiumToBookPct: s.premiumToBookPct },
    });
  }
  if (s.state === 'EXIT_ROUND') {
    out.push({
      id: `${v}:round-open:${exit.roundEndsAt}`,
      kind: 'exit-round-open',
      vault: v,
      at: now,
      message: `Exit round open: holders can redeem at book value (${s.bookValueBnb} BNB per token) until ${exit.roundEndsAt}.`,
      data: { roundEndsAt: exit.roundEndsAt, bookValueWei: s.bookValueWei },
    });
  }
  if (heartbeat.abandonable) {
    out.push({
      id: `${v}:abandonable:${heartbeat.lastAt}`,
      kind: 'abandonable',
      vault: v,
      at: now,
      message: `The team or agent has been silent ${heartbeat.ageSeconds}s, past its ${heartbeat.windowSeconds}s window. Anyone can call declareAbandoned().`,
      data: { lastAt: heartbeat.lastAt, windowSeconds: heartbeat.windowSeconds },
    });
  } else if (
    heartbeat.ageSeconds !== null &&
    heartbeat.windowSeconds &&
    heartbeat.ageSeconds >= 0.8 * heartbeat.windowSeconds &&
    s.state !== 'WIND_DOWN' &&
    s.state !== 'FAILED'
  ) {
    out.push({
      id: `${v}:heartbeat-due:${heartbeat.lastAt}`,
      kind: 'heartbeat-due',
      vault: v,
      at: now,
      message: `Heartbeat due: last team action ${heartbeat.ageSeconds}s ago, window ${heartbeat.windowSeconds}s. Any team action resets it.`,
      data: { lastAt: heartbeat.lastAt, dueAt: heartbeat.dueAt },
    });
  }
  return out;
}

/** Sinks: stdout, a JSONL file the API serves, and an optional webhook. Deduplicated by id across restarts. */
export class Alerter {
  private seen = new Set<string>();
  constructor(
    private file: string,
    private webhook?: string,
    private log: (msg: string) => void = (m) => console.log(m),
  ) {
    mkdirSync(path.dirname(file), { recursive: true });
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          this.seen.add((JSON.parse(line) as Alert).id);
        } catch {
          /* skip torn line */
        }
      }
    }
  }

  async emit(a: Alert): Promise<boolean> {
    if (this.seen.has(a.id)) return false;
    this.seen.add(a.id);
    appendFileSync(this.file, JSON.stringify(a) + '\n');
    this.log(`[alert] ${a.kind} ${a.vault}: ${a.message}`);
    if (this.webhook) {
      try {
        await fetch(this.webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: `Covenant ${a.kind}: ${a.message}`, alert: a }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch (e) {
        this.log(`[alert] webhook failed: ${(e as Error).message}`);
      }
    }
    return true;
  }
}

export function readAlerts(file: string, vault?: string): Alert[] {
  if (!existsSync(file)) return [];
  const out: Alert[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const a = JSON.parse(line) as Alert;
      if (!vault || a.vault.toLowerCase() === vault.toLowerCase()) out.push(a);
    } catch {
      /* skip */
    }
  }
  return out;
}
