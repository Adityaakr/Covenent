import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { IntegrationGrid, IntegrationTile } from "../../components/IntegrationGrid";
import { IconPlugsConnected } from "./icons";
import { bnb } from "../../components/Bnb";
import { integrations, statusLabel } from "../../content/integrations";
import s from "./Integrations.module.css";

/* Framer "Integrations" E6keqeSjV: heading group + Integration Tiles (grid 4 / 2 / 2, gap 12). The tiles come from
   content/integrations.ts (the same facts as the home "How it's built" flow), each with its real status, plus
   the Covenant MCP server, so eight tiles fill the 4 x 2 grid. */
const tiles = [
  ...integrations.map((i) => ({
    key: i.id,
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src={i.logo} alt="" className={s.logo} />,
    title: i.name,
    body: (
      <>
        {bnb(i.short)}
        <span className={[s.chip, s[`chip_${i.status}`]].join(" ")}>{statusLabel[i.status]}</span>
      </>
    ),
  })),
  {
    key: "mcp",
    icon: <IconPlugsConnected size={22} />,
    title: "Covenant MCP server",
    body: (
      <>
        Lets any agent read terms, commit and redeem
        <span className={[s.chip, s.chip_fork].join(" ")}>Built</span>
      </>
    ),
  },
];

export function Integrations() {
  return (
    <Section name="Integrations">
      <div className={s.headingGroup}>
        <Eyebrow>Integrations</Eyebrow>
        <SplitHeading
          as="h2"
          className={s.heading}
          first="Built on the BNB Chain stack."
          second="Here is how far each one is proven."
        />
      </div>
      <IntegrationGrid>
        {tiles.map((t) => (
          <IntegrationTile key={t.key} icon={t.icon} title={t.title} body={t.body} />
        ))}
      </IntegrationGrid>
    </Section>
  );
}
