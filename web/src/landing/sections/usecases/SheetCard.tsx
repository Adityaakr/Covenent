import type { UseCase } from "../../content/useCases";
import s from "./SheetCard.module.css";
import { bnb } from "../../components/Bnb";

/** Illustrative covenant sheet for a use case, drawn like the home "Raise" panel: a white card with the photo-card
 *  shadow on a Surface plate (radius 20), header row, then label / value rows with hairlines. Numbers are examples. */
export function SheetCard({ u, plate = true }: { u: UseCase; plate?: boolean }) {
  const card = (
    <div className={s.card} role="group" aria-label={`${u.sheet.title}, illustrative covenant sheet`}>
      <div className={s.header}>
        <span className={s.markWrap} aria-hidden="true">
          {u.mark}
        </span>
        <p className={["t-label", s.grow].join(" ")}>{bnb(u.sheet.title)}</p>
        <span className={s.chip}>
          <span className="t-small c-text-2">{bnb(u.sheet.state)}</span>
        </span>
      </div>
      <dl className={s.rows}>
        {u.sheet.rows.map((r) => (
          <div key={r.label} className={s.row}>
            <dt className="t-small c-text-2">{bnb(r.label)}</dt>
            <dd className={["t-small", s.value].join(" ")}>{bnb(r.value)}</dd>
          </div>
        ))}
      </dl>
      <p className={["t-small c-text-2", s.foot].join(" ")}>Illustrative numbers, default terms. Not a live covenant.</p>
    </div>
  );
  return plate ? <div className={s.plate}>{bnb(card)}</div> : card;
}
