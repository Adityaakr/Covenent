import { Section } from "../../components/Section";
import { Button } from "../../components/Button";
import s from "./NotFound.module.css";

/** Not Found (C4_2vGJ02): centred; code (Small, Accent), H1 max 820, Lead max 520, two buttons (40px), gap 10. */
export function NotFound() {
  return (
    <Section name="Not Found" head contentClassName={s.content}>
      <p className={["t-small c-accent", s.full].join(" ")}>404</p>
      <h1 className={["t-h1", s.title].join(" ")}>This page left in an exit round.</h1>
      <p className={["t-lead", s.body].join(" ")}>The link may be old. The rules are still where you left them.</p>
      <div className={s.actions}>
        <Button variant="secondary" href="/changelog">
          Read the milestones
        </Button>
        <Button variant="primary" href="/">
          Back to home
        </Button>
      </div>
    </Section>
  );
}
