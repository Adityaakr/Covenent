import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { Button } from "../../components/Button";
import { FeatureGrid, FeatureCard } from "../../components/FeatureGrid";
import { Marked } from "../../components/Bnb";
import { IconFileText, IconShieldCheck, IconVault } from "../features/icons";
import s from "./HomeFourMeme.module.css";

/* "Launch on Four.meme": the OpenFour tax-vault template (CovenantLiteVault) in three steps. Facts: docs/DESIGN.md
   "Four.meme and OpenFour" and contracts/src/openfour. It is the lighter covenant: tap and abandonment only. */
const steps = [
  {
    icon: <IconFileText size={18} />,
    title: "Pick the template",
    body: "On Four.meme’s create page, choose the Covenant tax-vault template. Its settings are fixed once the token exists.",
  },
  {
    icon: <IconVault size={18} />,
    title: "Tax flows to the vault",
    body: "Your share of trading tax lands in the vault, not your wallet. You draw a capped share each period, and every draw is a heartbeat.",
  },
  {
    icon: <IconShieldCheck size={18} />,
    title: "Holders stay protected",
    body: "Go silent past the heartbeat window, or wind down, and holders can burn tokens for a pro rata share of the vault.",
  },
];

export function HomeFourMeme() {
  return (
    <Section name="Launch on Four.meme" id="four-meme">
      <div className={s.head}>
        <div className={s.headingGroup}>
          <Eyebrow>
            Launch on{" "}
            <Marked name="four" tone="mono">
              Four.meme
            </Marked>
          </Eyebrow>
          <SplitHeading
            className={s.heading}
            first="Already launching on Four.meme?"
            second="Put your tax share under a covenant."
          />
        </div>
        <div className={s.actions}>
          <Button variant="primary" href="/app/create?venue=fourmeme">
            Launch on Four.meme
          </Button>
        </div>
      </div>
      <FeatureGrid>
        {steps.map((st, i) => (
          <FeatureCard
            key={st.title}
            icon={st.icon}
            title={
              <>
                <span className="c-text-2">{String(i + 1).padStart(2, "0")}</span> {st.title}
              </>
            }
            body={st.body}
          />
        ))}
      </FeatureGrid>
      <p className={["t-body", s.honest].join(" ")}>
        <span className="c-text">This is the lighter covenant.</span> You get the tap and the abandonment switch. There is
        no raise and no book-value exit. For all five rules, launch through{" "}
        <Marked name="flap" tone="mono">
          Flap Pool Launch
        </Marked>
        .
      </p>
    </Section>
  );
}
