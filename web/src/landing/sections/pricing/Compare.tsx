import { Fragment } from "react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { compareColumns, compareFirstHeader, compareGroups } from "./compareData";
import { SourceLink } from "../../components/SourceLink";
import type { Source } from "../../content/problem";
import s from "./Compare.module.css";

function Cell({ value }: { value: string }) {
  const tone = value === "✓" ? "c-accent" : value === "–" ? "c-text-2" : "";
  return <p className={["t-small", tone, s.cell].filter(Boolean).join(" ")}>{value}</p>;
}

export type CompareProps = {
  eyebrow?: string;
  first?: string;
  second?: string;
  id?: string;
  /** A line under the table, with its sources. */
  note?: { text: string; sources: Source[] };
};

/** Compare (d5j5gROy9): heading group, then a table with a sticky header row (Compare Header, top 64px),
 *  three groups of rows, row hover fill. The home page reuses it with its own heading. */
export function Compare({
  eyebrow = "Prior art",
  first = "Same promise, different engine.",
  second = "What a holder can do when it fails.",
  id,
  note,
}: CompareProps = {}) {
  return (
    <Section name="Compare" id={id}>
      <div className={s.headingGroup}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <SplitHeading as="h2" className={s.heading} first={first} second={second} />
      </div>
      <div className={s.wrap} data-framer-name="Compare Table Wrap">
        <div className={s.table} role="table" data-framer-name="Compare Table">
          <div className={s.header} role="row" data-framer-name="Compare Header">
            <p className={["t-label", s.nameCol].join(" ")} role="columnheader">
              {compareFirstHeader}
            </p>
            {compareColumns.map((c) => (
              <p key={c} className={["t-label", s.cell].join(" ")} role="columnheader">
                {c}
              </p>
            ))}
          </div>
          {compareGroups.map((g) => (
            <Fragment key={g.title}>
              <div className={s.group} role="row">
                <h4 className={["t-h4", s.groupTitle].join(" ")} role="rowheader">
                  {g.title}
                </h4>
              </div>
              {g.rows.map((r) => (
                <div key={r.name} className={s.row} role="row">
                  <p className={["t-small", s.nameCol].join(" ")} role="rowheader">
                    {r.name}
                  </p>
                  {r.cells.map((v, i) => (
                    <Cell key={i} value={v} />
                  ))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      {note ? (
        <div className={s.note}>
          <p className="t-small c-text-2">{note.text}</p>
          <div className={s.noteLinks}>
            {note.sources.map((src) => (
              <SourceLink key={src.href} href={src.href}>
                {src.label}
              </SourceLink>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}
