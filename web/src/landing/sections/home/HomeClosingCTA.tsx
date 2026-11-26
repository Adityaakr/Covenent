import { Section } from "../../components/Section";
import { Button } from "../../components/Button";
import { ScrollLift } from "../../components/ScrollLift";
import s from "./HomeClosingCTA.module.css";

/** Framer section "Closing CTA" (HV9whzZS4). Not the Page CTA component: H1 heading, gap 28, padding 120 32,
 *  and its own scroll lift (y 40px, scale 0.96). Copy: content-plan.md "Closing CTA", DESIGN.md "Business model". */
export function HomeClosingCTA() {
  return (
    <Section name="Closing CTA" contentClassName={s.content}>
      <ScrollLift y={40} scale={0.96} className={s.plate}>
        <h2 className={["t-h1", s.heading].join(" ")}>Raise under rules. Exit at book.</h2>
        <p className={["t-lead c-text", s.body].join(" ")}>
          Covenant runs on Flap Pool Launch on BNB Chain. No fees for buyers or teams in v1.
        </p>
        <div className={s.actions}>
          <Button variant="secondary" size="lg" href="/features">
            Read the rules
          </Button>
          <Button variant="primary" size="lg" href="/app">
            Launch app
          </Button>
        </div>
      </ScrollLift>
    </Section>
  );
}
