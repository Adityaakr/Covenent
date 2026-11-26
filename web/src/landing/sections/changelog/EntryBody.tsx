import type { Milestone } from "../../content/milestones";
import { Section } from "../../components/Section";
import { EntrySubscribe } from "./EntrySubscribe";
import s from "./Entry.module.css";

/** Entry Body (E3rEIs7fH): top border; content padding 120 64 / 96 48 / 64 20, gap 56 / 56 / 36, centred.
 *  Entry Rich Text: max width 680; Heading 2 uses Text/H3, Paragraph uses Text/Lead. */
export function EntryBody({ m }: { m: Milestone }) {
  return (
    <Section name="Entry Body" contentClassName={s.bodyContent}>
      <div className={s.rich}>
        {m.body.map((b, i) =>
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
      <EntrySubscribe />
    </Section>
  );
}
