# Global copy (navigation, footer, page CTA default)

Owner: foundation agent. Code: `web/src/landing/components/siteLinks.ts`, `Navigation.tsx`, `Footer.tsx`.
Plan: `docs/landing/spec/content-plan.md` "Global". No numbers appear in global copy.

## Navigation

| Slot (template) | Covenant | Link | Source |
| --- | --- | --- | --- |
| Logo wordmark "Ondrel" | Covenant | `/` | DESIGN.md title "Covenant: investor protections that enforce themselves" |
| Product | Rules | `/features` | content plan |
| Pricing | Fees | `/pricing` | content plan |
| Customers | Use cases | `/use-cases` | content plan |
| Changelog | Milestones | `/changelog` | content plan |
| Contact | Contact | `/contact` | content plan |
| Sign in (text link) | Connect wallet | `/app` | content plan |
| Start for free (Primary button) | Launch app | `/app` | content plan |

Phone drawer repeats the five links (Text/H3) and the two buttons: Secondary "Connect wallet", Primary "Launch app".

## Footer

- Tagline: "Investor protections that enforce themselves. A launcher and vault for token raises on BNB Chain."
  Source: DESIGN.md title line and Summary ("Covenant is a launcher and vault for token raises on BNB Chain ...").
- Status pill: "Testnet build · BNB Hack Bangkok". Source: DESIGN.md "What ships at BNB Hack Bangkok" ("on BNB testnet ...").
- Columns:
  - Product: Rules `/features`, Fees `/pricing`, Milestones `/changelog`.
  - Company: Use cases `/use-cases`, Contact `/contact`, Launch app `/app`.
  - Built on: Flap https://flap.sh, CoinMarketCap https://coinmarketcap.com, Four.meme https://four.meme (open in a new tab).
    Source: DESIGN.md Summary table "Built on" (Flap Pool Launch, OpenFour on Four.meme, CoinMarketCap data).
- Big wordmark: "Covenant".
- Copyright: "© 2026 Covenant. Built at BNB Hack Bangkok." Source: DESIGN.md "What ships at BNB Hack Bangkok".
- Right note: "Made for raises that keep their word".

## Page CTA default (page agents pass these props)

- Heading "Raise under rules. Exit at book." Body "Five rules hold the treasury. Nobody has to trust the team."
  Source: DESIGN.md Summary ("Five rules, enforced by contract ... replace the trust a buyer normally has to extend").
- Secondary "Read the rules" `/features`, Primary "Launch app" `/app`.
