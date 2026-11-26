import Link from "next/link";
import { Button } from "../../components/Button";
import { ScrollLift } from "../../components/ScrollLift";
import { AppWindow } from "./hero/AppWindow";
import { HeroHeading } from "./hero/HeroHeading";
import { LogoTicker, type TickerItem } from "./hero/LogoTicker";
import { Icon } from "./hero/icons";
import { Marked, bnb } from "../../components/Bnb";
import s from "./hero/HomeHero.module.css";

/* Framer Home (augiA20Il) section "Hero" (NPB4fqmao). Spec: docs/landing/spec/home-a.md.
   Copy and sources: docs/landing/content/home-a.md. */

/* Integrations Covenant is built on (DESIGN.md "Summary", "Sponsor integrations"), not customers.
   Each mark is the project's own logo, made monochrome in the ticker grey: web/public/landing/logos/SOURCES.md.
   `scale` evens out optical size, since a square mark and a wide one look different at the same height. */
const builtOn: TickerItem[] = [
  { name: "Flap", logo: "/landing/logos/flap.svg", scale: 0.9 },
  { name: "Atlas", logo: "/landing/logos/atlas.svg", scale: 0.9 },
  { name: "CoinMarketCap", logo: "/landing/logos/coinmarketcap.svg" },
  { name: "PancakeSwap", logo: "/landing/logos/pancakeswap.svg" },
  { name: "Four.meme", logo: "/landing/logos/four-meme.svg" },
  { name: "ERC-8004", logo: "/landing/logos/erc-8004.svg", scale: 1.1 },
  { name: "Cournot", logo: "/landing/logos/cournot.svg", scale: 1.05 },
  { name: "BNB Chain", logo: "/landing/logos/bnb-chain.svg" },
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
        <Link href="/#agent-layer" className={s.announce}>
          <span className={s.chip}>
            <span className="t-small c-bg">Agents</span>
          </span>
          <span className={["t-label", "c-text", s.announceText].join(" ")}>
            <span className={s.announceLong}>Now with an agent layer: issuer, investor and keeper agents</span>
            <span className={s.announceShort}>Now with an agent layer</span>
          </span>
          <Icon name="caretRight" size={12} className={s.arrow} />
        </Link>
        <HeroHeading text="The operating stack for autonomous ventures." />
        <p className={["t-lead", s.sub].join(" ")}>
          {/* non-breaking spaces keep "AI agents" and "24/7 on" together; bnb() puts the BNB Chain mark before its
              name and keeps the two on one line */}
          {bnb("Capital, budgets and exits for businesses run by AI\u00a0agents. Enforced by code, not courts. 24/7\u00a0on\u00a0BNB\u00a0Chain.")}
        </p>
        <div className={s.actions}>
          <Button variant="secondary" href="/features">
            Read the rules
          </Button>
          <Button variant="primary" href="/app">
            Launch app
          </Button>
        </div>
        <p className={["t-small", "c-text-2", s.note].join(" ")}>
          Built on{" "}
          <Marked name="flap" tone="mono">
            Flap Pool Launch
          </Marked>
          {" · "}Data by{" "}
          <Marked name="cmc" tone="mono">
            CoinMarketCap
          </Marked>
        </p>
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
            {bnb("Claimed 4.1 BNB of tap at the Atlas rate. Heartbeat sent. Report due in 12 days.")}
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
