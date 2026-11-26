import type { ReactNode } from "react";
import { Section } from "../../components/Section";
import { IconHandHeart, IconKey, IconShieldCheck } from "./icons";
import s from "./ContactPromises.module.css";

/* Three promises, each a fact from docs/DESIGN.md (see docs/landing/content/contact.md). */
const promises: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <IconKey size={20} />, title: "No admin keys", body: "No owner, no pause and no fee switch on any covenant." },
  { icon: <IconShieldCheck size={20} />, title: "Rules fixed at launch", body: "No proposals and no votes in v1. Nobody can raise the tap." },
  { icon: <IconHandHeart size={20} />, title: "No fees in v1", body: "Covenant adds no fee for buyers or teams in v1." },
];

/** Contact Promises (AAAHVbPKY): top border, three columns with 1px left dividers, padding 40 / 32 24 / 24 20. */
export function ContactPromises() {
  return (
    <Section name="Contact Promises" contentClassName={s.content}>
      <div className={s.row}>
        {promises.map((p) => (
          <div key={p.title} className={s.item}>
            <span className={["c-accent", s.icon].join(" ")}>{p.icon}</span>
            <h4 className={["t-h4", s.full].join(" ")}>{p.title}</h4>
            <p className={["t-body", s.full].join(" ")}>{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
