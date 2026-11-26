# /pricing spec (Framer page `gCJGzj4DE`, "Pricing")

Breakpoints are the page's children: Desktop `qlDAEpZg7` (1200), Tablet `Z1sJhWGiW` (810), Phone `m8yUYQMM1` (390).
Replica ids are `${breakpointId}${primaryId}`. Below, values are Desktop / Tablet / Phone; a single value means no override.
Tokens: Accent `450d9726…` = `--c-accent`, Background `fa640121…` = `--c-bg`, Text Secondary `1047f8e1…` = `--c-text-2`,
Text Primary `07ff22ec…` = `--c-text`, Border `4a29f1fd…` = `--c-border`, Surface `ecd697ca…` = `--c-surface`.
Text presets: `TB2u98oLS` H1, `HmDLO_Rtk` H2, `TCvQ7cG0I` H4, `JNQ4X1wce` Lead, `kOxsGkmkK` Body, `VuXCwP05s` Label, `qj414ABQK` Small.

Page order: Pricing Hero, Plans, Compare, Pricing Quote, Pricing FAQ, Page CTA (`W5kSSJTj5`, component `fSTDtB1cM`).
The page has no appear or scroll effects. Effects are hover only (plan card, table row) plus the sticky table header.
The breakpoint's default transition (spring 0.4s, bounce 0.2) drives nothing on this page.

Reference screenshots: `docs/landing/spec/reference/pricing/` (hero, plans, compare, quote, faq, cta; desktop, plus
tablet/phone where the layout changes). Final shots: `docs/landing/screens/pricing/full-{1200,810,390}.jpg`.
Live template used for runtime checks: https://forgiving-needs-325167.framer.app/pricing.

## Section shell (all sections)

Outer `section` 100%, padding 0 32 / 0 24 / 0 16, centred. Inner: max-width 1280, 1px left and right Border rails.
Rebuilt with the foundation `Section` (`web/src/landing/components/Section.tsx`).

## Pricing Hero `OMMwJ34Qn`

- Outer: no top border (page head). Content `mOgYCu8qb`: vertical, centred, padding 112 64 88 / 96 48 96 / 64 20 64,
  gap 24 / 24 / 36. `Section head`.
- Eyebrow `UPrEBBEf1`: Label, Accent, centred, 1fr.
- Title `G_58hI1mo`: H1 (h1), Text Primary, centred, max-width 900, width 100%, text-wrap balance.
- Body `FzY8ZgEzX`: Lead, centred, max-width 560, width 100%, text-wrap balance.
- Measured: section height 463 at 1200 on both the live template and the rebuild.

## Plans `FxGBNmDH8`

- Outer: no top border. Inner `amKoIt_Vw` rails. Content `MKFwfeOJL`: vertical, align start, gap 20,
  padding 0 64 96 / 0 48 80 / 0 20 64.
- Plans Grid `onPsR6Z5S`: collection list over Plans CMS `r6DlhcXkS`, sorted by Order (`nTcF3WkHJ`) ascending.
  Desktop: grid, 4 columns, column min 220, gap 16, centred. Tablet: 2 columns, min 200. Phone: vertical stack, gap 12,
  card height auto, width 100%.
- Plan Card `xw5HmDWe9`: Background fill, 1px Border (drawn inside the frame), radius 18, padding 28 24, vertical,
  align start, gap 20, width 1fr, height 1fr (cards in a row share a height).
  - Hover: y -4px, scale 1.1, shadow `0px 24px 48px -24px rgba(21, 23, 28, 0.22)`, spring duration 0.35s, bounce 0.
    Verified on the live template: hovered card computes `matrix(1.1, 0, 0, 1.1, 0, -4)` with that shadow.
  - Plan Head `xig3DJv4U`: horizontal, centred, gap 8. Plan Name `nmTwtKIv_` H4 (h4), 1fr. Plan Badge `p7l9RSMuy`:
    Accent fill, radius 999, padding 3 8, visible when Highlighted (`JyIMBPjhr`); text `UVs1FwdOb` Small in Background
    ("Most popular" in the template; the badge text is `plan.badge` in code).
  - Plan Description `WAUcgXvbp`: Body (text-2), 1fr.
  - Plan Price Row `IqEKg3ii9`: horizontal, wraps, align end, gap 4 8. Price `Ebw7rhLgS` H2 (h2), auto. Unit `nzAp7ysKs`
    Small, Text Secondary.
  - Plan Yearly `JyiwxvobP`: horizontal, gap 4. Label `O5d7zvmcB` "Yearly:" (now "Status:") and value `Th6EgfROl`,
    both Small, Text Secondary.
  - Plan Button `v9dzY6Qv0`: Button `Cd7LjBF5C` default variant (Primary), height 44 (`size="lg"`), width 100%.
    The template links every card to /contact; the rebuild uses each plan's `buttonHref`.
  - Plan Features `JLiN5L9sJ`: 1px top Border (inside the frame), padding-top 18, vertical, gap 10.
    Plan Feature `pou_zfoGX` (repeats over Features): horizontal, centred, gap 8. Check `YepNyMXFA`: Phosphor "Check",
    14px, Accent, width 1.5, alpha 0. Text `ZX7iQ2p8L` Small, 1fr.
