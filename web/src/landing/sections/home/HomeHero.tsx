import Link from "next/link";
import { Button } from "../../components/Button";
import { ScrollLift } from "../../components/ScrollLift";
import { AppWindow } from "./hero/AppWindow";
import { HeroHeading } from "./hero/HeroHeading";
import { LogoTicker, type TickerItem } from "./hero/LogoTicker";
import { Icon } from "./hero/icons";
import { bnb } from "../../components/Bnb";
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
  { name: "BNB Chain", logo: "/landing/logos/bnb-chain.svg" },
];

/* What Covenant is built with, credited in the hero: only what the code integrates today (Cournot's verdict hook is
   designed but no relayer is wired, so it is not listed). Each mark opens its card in "How it's built" (#built-on). */
const builtWith = [
  { id: "bnb", name: "BNB Chain", logo: "/landing/logos/bnb-chain.svg" },
  { id: "flap", name: "Flap Pool Launch", logo: "/landing/logos/flap.svg" },
  { id: "pancakeswap", name: "PancakeSwap", logo: "/landing/logos/pancakeswap.svg" },
  { id: "atlas", name: "Atlas", logo: "/landing/logos/atlas.svg" },
  { id: "cmc", name: "CoinMarketCap", logo: "/landing/logos/coinmarketcap.svg" },
  { id: "four", name: "Four.meme", logo: "/landing/logos/four-meme.svg" },
  { id: "erc8004", name: "ERC-8004", logo: "/landing/logos/erc-8004.svg" },
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
        <nav className={s.builtWith} aria-label="Built with">
          <span className={["t-small", "c-text-2", s.builtWithLabel].join(" ")}>Built with</span>
          <ul className={s.builtWithList}>
            {builtWith.map((x) => (
              <li key={x.id}>
                <a href={`/#built-on-${x.id}`} className={["t-small", s.builtWithItem].join(" ")} title={`${x.name}: how Covenant uses it`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.logo} alt="" width={14} height={14} className={s.builtWithLogo} draggable={false} />
                  <span>{x.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
          Built with BNB Chain, Flap Pool Launch, PancakeSwap, Atlas, CoinMarketCap, Four.meme and ERC-8004
        </p>
        <LogoTicker items={builtOn} />
      </div>
    </section>
  );
}
