import type { RuleName, UseCase } from "../../content/useCases";
import { IconDoorOpen, IconFileText, IconHandCoins, IconHeartbeat, IconLockOpen } from "../features/icons";
import s from "./RuleList.module.css";

const icons: Record<RuleName, React.ReactNode> = {
  Tap: <IconHandCoins size={16} />,
  "Performance unlock": <IconLockOpen size={16} />,
  "Book-value exit": <IconDoorOpen size={16} />,
  "Abandonment switch": <IconHeartbeat size={16} />,
  Disclosure: <IconFileText size={16} />,
};

/** The five rules applied to one case: Feature Card icon box (Surface, 1px Border, radius 10) at 32px, rule name
 *  in Label, the effect in Body, hairline between rows (FAQ list rhythm). */
export function RuleList({ u }: { u: UseCase }) {
  return (
    <ul className={s.list}>
      {u.rules.map((r) => (
        <li key={r.rule} className={s.item}>
          <span className={s.icon} aria-hidden="true">
            {icons[r.rule]}
          </span>
          <div className={s.text}>
            <p className="t-label">{r.rule}</p>
            <p className="t-body">{r.how}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
