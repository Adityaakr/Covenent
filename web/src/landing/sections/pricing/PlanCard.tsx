"use client";
import { motion } from "motion/react";
import { Button } from "../../components/Button";
import { planStatusLabel, type Plan } from "../../content/plans";
import { IconCheck } from "./icons";
import s from "./Plans.module.css";

/* Plan Card hover (xw5HmDWe9): y -4px, scale 1.1, shadow 0px 24px 48px -24px rgba(21,23,28,0.22), spring 0.35s bounce 0. */
const rest = { y: 0, scale: 1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0)" };
const hover = { y: -4, scale: 1.1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0.22)" };
const transition = { type: "spring", duration: 0.35, bounce: 0 } as const;

/** Plan Card: one item of the Plans CMS (r6DlhcXkS). */
export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <motion.article className={s.card} data-framer-name="Plan Card" initial={rest} whileHover={hover} transition={transition}>
      <div className={s.head}>
        <h4 className={["t-h4", s.name].join(" ")}>{plan.name}</h4>
        {plan.highlighted ? (
          <span className={s.badge}>
            <span className="t-small c-bg">{plan.badge ?? "Most popular"}</span>
          </span>
        ) : null}
      </div>
      <p className={["t-body", s.description].join(" ")}>{plan.description}</p>
      <div className={s.priceRow}>
        <h2 className="t-h2">{plan.price}</h2>
        <p className="t-small c-text-2">{plan.unit}</p>
      </div>
      <div className={s.status}>
        <p className="t-small c-text-2">{planStatusLabel}</p>
        <p className="t-small c-text-2">{plan.statusValue}</p>
      </div>
      <Button variant="primary" size="lg" href={plan.buttonHref} className={s.button}>
        {plan.buttonLabel}
      </Button>
      <ul className={s.features}>
        {plan.features.map((f) => (
          <li key={f} className={s.feature}>
            <IconCheck size={14} className={s.check} />
            <p className={["t-small", s.featureText].join(" ")}>{f}</p>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
