import type { Milestone } from "../../content/milestones";
import { ScrollLift } from "../../components/ScrollLift";
import s from "./Entry.module.css";

/** Entry Cover Section (rzV5FZ00g): no top border, content padding 0 24 24 / 0 24 24 / 0 12 12.
 *  Entry Cover: 520 / 400 / 240 tall, radius 20 / 20 / 14, 1px Border; scroll lift y 32, scale 0.98, spring 500/60/1. */
export function EntryCover({ m }: { m: Milestone }) {
  return (
    <section className={s.coverSection} data-framer-name="Entry Cover Section">
      <div className={s.coverInner}>
        <div className={s.coverContent}>
          <ScrollLift className={s.cover}>
            <img className={s.coverImg} src={m.cover} alt="" width={1200} height={800} />
          </ScrollLift>
        </div>
      </div>
    </section>
  );
}
