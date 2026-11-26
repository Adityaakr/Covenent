import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { problemDemand, problemGroups } from "../../content/problem";
import s from "./HomeProblem.module.css";

/** The template's "Stats" section (s8Ki2GStV) grown into "The problem today": the same four-cell stat rows, one per
 *  group, under a heading group and a group title row (the Compare group pattern). Numbers: content/problem.ts. */
export function HomeProblem() {
  return (
    <Section name="Problem" id="problem" contentClassName={s.content}>
      <div className={s.intro}>
        <Eyebrow>The problem today</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="Money raised in public has no rules after launch."
          second="Buyers get no claim on what they paid, and AI agents now hold money with nobody to answer for it."
        />
      </div>
      {problemGroups.map((g) => (
        <div key={g.id} className={s.group}>
          <div className={s.groupHead}>
            <h3 className="t-h4">{g.title}</h3>
            <p className={["t-body", s.groupNote].join(" ")}>{g.note}</p>
          </div>
          <div className={s.row}>
            {g.stats.map((stat) => (
              <div key={stat.value} className={s.stat}>
                <p className={["t-h2", s.value].join(" ")}>{stat.value}</p>
                <p className="t-body">{stat.label}</p>
                <SourceLink href={stat.source.href} className={s.source}>
                  {stat.source.label}
                </SourceLink>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={s.demand}>
        <p className={["t-h2 c-accent", s.demandValue].join(" ")}>{problemDemand.value}</p>
        <div className={s.demandText}>
          <p className="t-lead c-text">{problemDemand.label}</p>
          <SourceLink href={problemDemand.source.href}>{problemDemand.source.label}</SourceLink>
        </div>
      </div>
    </Section>
  );
}
