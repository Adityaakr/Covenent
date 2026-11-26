import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { ScrollLift } from "../../components/ScrollLift";
import { IconBell, IconCheckCircle } from "./icons";
import s from "./ExitTimeline.module.css";

/* Framer "Dependencies" BFBxV929S: two columns, text with a check list, and a Surface panel of timeline bars
   with a dark note bar (scroll lift y 32, scale 0.98). Content: the exit round timeline (DESIGN.md "Rule 3"). */
const points = [
  "Compares pool price with treasury per token, both on-chain",
  "Any holder can burn tokens for a share of the treasury",
  "The tap pauses while the round is open",
];

/* Offsets and widths are the template's bar geometry. */
const bars = [
  { label: "Exit streak · 3 trusted days", offset: "0%", width: "46%", accent: false },
  { label: "Exit round · 7 days", offset: "30%", width: "56%", accent: true },
  { label: "Cooldown · 14 days", offset: "62%", width: "38%", accent: false },
];

export function ExitTimeline() {
  return (
    <Section name="Dependencies" contentClassName={s.content}>
      <div className={s.columns}>
        <div className={s.text}>
          <Eyebrow>Book-value exit</Eyebrow>
          <SplitHeading
            as="h3"
            className={s.heading}
            first="An exit that runs on a clock."
            second="Three trusted days below book open a 7 day round. A 14 day cooldown follows before it can arm again."
          />
          {points.map((p) => (
            <div key={p} className={s.point}>
              <IconCheckCircle size={18} className={s.pointIcon} />
              <p className={`t-label ${s.pointText}`}>{p}</p>
            </div>
          ))}
        </div>
        <ScrollLift className={s.visual} y={32} scale={0.98}>
          {bars.map((b) => (
            <div key={b.label} className={s.row}>
              <div className={s.offset} style={{ width: b.offset }} />
              <div className={`${s.bar} ${b.accent ? s.barAccent : ""}`} style={{ width: b.width }}>
                <p className={`t-small ${b.accent ? "c-bg" : ""} ${s.barText}`}>{b.label}</p>
              </div>
            </div>
          ))}
          <div className={s.note}>
            <IconBell size={16} className={s.noteIcon} />
            <p className={`t-small c-bg ${s.noteText}`}>Round open. A holder redeemed 6,000,000 tokens for 2.534 BNB.</p>
          </div>
        </ScrollLift>
      </div>
    </Section>
  );
}
