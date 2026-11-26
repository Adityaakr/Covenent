import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { FeatureIndex } from "./features/FeatureIndex";
import { ExitPanel, RaisePanel, SheetPanel, TeamPanel } from "./features/Panels";
import s from "./features/HomeFeatures.module.css";

/* Framer Home (augiA20Il) section "Features" (ZN5NVUdId). Spec: docs/landing/spec/home-a.md.
   Copy and sources: docs/landing/content/home-a.md. */

const index = ["Raise with refunds", "Read the sheet", "Pay the team", "Exit at book"];
const targets = ["feature-1", "feature-2", "feature-3", "feature-4"];

const blocks = [
  {
    id: "feature-1",
    first: "Raise with refunds built in.",
    second: "Above the cap, each commitment is scaled down pro rata and the excess is refunded.",
    panel: <RaisePanel />,
  },
  {
    id: "feature-2",
    first: "Every rule on one sheet.",
    second: "Each rule shows a meter and its next event, readable without a wallet.",
    panel: <SheetPanel />,
  },
  {
    id: "feature-3",
    first: "A budget, never the treasury.",
    second: "The team claims a capped tap and can lower it, but nobody can raise it.",
    panel: <TeamPanel />,
  },
  {
    id: "feature-4",
    first: "Exit at book when the price fails.",
    second: "The exit compares two on-chain numbers, pool price and treasury per token, and works with no oracle.",
    panel: <ExitPanel />,
  },
];

export function HomeFeatures() {
  return (
    <Section name="Features" contentClassName={s.content}>
      <div className={s.intro}>
        <Eyebrow>How Covenant works</Eyebrow>
        <SplitHeading
          as="h2"
          className={s.heading}
          first="Five rules, fixed at launch."
          second="Money goes in, rules hold it, holders get it back if it fails."
        />
      </div>
      <div className={s.body}>
        <div className={s.indexColumn}>
          <FeatureIndex items={index} targets={targets} />
        </div>
        <div className={s.blocks}>
          {blocks.map((b) => (
            <div key={b.id} id={b.id} className={s.block}>
              <SplitHeading as="h3" className={s.statement} first={b.first} second={b.second} />
              {b.panel}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
