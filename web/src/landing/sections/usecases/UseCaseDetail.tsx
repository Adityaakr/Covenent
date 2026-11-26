import { Section } from "../../components/Section";
import { ScrollLift } from "../../components/ScrollLift";
import type { UseCase } from "../../content/useCases";
import { BackLink } from "./HoverCard";
import { ArrowLeft, Quotes } from "./marks";
import s from "./UseCaseDetail.module.css";

/** Story Header (vqGTbvIk6): back link, mark + name, H1 title (max 960), Lead summary (max 640). */
export function UseCaseHeader({ u }: { u: UseCase }) {
  return (
    <Section name="Story Header" noBorder contentClassName={s.headerContent}>
      <BackLink href="/use-cases" className={s.back}>
        <ArrowLeft size={14} />
        <span className="t-label c-text-2">All use cases</span>
      </BackLink>
      <div className={s.company}>
        <span className={s.markWrap}>{u.mark}</span>
        <h4 className="t-h4">{u.name}</h4>
      </div>
      <h1 className={["t-h1", s.title].join(" ")}>{u.headline}</h1>
      <p className={["t-lead", s.summary].join(" ")}>{u.summary}</p>
    </Section>
  );
}

/** Story Cover Section (iCjZlM32b): cover photo, radius 20, scroll lift y 32 scale 0.98. */
export function UseCaseCover({ u }: { u: UseCase }) {
  return (
    <Section name="Story Cover Section" noBorder contentClassName={s.coverContent}>
      <ScrollLift className={s.coverLift}>
        <img className={s.cover} src={u.cover} alt="" width={1600} height={1067} />
      </ScrollLift>
    </Section>
  );
}

/** Story Body (KFy_4VWTm): sticky facts column (Category, Who, Key term) + rich text. */
export function UseCaseBody({ u }: { u: UseCase }) {
  return (
    <Section name="Story Body" contentClassName={s.bodyContent}>
      <div className={s.columns}>
        <div className={s.facts}>
          <div className={s.fact}>
            <p className="t-small c-text-2">Category</p>
            <p className="t-label">{u.category}</p>
          </div>
          <div className={s.fact}>
            <p className="t-small c-text-2">Who</p>
            <p className="t-label">{u.who}</p>
          </div>
          <div className={s.fact}>
            <p className="t-small c-text-2">Key term</p>
            <h4 className="t-h4 c-accent">{u.result}</h4>
          </div>
          <p className="t-small c-text-2">{u.resultLabel}</p>
        </div>
        <div className={s.rich}>
          {u.body.map((b, i) =>
            b.h2 ? (
              <h2 key={i} className="t-h3">
                {b.h2}
              </h2>
            ) : (
              <p key={i} className="t-lead">
                {b.p}
              </p>
            ),
          )}
        </div>
      </div>
    </Section>
  );
}

/** Story Quote (mAKo9YoHo): surface band, accent quote mark, H2 quote, author + role. */
export function UseCaseQuote({ u }: { u: UseCase }) {
  return (
    <Section name="Story Quote" surface contentClassName={s.quoteContent}>
      <Quotes size={28} className={s.quoteMark} />
      <h2 className={["t-h2", s.quoteText].join(" ")}>{u.quote}</h2>
      <div className={s.quoteAuthor}>
        <p className="t-label">{u.quoteAuthor}</p>
        <p className="t-label c-text-2">{u.quoteRole}</p>
      </div>
    </Section>
  );
}
