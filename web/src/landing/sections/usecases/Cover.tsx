import type { ReactNode } from "react";
import { bnb } from "../../components/Bnb";
import type { UseCase } from "../../content/useCases";
import s from "./Cover.module.css";

/* Use-case covers: one shared background (the hero's soft sky plate, same crop and vignette everywhere) and one large
   product card per case, in the hero App Window's style. Live HTML, so text stays crisp at every size: the card scales
   with the cover through container query units (Cover.module.css). Numbers match each case's illustrative sheet
   (content/useCases.tsx) and are labelled illustrative there and on the sheet. */

type Tone = "accent" | "ok" | "text" | "muted";

function Head({ title, chip }: { title: string; chip: string }) {
  return (
    <div className={s.head}>
      <p className={s.title}>{title}</p>
      <span className={s.chip}>{chip}</span>
    </div>
  );
}

function Key({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className={s.key}>
      <p className={s.label}>{label}</p>
      <p className={s.value}>{value}</p>
      {note ? <p className={s.note}>{note}</p> : null}
    </div>
  );
}

function Meter({ fill, marker }: { fill: number; marker?: number }) {
  return (
    <div className={s.meter} aria-hidden="true">
      <span className={s.meterFill} style={{ width: `${fill}%` }} />
      {marker !== undefined ? <span className={s.meterMark} style={{ left: `${marker}%` }} /> : null}
    </div>
  );
}

function Row({ label, value, tone = "text" }: { label: ReactNode; value: ReactNode; tone?: Tone }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>
        {tone === "ok" ? <span className={[s.dot, s.dotOk].join(" ")} /> : null}
        {tone === "accent" ? <span className={[s.dot, s.dotAccent].join(" ")} /> : null}
        {label}
      </span>
      <span className={[s.rowValue, tone === "accent" ? s.accent : ""].join(" ")}>{value}</span>
    </div>
  );
}

const moments: Record<string, () => ReactNode> = {
  "ai-agent-working-capital": () => (
    <>
      <Head title="Agent operating budget" chip="ACTIVE" />
      <Key label="Tap" value="$12,000 / 30 days" note={bnb("Capped at 4% of a 225 BNB treasury")} />
      <Meter fill={36} />
      <Row label="Claimed this period" value="$4,300" />
      <Row label="Heartbeat" value="2 minutes ago" tone="ok" />
    </>
  ),
  "community-round": () => (
    <>
      <Head title="Community round" chip="SETTLED" />
      <Key label="Committed" value={bnb("1,400 BNB")} note="2.8x oversubscribed" />
      <Meter fill={100} marker={35.7} />
      <Row label="Cap" value={bnb("500 BNB")} />
      <Row label="Refunded pro rata" value={bnb("900 BNB")} tone="accent" />
    </>
  ),
  "gpu-inference-agent": () => (
    <>
      <Head title="Compute ledger" chip="PERIOD 4" />
      <Key label="GPU-hours bought" value="1,920" note={bnb("7.6 of 12 BNB compute budget spent")} />
      <Meter fill={63} />
      <Row label="Inference revenue" value={bnb("+3.4 BNB")} tone="accent" />
      <Row label="Sent to the vault" value="Book value up" />
    </>
  ),
  "machines-that-own-themselves": () => (
    <>
      <Head title="Charging network vault" chip="ACTIVE" />
      <Key label="Upkeep tap" value={bnb("4.5 BNB")} note="per 30 days, 4% of the treasury" />
      <Row label="Revenue in" value={bnb("+1.2 BNB this week")} tone="accent" />
      <Row label="45-day switch" value="Armed · pinged 3 min ago" tone="ok" />
    </>
  ),
  "launchpad-protected-tier": () => (
    <>
      <Head title="Launches" chip="PROTECTED TIER" />
      <div className={s.table} role="table" aria-label="Launch list">
        <div className={[s.tr, s.th].join(" ")} role="row">
          <span role="columnheader">Token</span>
          <span role="columnheader">Protected</span>
          <span role="columnheader">Floor</span>
        </div>
        {[
          ["NOVA", true, "60%"],
          ["ORBIT", true, "60%"],
          ["GRID", true, "55%"],
          ["PEPEX", false, "None"],
        ].map(([t, p, f]) => (
          <div key={t as string} className={[s.tr, p ? "" : s.trOff].join(" ")} role="row">
            <span role="cell" className={s.token}>
              {t}
            </span>
            <span role="cell" className={p ? s.yes : s.no}>
              {p ? "✓ Covenant" : "No terms"}
            </span>
            <span role="cell">{f}</span>
          </div>
        ))}
      </div>
    </>
  ),
};

/** The cover for one use case. The parent sets its height; the card scales with its width. */
export function Cover({ u, className }: { u: UseCase; className?: string }) {
  const moment = moments[u.slug];
  return (
    <div className={[s.cover, className ?? ""].filter(Boolean).join(" ")} role="img" aria-label={`${u.sheet.title}: an illustrative covenant card`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.plate} src="/landing/home/hero-plate.jpg" alt="" width={2048} height={1550} loading="lazy" />
      <span className={s.vignette} aria-hidden="true" />
      <div className={s.window} aria-hidden="true">
        <div className={s.bar}>
          <span />
          <span />
          <span />
        </div>
        <div className={s.body}>{moment ? moment() : null}</div>
      </div>
    </div>
  );
}
