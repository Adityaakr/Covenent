import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { FAQList } from "../../components/FAQ";
import { faqs } from "../../content/faqs";
import s from "./ContactFAQ.module.css";

/** Contact FAQ (vBRO6vLHq): heading group (gap 20) and FAQ List limited to 4 items, gap 32 / 32 / 36. */
export function ContactFAQ() {
  return (
    <Section name="Contact FAQ" contentClassName={s.content}>
      <div className={s.group}>
        <Eyebrow className={s.full}>Before you write</Eyebrow>
        <h2 className={["t-h2 c-text", s.heading].join(" ")}>Quick answers.</h2>
      </div>
      <FAQList items={faqs.slice(0, 4)} />
    </Section>
  );
}
