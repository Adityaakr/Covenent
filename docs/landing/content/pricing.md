# /pricing copy and sources

Every fact below comes from `docs/DESIGN.md`. Section names refer to its headings.

## Pricing Hero

- Eyebrow: "Fees"
- Title: "No fees for buyers or teams in v1."
  Source: "Business model and roadmap": "It adds no new fee for buyers or teams in v1."
- Body: "Covenant earns through fee paths already built into Flap and OpenFour, paid on trading volume."
  Source: "Business model and roadmap": "Covenant earns when tokens launched through it keep trading, through fee paths
  that already exist in the sponsors' contracts"; "Revenue lines": "The first two lines pay on trading volume".

## Plans (`web/src/landing/content/plans.ts`, also used by the home pricing preview)

"Yearly:" becomes "Status:".

1. Buyers: $0 "to commit or refund"; "For anyone committing BNB to a raise."; Status "No fee in v1"; button
   "Launch app" /app. Features: Refunds if oversubscribed; Full refund under minimum; Redeem at book in a round;
   1% exit fee, kept by vault; No fee after wind-down.
   Sources: "Business model and roadmap" (no fee for buyers in v1); "Positioning and prior art" table (capped, pro rata
   refunds, full refund under minimum); "Rule 3: book-value exit" ("Default fee is 1% and stays in the treasury");
   "Lifecycle" ("redemption stays open with no fee" after wind-down).
2. Teams (highlighted, badge "Free in v1"): $0 "raise fee in v1"; "For human teams and AI agents that raise.";
   Status "Raise fee set to zero"; button "Launch app" /app. Features: Capped raise on Pool Launch; 4% tap cap per
   30 days; Unlocks at price multiples; A live covenant sheet; Same rules for agent issuers.
   Sources: "Revenue lines" (Raise fee: "Set to zero in v1"); "Summary" (Flap Pool Launch, the rules, the covenant
   sheet, "The same contracts work when the issuer is an AI agent"); 4% tap cap per 30 days per content-plan.md
   (DESIGN.md "Appendix A: default parameters"); "Rule 2: performance unlock".
   The template badge says "Most popular"; there is no evidence for that claim, so the badge reads "Free in v1".
3. Flap commission: "TBC" "of Flap’s protocol fee"; "Paid by Flap from its fee, not the project."; Status
   "Rate to confirm"; button "Contact the team" /contact. Features: Set by commissionReceiver; Derived from the tax
   rate; Paid from Flap’s fee; Earned on lifetime volume; No cost to buyers or teams.
   Source: "Revenue lines", Flap commission row ("commissionReceiver … derived from the launch's tax rate and paid
   from the protocol-fee remainder"; "Flap's protocol fee, not the project"; "Rate and eligibility … to confirm with
   Flap") and "The first two lines pay on trading volume over a token's whole life."
4. OpenFour royalty: "~6%" "of founder tax receipts"; "For Four.meme tokens on our vault template."; Status
   "Live on Four.meme"; button "Contact the team" /contact. Features: ROYALTY_BPS = 600; From the founder’s tax share;
   Adds the tap and the switch; Template fixed after create; Founders launch as before.
   Sources: "Revenue lines", OpenFour royalty row ("about 6% of every tax receipt"; "The founder's tax share";
   "Live mechanism, documented by Four.meme"); "Four.meme and OpenFour" (ROYALTY_BPS = 600; rules 1 and 4, the tap
   and the abandonment switch; "Template and init params cannot be changed after create"); "Go to market" ("a founder
   can adopt the tap and the switch without changing how they launch").
- Note: "No new fee for buyers or teams in v1. A raise fee and services come later."
  Source: "Revenue lines" (Raise fee "A lever for later"; Services "After mainnet").

## Compare (`web/src/landing/sections/pricing/compareData.ts`)

- Eyebrow "Prior art"; heading "Same promise, different engine." / "What a holder can do when it fails."
  Source: "Positioning and prior art" ("Same promise, different engine" in "Summary"; the table "shows … what a holder
  can do when things go wrong").
- Columns: Terms / Covenant / MetaDAO / DAICO / Launchpads (the table's "Bonding-curve launchpads" column).
- Raise and treasury: Raise; Full refund under minimum; Where the money sits; Team budget; Team tokens.
  Source: the "Positioning and prior art" table rows "Raise", "Where the money sits", "Team budget", "Team tokens".
- Holder exit: Exit at asset value; One holder can leave; Fixed rules, nothing to vote on; What enforces it.
  Sources: table rows "Holder exit at asset value", "What enforces it"; "Where Covenant is different on purpose"
  ("One holder can leave"; "There is no proposal process to learn and nothing to vote on").
- Trade-offs, stated up front: Legal claim on the company; Holder governance; Trading tax feeds the treasury.
  Sources: "Where Covenant is weaker, stated up front" ("No legal claim", "No governance … v1 offers exit, not voice");
  "Where Covenant is different on purpose" ("Trading tax feeds the treasury … MetaDAO treasuries only shrink unless
  the project earns revenue"); DAICO powers from "Research foundations" (raise the tap by vote, shut down by vote).
  Where DESIGN.md says nothing about a DAICO cell, it reads "Not specified", matching the table's own wording.

## Pricing Quote

- "That ties our income to launches that last." Attribution "Covenant · Business model".
  Source: "Revenue lines": "That ties our income to launches that last".

## Pricing FAQ

- Eyebrow "Questions", heading "Fees, in plain words." List renders `content/faqs.ts` (owned and sourced by home-b).

## Page CTA

- Content-plan default: "Raise under rules. Exit at book." / "Five rules hold the treasury. Nobody has to trust the
  team." Secondary "Read the rules" /features, primary "Launch app" /app.
