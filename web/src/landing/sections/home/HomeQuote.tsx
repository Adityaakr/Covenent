import { Section } from "../../components/Section";
import { useCases } from "../../content/useCases";
import s from "./HomeQuote.module.css";

/* Phosphor regular "Quotes", width 1.5, accent. */
function IconQuotes() {
  return (
    <svg width={32} height={32} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M108,144H40a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40" />
      <path d="M224,144H156a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40" />
    </svg>
  );
}

/** Framer section "Quote" (TEBvGuPxi): one Stories CMS item filtered by Featured = true (content/useCases). */
export function HomeQuote() {
  const item = useCases.filter((u) => u.featured).slice(0, 1);
  return (
    <Section name="Quote" contentClassName={s.content}>
      <div className={s.list}>
        {item.map((u) => (
          <figure key={u.slug} className={s.item}>
            <span className={s.mark}>
              <IconQuotes />
            </span>
            <blockquote className={["t-h2", s.text].join(" ")}>{u.quote}</blockquote>
            <figcaption className={s.author}>
              <p className="t-label">{u.quoteAuthor}</p>
              <p className="t-label c-text-2">·</p>
              <p className="t-label c-text-2">{u.quoteRole}</p>
              <p className="t-label c-text-2">{u.name}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
