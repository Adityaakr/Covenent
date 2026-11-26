import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SubscribeForm } from "./SubscribeForm";
import s from "./ChangelogHero.module.css";

/** Changelog Hero (Bfj_6uiqZ): eyebrow, two-run H1, subscribe form, note. Left aligned. */
export function ChangelogHero() {
  return (
    <Section name="Changelog Hero" head contentClassName={s.content}>
      <Eyebrow className={s.full}>Milestones</Eyebrow>
      <SplitHeading
        as="h1"
        className={s.title}
        first="Built in public, gate by gate."
        second="Three gates in 36 hours, then Demo Night on Nov 27."
      />
      <SubscribeForm />
      <p className={["t-small c-text-2", s.full].join(" ")}>One note per gate. This testnet build stores no emails.</p>
    </Section>
  );
}
