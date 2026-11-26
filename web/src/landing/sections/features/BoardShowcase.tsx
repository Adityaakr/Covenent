"use client";
import { motion } from "motion/react";
import { Section } from "../../components/Section";
import { ScrollLift } from "../../components/ScrollLift";
import { IconKanban } from "./icons";
import s from "./BoardShowcase.module.css";

/* Framer "Board Showcase" IpRueCYvh: gradient plate holding the board window (covenant lifecycle board).
   Columns are covenant states from DESIGN.md "States"; cards are events from "Lifecycle" and the rules. */
type Card = { title: string; meta: string };
type Column = { state: string; dot: "text2" | "text" | "accent" | "border"; cards: Card[] };

const columns: Column[] = [
  {
    state: "RAISING",
    dot: "text2",
    cards: [
      { title: "Commitments open", meta: "4 day sale window" },
      { title: "Oversubscribed 2.8x", meta: "1,400 BNB committed" },
    ],
  },
  {
    state: "ACTIVE",
    dot: "text",
    cards: [
      { title: "Tap accrues", meta: "4% of treasury per 30 days" },
      { title: "Price recorded", meta: "Poked hourly" },
    ],
  },
  {
    state: "EXIT_ROUND",
    dot: "accent",
    cards: [
      { title: "Round open, tap paused", meta: "7 days" },
      { title: "Redeemed 6,000,000 tokens", meta: "2.534 BNB" },
    ],
  },
  {
    state: "WIND_DOWN",
    dot: "border",
    cards: [
      { title: "Silent for 45 days", meta: "Abandonment switch" },
      { title: "Locked team tokens burned", meta: "Redemption with no fee" },
    ],
  },
];

/* Board Card hover: y -2px, scale 1.1 (verified on the live template), shadow 0px 10px 20px -10px rgba(21,23,28,0.25), spring duration 0.3s bounce 0. */
const cardHover = { y: -2, scale: 1.1, boxShadow: "0px 10px 20px -10px rgba(21, 23, 28, 0.25)" };
const cardRest = { y: 0, scale: 1, boxShadow: "0px 10px 20px -10px rgba(21, 23, 28, 0)" };
const cardTransition = { type: "spring", duration: 0.3, bounce: 0 } as const;

export function BoardShowcase() {
  return (
    <Section name="Board Showcase" noBorder contentClassName={s.content}>
      <div className={s.plate}>
        <img
          className={s.plateImage}
          src="/landing/features/board-plate.jpg"
          alt="Soft green and peach gradient"
          width={2400}
          height={1350}
        />
        <ScrollLift className={s.window} y={32} scale={0.98}>
          <div className={s.bar}>
            <IconKanban size={16} className={s.barIcon} />
            <p className={`t-label ${s.barTitle}`}>Covenant · Lifecycle</p>
            <p className={`t-small c-text-2 ${s.barFilter}`}>Group by state</p>
          </div>
          <div className={s.columns}>
            {columns.map((col) => (
              <div key={col.state} className={s.column}>
                <div className={s.head}>
                  <span className={`${s.dot} ${s[col.dot]}`} />
                  <p className={`t-label ${s.headTitle}`}>{col.state}</p>
                </div>
                {col.cards.map((card) => (
                  <motion.div
                    key={card.title}
                    className={s.card}
                    initial={false}
                    animate={cardRest}
                    whileHover={cardHover}
                    transition={cardTransition}
                  >
                    <p className="t-small">{card.title}</p>
                    <p className="t-small c-text-2">{card.meta}</p>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </ScrollLift>
      </div>
    </Section>
  );
}
