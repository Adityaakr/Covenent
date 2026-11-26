import { Section } from "../../components/Section";
import { IconQuotes } from "./icons";
import s from "./PricingQuote.module.css";

/** Pricing Quote (MoGsxAjpu): centred quote mark, H2 quote, Label attribution. */
export function PricingQuote() {
  return (
    <Section name="Pricing Quote" contentClassName={s.content}>
      <IconQuotes size={28} className={s.mark} />
      <h2 className={["t-h2", s.text].join(" ")}>That ties our income to launches that last.</h2>
      <p className={["t-label c-text-2", s.author].join(" ")}>Covenant · Business model</p>
    </Section>
  );
}
