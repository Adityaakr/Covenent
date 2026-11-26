import Link from "next/link";
import { Button } from "../../components/Button";
import { ScrollLift } from "../../components/ScrollLift";
import { AppWindow } from "./hero/AppWindow";
import { HeroHeading } from "./hero/HeroHeading";
import { LogoTicker, type TickerItem } from "./hero/LogoTicker";
import { Icon } from "./hero/icons";
import s from "./hero/HomeHero.module.css";

/* Framer Home (augiA20Il) section "Hero" (NPB4fqmao). Spec: docs/landing/spec/home-a.md.
   Copy and sources: docs/landing/content/home-a.md. */

/* Integrations Covenant is built on (DESIGN.md "Summary", "Sponsor integrations"), not customers.
   The marks are generic shapes from the template's logo row, not the projects' own logos. */
const builtOn: TickerItem[] = [
  { name: "Flap", icon: "circleBold" },
  { name: "Atlas", icon: "triangleBold" },
  { name: "CoinMarketCap", icon: "hexagonBold" },
  { name: "OpenFour", icon: "sunBold" },
  { name: "PancakeSwap", icon: "diamondBold" },
  { name: "ERC-8004", icon: "treeBold" },
  { name: "Cournot", icon: "squareBold" },
];

export function HomeHero() {
  return (
    <section className={s.hero} data-framer-name="Hero">
      <div className={s.grid} aria-hidden="true">
        <div className={s.gridCols}>
          <div className={s.gridCol} />
        </div>
      </div>

      <div className={s.intro}>
        <Link href="/changelog" className={s.announce}>
          <span className={s.chip}>
            <span className="t-small c-bg">Agents</span>
          </span>
          <span className={["t-label", "c-text", s.announceText].join(" ")}>
            <span className={s.announceLong}>Now with an agent layer: issuer, investor and keeper agents</span>
            <span className={s.announceShort}>Now with an agent layer</span>
          </span>
          <Icon name="caretRight" size={12} className={s.arrow} />
        </Link>
        <HeroHeading text="Investor protections that enforce themselves." />
        <p className={["t-lead", s.sub].join(" ")}>
          Covenant is a launcher and vault for token raises on BNB Chain. Five rules bind whoever holds the team
          wallet, a human team or an AI agent.
        </p>
        <div className={s.actions}>
          <Button variant="secondary" href="/features">
            Read the rules
          </Button>
          <Button variant="primary" href="/app">
            Launch app
          </Button>
        </div>
        <p className={["t-small", "c-text-2", s.note].join(" ")}>No fees in v1 {" · "} Built on Flap Pool Launch</p>
      </div>

      <div className={s.showcase}>
        <img
          className={s.plate}
          src="/landing/home/hero-plate.jpg"
          width={2048}
          height={1550}
          alt="Soft evening sky"
          fetchPriority="high"
        />
        <ScrollLift y={56} scale={0.96} className={s.window}>
          <AppWindow />
        </ScrollLift>
        <div className={s.update}>
          <div className={s.updateHeader}>
            <Icon name="sparkle" size={15} className={s.updateIcon} />
            <p className={["t-label", s.grow].join(" ")}>Issuer agent, heartbeat</p>
            <p className="t-small c-text-2">Hourly</p>
          </div>
          <p className="t-small c-text-2">
            Claimed 4.1 BNB of tap at the Atlas rate. Heartbeat sent. Report due in 12 days.
          </p>
          <div className={s.updateActions}>
            <span className={s.actionEdit}>
              <span className="t-small">Logs</span>
            </span>
            <span className={s.actionSend}>
              <span className="t-small c-bg">View on sheet</span>
            </span>
          </div>
        </div>
      </div>

      <div className={s.logoRow}>
        <p className={["t-label", "c-text-2", s.caption].join(" ")}>
          Built on Flap Pool Launch, priced by Atlas, explained with CoinMarketCap data
        </p>
        <LogoTicker items={builtOn} />
      </div>
    </section>
  );
}
