import { Section } from "../../components/Section";
import { plans, plansNote } from "../../content/plans";
import { PlanCard } from "./PlanCard";
import s from "./Plans.module.css";

/** Plans (FxGBNmDH8): no top border, sits under the hero. Plans Grid (onPsR6Z5S) over the Plans CMS sorted by Order. */
export function Plans() {
  return (
    <Section name="Plans" noBorder contentClassName={s.content}>
      <div className={s.grid} data-framer-name="Plans Grid">
        {plans.map((p) => (
          <PlanCard key={p.slug} plan={p} />
        ))}
      </div>
      <p className={["t-small c-text-2", s.note].join(" ")}>{plansNote}</p>
    </Section>
  );
}
