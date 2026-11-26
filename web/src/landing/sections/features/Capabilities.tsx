import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { FeatureGrid, FeatureCard } from "../../components/FeatureGrid";
import { IconDoorOpen, IconFileText, IconHandCoins, IconHeartbeat, IconLockOpen, IconRobot } from "./icons";
import s from "./Capabilities.module.css";

/* Framer "Capabilities" zkFX9RJ2I: heading group + six Feature Cards in the hairline grid (scroll lift y 32, scale 0.98).
   Cards: the five rules and the agent layer (DESIGN.md "What the rules do", "The rules in detail", "Agent layer"). */
const cards = [
  { icon: <IconHandCoins size={18} />, title: "Tap", body: "A dollar budget per 30 days, capped at 4% of the treasury." },
  { icon: <IconLockOpen size={18} />, title: "Performance unlock", body: "Team tokens unlock at 2x, 4x and 8x, held 30 trusted days." },
  { icon: <IconDoorOpen size={18} />, title: "Book-value exit", body: "Price below treasury per token for 3 days opens a round. Time above book counts it down." },
  { icon: <IconHeartbeat size={18} />, title: "Abandonment switch", body: "After 45 days of team silence, the treasury opens to holders." },
  { icon: <IconFileText size={18} />, title: "Disclosure (stretch)", body: "A missed or failed period report pauses the tap until cured." },
  { icon: <IconRobot size={18} />, title: "Agent layer", body: "An AI issuer’s key reaches its accrued tap and nothing else." },
];

export function Capabilities() {
  return (
    <Section name="Capabilities">
      <div className={s.headingGroup}>
        <Eyebrow>The five rules</Eyebrow>
        <SplitHeading
          as="h2"
          className={s.heading}
          first="Five rules, fixed at launch."
          second={"Each one is a formula over numbers the vault reads\u00a0on-chain."}
        />
      </div>
      {/* FeatureGrid carries the grid's scroll lift (y 32, scale 0.98). */}
      <FeatureGrid>
        {cards.map((c) => (
          <FeatureCard key={c.title} icon={c.icon} title={c.title} body={c.body} />
        ))}
      </FeatureGrid>
    </Section>
  );
}
