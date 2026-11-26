import Link from "next/link";
import { Section } from "../../components/Section";
import { formatLongDate } from "./format";
import { sortedMilestones } from "./data";
import { IconArrowRight } from "./icons";
import { ReleaseCover } from "./ReleaseCover";
import s from "./ChangelogList.module.css";

/** Changelog List Section (ULaxwbd1g): Release List over the Changelog collection, Date descending. */
export function ChangelogList() {
  const items = sortedMilestones();
  return (
    <Section name="Changelog List Section" noBorder contentClassName={s.content}>
      <div className={s.list} data-framer-name="Release List">
        {items.map((m) => (
          <Link key={m.slug} href={`/changelog/${m.slug}`} className={s.entry} data-framer-name="Release Entry">
            <div className={s.meta}>
              <p className={["t-label c-text-2", s.date].join(" ")}>{formatLongDate(m.date)}</p>
              <span className={s.version}>
                <span className="t-small c-text-2">v</span>
                <span className="t-small c-text-2">{m.version}</span>
              </span>
            </div>
            <div className={s.body}>
              <ReleaseCover src={m.cover} alt="" />
              <span className={s.tag}>
                <span className={s.dot} />
                <span className="t-small c-accent">{m.tag}</span>
              </span>
              <h2 className={["t-h3", s.title].join(" ")}>{m.title}</h2>
              <p className={["t-body", s.summary].join(" ")}>{m.summary}</p>
              <span className={s.read}>
                <span className="t-label">Read the full update</span>
                <IconArrowRight size={14} className="c-text" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
