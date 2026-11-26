import { Section } from "../../components/Section";
import s from "./HomeStats.module.css";

/** Framer section "Stats" (s8Ki2GStV). Numbers: docs/DESIGN.md "Problem and evidence". */
const stats = [
  { value: "98.6%", label: "of Pump.fun tokens fell below $1,000 of liquidity, per Solidus Labs" },
  { value: "80.96%", label: "of BSC meme coins went inactive about two months in, per MemeChain" },
  { value: "~60%", label: "of BSC and Ethereum tokens lasted under a day, per Cernera et al." },
  { value: "$580M", label: "committed to protected raises, 92.2% of it refunded, per Basis Point" },
];

export function HomeStats() {
  return (
    <Section name="Stats" contentClassName={s.content}>
      <div className={s.row}>
        {stats.map((stat) => (
          <div key={stat.value} className={s.stat}>
            <h2 className="t-h2">{stat.value}</h2>
            <p className="t-body">{stat.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
