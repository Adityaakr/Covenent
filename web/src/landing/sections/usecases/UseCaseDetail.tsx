import { Section } from "../../components/Section";
import { ScrollLift } from "../../components/ScrollLift";
import type { UseCase } from "../../content/useCases";
import { BackLink } from "./HoverCard";
import { SourceLink } from "../../components/SourceLink";
import { ArrowLeft, Quotes } from "./marks";
import { RuleList } from "./RuleList";
import { SheetCard } from "./SheetCard";
import { Cover } from "./Cover";
import s from "./UseCaseDetail.module.css";
import { bnb } from "../../components/Bnb";

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
        <h4 className="t-h4">{bnb(u.name)}</h4>
      </div>
      <h1 className={["t-h1", s.title].join(" ")}>{bnb(u.headline)}</h1>
      <p className={["t-lead", s.summary].join(" ")}>{bnb(u.summary)}</p>
    </Section>
  );
}

/** Story Cover Section (iCjZlM32b): cover photo, radius 20, scroll lift y 32 scale 0.98. */
export function UseCaseCover({ u }: { u: UseCase }) {
  return (
    <Section name="Story Cover Section" noBorder contentClassName={s.coverContent}>
      <ScrollLift className={s.coverLift}>
        <div className={s.cover}>
          <Cover u={u} />
        </div>
      </ScrollLift>
    </Section>
  );
}

/** Story Body (KFy_4VWTm): sticky facts column (Category, Who, Key term) + rich text, here the case's structured
 *  fields with the rule list and the illustrative sheet as blocks in the text column. */
export function UseCaseBody({ u }: { u: UseCase }) {
  return (
    <Section name="Story Body" contentClassName={s.bodyContent}>
      <div className={s.columns}>
        <div className={s.facts}>
          <div className={s.fact}>
            <p className="t-small c-text-2">Category</p>
            <p className="t-label">{bnb(u.category)}</p>
          </div>
          <div className={s.fact}>
            <p className="t-small c-text-2">Who</p>
            <p className="t-label">{bnb(u.who)}</p>
          </div>
          <div className={s.fact}>
            <p className="t-small c-text-2">Key term</p>
            <h4 className="t-h4 c-accent">{bnb(u.result)}</h4>
          </div>
          <p className="t-small c-text-2">{bnb(u.resultLabel)}</p>
        </div>
        <div className={s.rich}>
          <h2 className="t-h3">The situation</h2>
          <p className="t-lead">{bnb(u.situation)}</p>
          <h2 className="t-h3">What goes wrong today</h2>
          <p className="t-lead">{bnb(u.today)}</p>
          <div className={s.sources}>
            {u.todaySources.map((src) => (
              <SourceLink key={src.href} href={src.href}>
                {bnb(src.label)}
              </SourceLink>
            ))}
          </div>
          <h2 className="t-h3">How the five rules handle it</h2>
          <div className={s.block}>
            <RuleList u={u} />
          </div>
          <h2 className="t-h3">The covenant sheet</h2>
          <div className={s.block}>
            <SheetCard u={u} />
          </div>
          <h2 className="t-h3">What it does not do</h2>
          <p className="t-lead">{bnb(u.limit)}</p>
        </div>
      </div>
    </Section>
  );
}

/** Story Quote (mAKo9YoHo): surface band, accent quote mark, H2 quote, author + role. */
export function UseCaseQuote({ u }: { u: UseCase }) {
  if (!u.quote) return null;
  return (
    <Section name="Story Quote" surface contentClassName={s.quoteContent}>
      <Quotes size={28} className={s.quoteMark} />
      <h2 className={["t-h2", s.quoteText].join(" ")}>{bnb(u.quote)}</h2>
      <div className={s.quoteAuthor}>
        <p className="t-label">{bnb(u.quoteAuthor ?? "")}</p>
        <p className="t-label c-text-2">{bnb(u.quoteRole ?? "")}</p>
      </div>
    </Section>
  );
}
