import s from "./SplitHeading.module.css";

export type SplitHeadingProps = {
  as?: "h1" | "h2" | "h3";
  className?: string;
  first: string;
  second?: string;
};

const style = { h1: "t-h1", h2: "t-h2", h3: "t-h3" } as const;

/** Two-run heading: first sentence in text colour, second in secondary colour. */
export function SplitHeading({ as = "h2", className, first, second }: SplitHeadingProps) {
  const Tag = as;
  return (
    <Tag className={[style[as], s.heading, className ?? ""].filter(Boolean).join(" ")}>
      <span className="c-text">{first}</span>
      {second ? (
        <>
          {" "}
          <span className="c-text-2">{second}</span>
        </>
      ) : null}
    </Tag>
  );
}
