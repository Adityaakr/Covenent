import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { Button } from "../../components/Button";
import { FAQList } from "../../components/FAQ";
import { faqs } from "../../content/faqs";
import s from "./HomeFAQ.module.css";

/** Framer section "FAQ" (kY7AleVo1). Questions: docs/DESIGN.md "Hard questions" via content/faqs. */
export function HomeFAQ() {
  return (
    <Section name="FAQ" contentClassName={s.content}>
      <div className={s.columns}>
        <div className={s.intro}>
          <Eyebrow className={s.fill}>Questions</Eyebrow>
          <h2 className={["t-h2", s.fill].join(" ")}>Hard questions, plain answers.</h2>
          <p className={["t-body", s.fill].join(" ")}>Can’t find yours? Read the rules or ask the team.</p>
          <Button variant="secondary" href="/contact">
            Contact us
          </Button>
        </div>
        <div className={s.list}>
          <FAQList items={faqs} />
        </div>
      </div>
    </Section>
  );
}
