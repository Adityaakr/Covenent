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
   The marks are the projects' own logos (web/public/landing/logos/SOURCES.md). ERC-8004 has no published mark,
   so it shows its name alone. Heights are optical: wide marks sit lower, round and sparse marks a little taller. */
const logo = (file: string, ratio: number, height: number) => ({ src: `/landing/logos/${file}.svg`, ratio, height });
const builtOn: TickerItem[] = [
  { name: "Flap", logo: logo("flap", 28.676 / 23.63, 18) },
  { name: "Atlas", logo: logo("atlas", 47.602 / 42.257, 19) },
  { name: "CoinMarketCap", logo: logo("coinmarketcap", 23.645 / 24, 21) },
  { name: "BNB Chain", logo: logo("bnb-chain", 20.745 / 24, 21) },
  { name: "OpenFour", logo: logo("four-meme", 21.431 / 23.43, 22) },
  { name: "PancakeSwap", logo: logo("pancakeswap", 191.252 / 198.607, 20) },
  { name: "ERC-8004" },
  { name: "Cournot", logo: logo("cournot", 33 / 43, 21) },
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
        <HeroHeading text="The operating stack for autonomous ventures." />
        <p className={["t-lead", s.sub].join(" ")}>
          {/* non-breaking spaces keep "AI agents", "24/7 on" and "BNB Chain" together at every width */}
          {"Capital, budgets and exits for businesses run by AI\u00a0agents. Enforced by code, not courts. 24/7\u00a0on BNB\u00a0Chain."}
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
