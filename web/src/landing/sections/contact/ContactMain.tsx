"use client";
import Link from "next/link";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { ContactForm } from "./ContactForm";
import { IconFlag, IconRocketLaunch, IconShieldCheck } from "./icons";
import s from "./ContactMain.module.css";
import { bnb } from "../../components/Bnb";

const MotionLink = motion.create(Link);

/* Contact Channels: in-site destinations instead of email addresses (content-plan.md "/contact"). */
const channels: { icon: ReactNode; title: string; note: string; href: string }[] = [
  { icon: <IconRocketLaunch size={18} />, title: "App", note: "Launch the app", href: "/app" },
  { icon: <IconShieldCheck size={18} />, title: "Rules", note: "Read the five rules", href: "/features" },
  { icon: <IconFlag size={18} />, title: "Use cases", note: "Five ways to raise under rules", href: "/use-cases" },
];

/** Contact Main (EX2bP05WH): two columns, intro + channel links left, form card right. */
export function ContactMain() {
  return (
    <Section name="Contact Main" noBorder contentClassName={s.content}>
      <div className={s.columns}>
        <div className={s.intro}>
          <Eyebrow className={s.full}>Contact</Eyebrow>
          <h1 className={["t-h2", s.title].join(" ")}>
            <span className="c-text">Talk to the team.</span> <span className="c-text-2">Raise with rules.</span>
          </h1>
          <p className={["t-lead", s.full].join(" ")}>
            {bnb("Tell us what you are raising for. Covenant runs on Flap Pool Launch on BNB Chain.")}
          </p>
          <div className={s.channels} data-framer-name="Contact Channels">
            {channels.map((c) => (
              /* Channel hover: x 4px, scale 1.1, spring 0.3s bounce 0. */
              <MotionLink
                key={c.href}
                href={c.href}
                className={s.channel}
                whileHover={{ x: 4, scale: 1.1 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              >
                <span className={["c-text", s.channelIcon].join(" ")}>{c.icon}</span>
                <span className={["t-label", s.channelTitle].join(" ")}>{bnb(c.title)}</span>
                <span className="t-label c-text-2">{bnb(c.note)}</span>
              </MotionLink>
            ))}
          </div>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}
