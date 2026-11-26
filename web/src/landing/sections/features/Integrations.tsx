import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { IntegrationGrid, IntegrationTile } from "../../components/IntegrationGrid";
import {
  IconChartLineUp,
  IconDatabase,
  IconGavel,
  IconIdentificationCard,
  IconPlugsConnected,
  IconRocketLaunch,
  IconSwap,
  IconVault,
} from "./icons";
import s from "./Integrations.module.css";

/* Framer "Integrations" E6keqeSjV: heading group + eight Integration Tiles (grid 4 / 2 / 2, gap 12).
   Tiles: sponsor and agent integrations (DESIGN.md "Sponsor integrations", "Data and oracle design", "Agent layer"). */
const tiles = [
  { icon: <IconRocketLaunch size={22} />, title: "Flap Pool Launch", body: "Runs the raise and seeds a pool with locked liquidity" },
  { icon: <IconChartLineUp size={22} />, title: "Atlas", body: "Signed BNB/USD for the dollar tap and unlock" },
  { icon: <IconDatabase size={22} />, title: "CoinMarketCap DEX API", body: "Quotes, liquidity and holders on the covenant sheet" },
  { icon: <IconVault size={22} />, title: "OpenFour", body: "Brings the tap and the switch to Four.meme tokens" },
  { icon: <IconSwap size={22} />, title: "PancakeSwap V2", body: "Time-weighted pool price, read on-chain" },
  { icon: <IconIdentificationCard size={22} />, title: "ERC-8004", body: "Agent identity and a record that travels between raises" },
  { icon: <IconPlugsConnected size={22} />, title: "Covenant MCP server", body: "Lets any agent read terms, commit and redeem" },
  { icon: <IconGavel size={22} />, title: "Cournot", body: "A verdict on each period’s disclosure report" },
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
          second="Each integration does a job in Covenant that nothing else could do."
        />
      </div>
      <IntegrationGrid>
        {tiles.map((t) => (
          <IntegrationTile key={t.title} icon={t.icon} title={t.title} body={t.body} />
        ))}
      </IntegrationGrid>
    </Section>
  );
}
