import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { IconKey, IconLock, IconScales, IconShieldCheck } from "./icons";
import s from "./TrustAssumptions.module.css";

/* Framer "Security" LNQvhFLFo: Surface band, heading group, four items with a 2px Accent left border.
   Content: trust assumptions (DESIGN.md "Trust assumptions, all shown on the covenant sheet"). */
const items = [
  { icon: <IconKey size={20} />, title: "No admin keys", body: "No owner, no pause and no fee switch." },
  { icon: <IconShieldCheck size={20} />, title: "Guardian upgrades only", body: "Flap’s Guardian is the only path to upgrade a vault." },
  { icon: <IconScales size={20} />, title: "Exit needs no oracle", body: "Atlas cannot open or block a round. Both prices are on-chain." },
  { icon: <IconLock size={20} />, title: "Liquidity locked", body: "The PancakeSwap V2 pair is locked at launch and cannot be pulled." },
];

export function TrustAssumptions() {
  return (
    <Section name="Security" surface>
      <div className={s.headingGroup}>
        <Eyebrow>Trust assumptions</Eyebrow>
        <SplitHeading
          as="h2"
          className={s.heading}
          first="Trust assumptions, stated up front."
          second="Every one is shown on the covenant sheet, in plain words."
        />
      </div>
      <div className={s.row}>
        {items.map((it) => (
          <div key={it.title} className={s.item}>
            <span className={s.icon}>{it.icon}</span>
            <h4 className={`t-h4 ${s.title}`}>{it.title}</h4>
            <p className={`t-body ${s.body}`}>{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
