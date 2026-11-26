import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { voices } from "../../content/voices";
import s from "./HomeVoices.module.css";

/** "Who named this problem": the template's Quote Wall (IcGzhspnz) on the Surface band, one card per voice.
 *  Quotes are exact and linked; a paraphrase carries a label and no quotation marks (content/voices.ts). */
export function HomeVoices() {
  return (
    <Section name="Who named this problem" id="research" surface>
      <div className={s.headingGroup}>
        <Eyebrow>Who named this problem</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="The gap has been on the record for years."
          second="Researchers, investors and BNB Chain itself have described it."
        />
      </div>
      <div className={s.grid}>
        {voices.map((v) => (
          <figure key={v.href} className={s.card}>
            <div className={s.top}>
              {v.paraphrase ? (
                <span className={s.tag}>
                  <span className="t-small c-text-2">Paraphrase</span>
                </span>
              ) : null}
              <blockquote className="t-lead c-text">{v.paraphrase ? v.quote : `“${v.quote}”`}</blockquote>
              <figcaption className={s.author}>
                <p className="t-label">{v.who}</p>
                <p className="t-small c-text-2">
                  {v.role} {" · "} {v.date}
                </p>
              </figcaption>
            </div>
            <div className={s.answer}>
              <p className="t-small c-accent">Covenant’s answer</p>
              <p className="t-body">{v.answer}</p>
              <SourceLink href={v.href}>{v.sourceLabel}</SourceLink>
            </div>
          </figure>
        ))}
      </div>
    </Section>
  );
}