- Plans Note `eB66l90t9`: Small, Text Secondary, centred, 1fr.
- Measured inside the first card, live template and rebuild agree to the pixel: name 28, description 73, price 140,
  unit 177 (x 94), status 214, button 250, first feature 332, features step 26.

## Compare `d5j5gROy9`

- Outer: 1px top Border. Content `mRmFdC31f`: vertical, gap 56 / 56 / 36, padding 120 64 / 96 48 / 64 20.
- Heading Group `U3a45cq85`: vertical, gap 20. Eyebrow `uXimCfeCe` Label Accent. Heading `wT0HglTNr` H2 (h2),
  max-width 820, two runs (Text Primary, then Text Secondary): `SplitHeading`.
- Table Wrap `iFgQDugwk`: overflow clip / auto / auto. Table `vtnuvwT_k`: vertical, min-width 720, width 100%.
- Compare Header `XpfD6R3PJ`: sticky, top 64px (under the 64px nav), z-index 2, Background fill, 1px bottom border in
  Text Primary (inside the frame), padding 14 0, horizontal, centred. Cells Label: first column 1.6fr, four plan
  columns 1fr each.
  On tablet and phone the wrap is a scroll container (overflow auto), so the header sticks inside it at 64px and covers
  the first group title. The template does the same (see compare-tablet/compare-phone references); kept as is.
- Group (e.g. `lmTeRCAFo`): horizontal, padding 28 0 10, title H4 (h4), 1fr.
- Row (e.g. `UQJZQgVr1`): horizontal, centred, padding 14 0, 1px bottom Border (inside the frame). Cells Small;
  name 1.6fr, values 1fr. "✓" in Accent, "–" in Text Secondary, other text in Text Primary.
  Hover: Surface fill and scale 1.1, tween 0.15s, ease [0.44, 0, 0.56, 1] (stored hoverEffect; scale confirmed on the
  live template by the lead). Implemented as a CSS transition.
- Template has 3 groups (5, 3, 4 rows); the rebuild has 3 groups (5, 4, 3 rows).
- Measured at 1200: section height 1205, header 45, row 44, group 63 on both the live template and the rebuild.

## Pricing Quote `MoGsxAjpu`

- Outer: 1px top Border. Content: vertical, centred, gap 28 / 28 / 36, padding 120 64 / 96 48 / 64 20.
- Quote Mark: Phosphor "Quotes", 28px, Accent, width 1.5.
- Quote Text: H2 (h2), centred, max-width 900, width 100%, text-wrap balance.
- Author: Label, Text Secondary, centred, 1fr.

## Pricing FAQ `K3KO0Dujw`

- Outer: 1px top Border. Content: vertical, gap 0 / 0 / 36, padding 120 64 / 96 48 / 64 20.
- Columns: horizontal, align start, gap 64. Tablet: vertical, gap 40. Phone: vertical, gap 36.
- Intro: vertical, gap 20, width 340 / 100% / 100%. Eyebrow Label Accent "Questions". Heading H2 (h2).
- List: 1px top Border, vertical, 1fr / 100% / 100%. Collection list over FAQ CMS `eIcb7RBmr` sorted by order,
  each row an FAQ Item `VrMDv2AIP` (variant `eEX0wI64E`, closed). Rebuilt with the foundation `FAQList`
  (`components/FAQ.tsx`), which draws the top border and the item behaviour. Items: `content/faqs.ts`.
- Measured at 1200: section height 672 on both the live template and the rebuild.

## Page CTA `W5kSSJTj5`

Foundation `PageCTA` with the content-plan default (heading, body, secondary "Read the rules" /features, primary
"Launch app" /app). Template control values: heading "Need more than 200 seats?", buttons "Book a demo" (secondary)
and "Start for free" (primary).

## Icons

Phosphor "regular" paths (256 grid, stroke 16 = width 1.5 at the 24 grid) in `sections/pricing/icons.tsx`:
`IconCheck` (polyline 40 144, 96 200, 224 72) and `IconQuotes`. Framer icon nodes cannot be exported with `toSVG`.
