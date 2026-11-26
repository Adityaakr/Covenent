import { Button } from "./Button";
import { ScrollLift } from "./ScrollLift";
import s from "./PageCTA.module.css";

type CTAAction = { label: string; href: string };
export type PageCTAProps = { heading: string; body: string; primary: CTAAction; secondary: CTAAction };

/** Framer component Page CTA (fSTDtB1cM): Desktop / Tablet / Phone. Section shell with a 24px content pad
 *  and a photo plate (radius 24/24/18, padding 96 32 / 96 32 / 72 20, gap 24) that scroll-lifts. */
export function PageCTA({ heading, body, primary, secondary }: PageCTAProps) {
  return (
    <section className={s.section} data-framer-name="Page CTA">
      <div className={s.inner}>
        <div className={s.content}>
          <ScrollLift className={s.plate}>
            <h2 className={["t-h2", s.heading].join(" ")}>{heading}</h2>
            <p className={["t-lead c-text", s.body].join(" ")}>{body}</p>
            <div className={s.actions}>
              <Button variant="secondary" size="lg" href={secondary.href}>
                {secondary.label}
              </Button>
              <Button variant="primary" size="lg" href={primary.href}>
                {primary.label}
              </Button>
            </div>
          </ScrollLift>
        </div>
      </div>
    </section>
  );
}
