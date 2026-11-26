import type { ReactNode } from "react";
import s from "./Section.module.css";

export type SectionProps = {
  name: string;
  surface?: boolean;
  head?: boolean;
  noBorder?: boolean;
  className?: string;
  contentClassName?: string;
  id?: string;
  children?: ReactNode;
};

/** Framer section shell: outer band (border-top, side padding) > inner (max 1280, side rails) > content. */
export function Section({ name, surface, head, noBorder, className, contentClassName, id, children }: SectionProps) {
  const outer = [s.outer, surface ? s.surface : "", head || noBorder ? s.noBorder : "", className ?? ""].filter(Boolean).join(" ");
  const content = [s.content, head ? s.head : "", contentClassName ?? ""].filter(Boolean).join(" ");
  return (
    <section className={outer} data-framer-name={name} id={id}>
      <div className={s.inner}>
        <div className={content}>{children}</div>
      </div>
    </section>
  );
}
