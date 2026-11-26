import { Icon, type IconName } from "./icons";
import s from "./AppWindow.module.css";

/* Hero "App Window" (LKGAwSLlP) rebuilt as the covenant sheet. Every number is from docs/DESIGN.md
   ("Rule card" table, "Rule 1: tap"); sources are listed in docs/landing/content/home-a.md. */

const nav: { label: string; icon: IconName; active?: boolean }[] = [
  { label: "Covenants", icon: "house" },
  { label: "Raise", icon: "tray" },
  { label: "Sheet", icon: "scroll", active: true },
  { label: "Redeem", icon: "redeem" },
  { label: "Agent", icon: "robot" },
  { label: "Trust", icon: "shieldCheck" },
];

const covenants = [
  { label: "Agent issuer", dot: "accent" },
  { label: "Human team", dot: "text" },
  { label: "Launchpad", dot: "text2" },
] as const;

const tabs = ["Rules", "Treasury", "Ledger", "Trust"];
const columns = ["Day 0", "Day 30", "Day 60"];

type Row = {
  name: string;
  /* desktop timeline bar: offset and width in px, as in the template rows */
  offset: number;
  width: number;
  bar: "done" | "accent" | "outline";
  label: string;
  /* phone list: right-hand text and progress fill (% of track, 0 = empty) */
  due: string;
  fill: number;
  fillTone?: "done" | "accent";
};

const rows: Row[] = [
  { name: "Raise settled", offset: 0, width: 150, bar: "done", label: "Done", due: "Done", fill: 100, fillTone: "done" },
  { name: "Pool seeded", offset: 90, width: 190, bar: "done", label: "Done", due: "Done", fill: 100, fillTone: "done" },
  /* 4.1 BNB claimable against the 15 BNB month-one cap (4% of 375 BNB) = 27.3% */
  { name: "Tap", offset: 170, width: 260, bar: "accent", label: "4.1 BNB claimable", due: "4.1 BNB claimable", fill: 27.3, fillTone: "accent" },
  /* 2x tranche: 11 of 30 trusted days = 36.7% */
  { name: "Unlock 2x", offset: 240, width: 230, bar: "accent", label: "11 of 30 days", due: "11 of 30 days", fill: 36.7, fillTone: "accent" },
  { name: "Exit streak", offset: 390, width: 170, bar: "outline", label: "Opens in 1 day 4 hours", due: "Opens in 1 day 4 hours", fill: 0 },
  { name: "Heartbeat", offset: 520, width: 110, bar: "outline", label: "Last active 6 days ago", due: "Last active 6 days ago", fill: 0 },
  { name: "Report", offset: 590, width: 130, bar: "outline", label: "Due in 12 days", due: "Due in 12 days", fill: 0 },
];

const avatars = [
  { initials: "IS", title: "Issuer agent", tone: "accent" },
  { initials: "IN", title: "Investor agent", tone: "text" },
  { initials: "KP", title: "Keeper agent", tone: "text2" },
] as const;

export function AppWindow() {
  return (
    <>
      <div className={s.bar}>
        <span className={s.dot} />
        <span className={s.dot} />
        <span className={s.dot} />
        <p className={["t-small", "c-text-2", s.address].join(" ")}>covenant.app / AGENT covenant</p>
        <span className={s.barSpacer} />
      </div>
      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.workspace}>
            <span className={s.mark}>
              <span className={s.markDot} />
            </span>
            <p className={["t-label", s.grow].join(" ")}>Covenant</p>
            <Icon name="caretDown" size={12} className={s.iconMuted} />
          </div>
          <div className={s.search}>
            <Icon name="search" size={13} className={s.iconMuted} />
            <p className={["t-small", "c-text-2", s.grow].join(" ")}>Search</p>
            <p className="t-small c-text-2">⌘K</p>
          </div>
          <span className={s.gap8} />
          {nav.map((n) => (
            <div key={n.label} className={[s.navItem, n.active ? s.navActive : ""].join(" ")}>
              <Icon name={n.icon} size={15} className={n.active ? s.iconStrong : s.iconMuted} />
              <p className={["t-small", n.active ? "" : "c-text-2", s.grow].join(" ")}>{n.label}</p>
            </div>
          ))}
          <span className={s.gap14} />
          <p className="t-small c-text-2">Your covenants</p>
          <span className={s.gap4} />
          {covenants.map((c) => (
            <div key={c.label} className={s.project}>
              <span className={[s.projectDot, s[`tone_${c.dot}`]].join(" ")} />
              <p className={["t-small", s.grow].join(" ")}>{c.label}</p>
            </div>
          ))}
        </aside>

        <div className={s.main}>
          <div className={s.header}>
            <div className={s.titleGroup}>
              <p className="t-h4">Covenant sheet</p>
              <span className={s.headerChip}>
                <span className="t-small c-text-2">ACTIVE</span>
              </span>
            </div>
            <div className={s.headerActions}>
              <div className={s.avatars}>
                {avatars.map((a) => (
                  <span key={a.initials} className={[s.avatar, s[`tone_${a.tone}`]].join(" ")} title={a.title}>
                    <span className="t-small c-bg">{a.initials}</span>
                  </span>
                ))}
              </div>
              <span className={s.share}>
                <span className="t-small">Poke</span>
              </span>
            </div>
          </div>

          <div className={s.tabs}>
            {tabs.map((t, i) => (
              <div key={t} className={s.tab}>
                <p className={["t-small", i === 0 ? "" : "c-text-2"].join(" ")}>{t}</p>
                <span className={[s.underline, i === 0 ? s.underlineOn : ""].join(" ")} />
              </div>
            ))}
          </div>

          <div className={s.timeline}>
            <div className={s.months}>
              <span className={s.labelCol} />
              {columns.map((m) => (
                <div key={m} className={s.month}>
                  <p className="t-small c-text-2">{m}</p>
                </div>
              ))}
            </div>
            {rows.map((r) => (
              <div key={r.name} className={s.row}>
                <div className={s.rowLabel}>
                  <p className={["t-small", s.trunc].join(" ")}>{r.name}</p>
                </div>
                <div className={s.track}>
                  {r.offset > 0 ? <span className={s.offset} style={{ width: r.offset }} /> : null}
                  <span className={[s.timeBar, s[`bar_${r.bar}`]].join(" ")} style={{ width: r.width }}>
                    <span className={["t-small", s.trunc].join(" ")}>{r.label}</span>
                  </span>
                </div>
              </div>
            ))}
            <span className={s.todayLine} />
            <span className={s.todayChip}>
              <span className="t-small c-bg">Today</span>
            </span>
          </div>

          <div className={s.phoneTimeline}>
            {rows.map((r) => (
              <div key={r.name} className={s.phoneRow}>
                <div className={s.phoneTop}>
                  <p className={["t-small", s.grow].join(" ")}>{r.name}</p>
                  <p className="t-small c-text-2">{r.due}</p>
                </div>
                <span className={s.phoneTrack}>
                  {r.fill > 0 ? (
                    <span
                      className={[s.phoneFill, r.fillTone === "accent" ? s.fillAccent : s.fillDone].join(" ")}
                      style={{ width: `${r.fill}%` }}
                    />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
