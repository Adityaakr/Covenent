import s from "./HomeHero.module.css";

/* Framer textEffect on "Hero Heading" (QFrNlSUIe): trigger onMount, tokenization word, stagger 0.05s,
   from opacity 0, y 14px, blur 6px; spring duration 0.7s bounce 0, delay 0.05s; no replay.
   Done as a CSS animation (keyframes .wordIn in HomeHero.module.css) so it plays on first paint, needs no
   JavaScript and can never leave the heading hidden. The easing is the exact critically damped spring curve
   (bounce 0, 0.7s) sampled into linear(). Word i starts at 0.05s + i * 0.05s. */
export function HeroHeading({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <h1 className={["t-h1", s.heading, className ?? ""].filter(Boolean).join(" ")} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true">
          <span className={s.word} style={{ animationDelay: `${(0.05 + i * 0.05).toFixed(2)}s` }}>
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </h1>
  );
}
