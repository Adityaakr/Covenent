import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import s from "./PricingHero.module.css";

/** Pricing Hero (OMMwJ34Qn): page head section, no top border. */
export function PricingHero() {
  return (
    <Section name="Pricing Hero" head>
      <Eyebrow className={s.eyebrow}>Fees</Eyebrow>
      <h1 className={["t-h1 c-text", s.title].join(" ")}>No fees for buyers or teams in v1.</h1>
      <p className={["t-lead", s.body].join(" ")}>
        Covenant earns through fee paths already built into Flap and OpenFour, paid on trading volume.
      </p>
    </Section>
  );
}
