import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { Button } from "../../components/Button";
import s from "./FeaturesHero.module.css";

/* Framer "Features Hero" ThwQrearH: page head (Section head), eyebrow, H1 max 900, Lead max 560, two buttons. */
export function FeaturesHero() {
  return (
    <Section name="Features Hero" head>
      <Eyebrow className={s.eyebrow}>Rules</Eyebrow>
      <h1 className={`t-h1 ${s.title}`}>Five rules that bind the team.</h1>
      <p className={`t-lead ${s.body}`}>
        Covenant writes investor protections into the launch, and they bind a human team or an AI agent the same way.
      </p>
      <div className={s.actions}>
        <Button variant="secondary" href="/contact">
          Talk to the team
        </Button>
        <Button variant="primary" href="/app">
          Launch app
        </Button>
      </div>
    </Section>
  );
}
