import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { FAQList } from "../../components/FAQ";
import { faqs } from "../../content/faqs";
import s from "./PricingFAQ.module.css";

/** Pricing FAQ (K3KO0Dujw): heading left (340px), FAQ list right on desktop; stacked on tablet and phone. */
export function PricingFAQ() {
  return (
    <Section name="Pricing FAQ" contentClassName={s.content}>
      <div className={s.columns} data-framer-name="Pricing FAQ Columns">
        <div className={s.intro}>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="t-h2">Fees, in plain words.</h2>
        </div>
        <div className={s.list} data-framer-name="Pricing FAQ List">
          <FAQList items={faqs} />
        </div>
      </div>
    </Section>
  );
}
