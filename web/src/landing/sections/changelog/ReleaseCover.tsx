"use client";
import { motion } from "motion/react";
import s from "./ChangelogList.module.css";

/** Release Cover (MQQkvsgbn): CMS image fill, 1px Border, radius 16. Hover: scale 1.01, spring 0.4s bounce 0. */
export function ReleaseCover({ src, alt }: { src: string; alt: string }) {
  return (
    <motion.div
      className={s.cover}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", duration: 0.4, bounce: 0 }}
    >
      <img className={s.coverImg} src={src} alt={alt} width={1200} height={800} />
    </motion.div>
  );
}
