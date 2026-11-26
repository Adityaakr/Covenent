import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { FeatureGrid, FeatureCard } from "../../components/FeatureGrid";
import {
  IconDoorOpen,
  IconFileText,
  IconHandCoins,
  IconHeartbeat,
  IconLockOpen,
  IconRocketLaunch,
} from "../features/icons";
import s from "./HomeLifecycle.module.css";

/* "How a covenant runs": the /features Capabilities pattern (heading group + six Feature Cards in the hairline grid).
   Steps: docs/DESIGN.md "Lifecycle", with the exit rule as built (contracts/src/vault/CovenantVault.sol: the streak
   decays instead of resetting and reads on-chain prices only). */
const steps = [
  {
    icon: <IconFileText size={18} />,
    title: "Create",
    body: "The team fixes the terms: supply split, minimum and cap, sale window, tap, unlock tranches, exit and heartbeat. Afterwards it can only lower the tap.",
  },
  {
    icon: <IconHandCoins size={18} />,
    title: "Raise",
    body: "Anyone commits BNB in the sale window. Commitments are not capped, so a raise can be oversubscribed.",
  },
  {
    icon: <IconRocketLaunch size={18} />,
    title: "Settle and launch",
    body: "Under the minimum, everyone is refunded in full. Over the cap, commitments scale down pro rata. Flap launches the token, seeds PancakeSwap at the sale price and the treasury moves into the vault.",
  },
  {
    icon: <IconHeartbeat size={18} />,
    title: "Operate",
    body: "Trading tax flows into the treasury, the team or agent draws its tap, and a keeper, or anyone, records prices about once an hour.",
  },
  {
    icon: <IconDoorOpen size={18} />,
    title: "Exit round",
    body: "Three days below book value opens a 7 day round where any holder can redeem at book. Time above book counts the streak down, so a one-hour pump cannot reset it.",
  },
  {
    icon: <IconLockOpen size={18} />,
    title: "Unlock or wind down",
    body: "Team tranches unlock after 30 trusted days at 2x, 4x and 8x. After 45 days of silence the treasury opens to holders for good.",
  },
];

export function HomeLifecycle() {
  return (
    <Section name="Lifecycle" id="lifecycle">
      <div className={s.headingGroup}>
        <Eyebrow>Lifecycle</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="From raise to exit, every step is a public call."
          second="Anyone can trigger the next transition. Nobody can skip one."
        />
      </div>
      <FeatureGrid>
        {steps.map((st, i) => (
          <FeatureCard
            key={st.title}
            icon={st.icon}
            title={
              <>
                <span className="c-text-2">{String(i + 1).padStart(2, "0")}</span> {st.title}
              </>
            }
            body={st.body}
          />
        ))}
      </FeatureGrid>
    </Section>
  );
}
