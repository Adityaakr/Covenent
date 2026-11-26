import { Section } from "../../components/Section";
import { SplitHeading } from "../../components/SplitHeading";
import { Eyebrow } from "../../components/Eyebrow";
import { ScrollLift } from "../../components/ScrollLift";
import { useCases, type UseCase } from "../../content/useCases";
import { HoverCard } from "./HoverCard";
import { ArrowRight } from "./marks";
import s from "./UseCases.module.css";

const href = (u: UseCase) => `/use-cases/${u.slug}`;

/** Customers Hero (L9fI8vxK1): page head, eyebrow + two-run H1 (max 900, balance, centred). */
export function UseCasesHero() {
  return (
    <Section name="Customers Hero" head>
      <Eyebrow className={s.heroEyebrow}>Use cases</Eyebrow>
      <SplitHeading
        as="h1"
        className={s.heroTitle}
        first="Raises that bind the team."
        second="From AI agents to launchpads."
      />
    </Section>
  );
}

/** Featured Story (QMXtE7I4A): the featured CMS item as a horizontal card that scroll-lifts. */
export function FeaturedUseCase() {
  const u = useCases.find((x) => x.featured) ?? useCases[0];
  if (!u) return null;
  return (
    <Section name="Featured Story" noBorder contentClassName={s.featuredContent}>
      <ScrollLift>
        <HoverCard href={href(u)} kind="featured" className={s.featuredCard}>
          <img className={s.featuredCover} src={u.cover} alt="" width={1600} height={1066} />
          <div className={s.featuredText}>
            <div className={s.company}>
              <span className={s.featuredMarkWrap}>{u.mark}</span>
              <p className="t-label">{u.name}</p>
            </div>
            <h2 className="t-h2">{u.headline}</h2>
            <p className="t-lead">{u.summary}</p>
            <div className={s.result}>
              <h2 className={["t-h2 c-accent", s.resultValue].join(" ")}>{u.result}</h2>
              <p className="t-body">{u.resultLabel}</p>
            </div>
            <span className={s.read}>
              <span className="t-label">Read the use case</span>
              <ArrowRight size={14} />
            </span>
          </div>
        </HoverCard>
      </ScrollLift>
    </Section>
  );
}

/** Customer Stats (YZNdciN1E): four cells, covenant default terms (DESIGN.md Appendix A). */
const stats = [
  { value: "60%", label: "of the sale price backed by the treasury at launch" },
  { value: "4%", label: "of the treasury per 30 days, the most the tap can pay" },
  { value: "3 days", label: "trusted, below book value, open an exit round" },
  { value: "45 days", label: "of team silence open the treasury to holders" },
];
export function UseCaseStats() {
  return (
    <Section name="Customer Stats" contentClassName={s.statsContent}>
      <div className={s.statsRow}>
        {stats.map((st) => (
          <div key={st.value} className={s.stat}>
            <h2 className="t-h2">{st.value}</h2>
            <p className="t-body">{st.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** All Stories (AZfREECh_): heading group + grid of every CMS item. */
export function AllUseCases() {
  return (
    <Section name="All Stories">
      <div className={s.headingGroup}>
        <Eyebrow>Use cases</Eyebrow>
        <SplitHeading
          className={s.sectionHeading}
          first="One vault, the same five rules."
          second="Six ways to put them to work."
        />
      </div>
      <div className={s.storiesGrid}>
        {useCases.map((u) => (
          <HoverCard key={u.slug} href={href(u)} kind="story" className={s.storyCard}>
            <img className={s.storyCover} src={u.cover} alt="" width={1600} height={1067} loading="lazy" />
            <div className={s.storyMeta}>
              <div className={s.company}>
                <span className={s.storyMarkWrap}>{u.mark}</span>
                <p className="t-label">{u.name}</p>
                <p className={["t-small c-text-2", s.storyIndustry].join(" ")}>{u.category}</p>
              </div>
              <h4 className="t-h4">{u.headline}</h4>
              <p className="t-body">{u.summary}</p>
            </div>
          </HoverCard>
        ))}
      </div>
    </Section>
  );
}

/** Quote Wall (IcGzhspnz): surface band, CMS items 2 to 4 (offset 1, limit 3). */
export function QuoteWall() {
  return (
    <Section name="Quote Wall" surface>
      <div className={s.headingGroup}>
        <Eyebrow>Jobs to be done</Eyebrow>
        <SplitHeading
          className={s.sectionHeading}
          first="What each side needs from a raise."
          second="Written as jobs, answered by rules."
        />
      </div>
      <div className={s.quotesGrid}>
        {useCases.slice(1, 4).map((u) => (
          <div key={u.slug} className={s.quoteCard}>
            <p className="t-lead c-text">{u.quote}</p>
            <div className={s.quoteAuthor}>
              <p className="t-label">{u.quoteAuthor}</p>
              <p className="t-small c-text-2">{u.quoteRole}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
