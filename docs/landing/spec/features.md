# /features spec (Framer page O4jNLwO0Z)

Source: Framer project "Forgiving Needs (copy)", page `/features` `O4jNLwO0Z`. Breakpoints: Desktop `QOBJxOHWr` (1200),
Tablet `gVx6RUbbr` (810), Phone `X1M2rDPwg` (390). Replica ids are `${breakpointId}${primaryId}`; the overrides listed
per breakpoint below are every value the Tablet and Phone replicas change (diffed node by node with `tree.serialize`).
Reference screenshots: `reference/features/<section>-<desktop|tablet|phone>.jpg` (canvas renders; the nav overlays the
top of each shot and the Template Dock overlays the left edge, neither is part of the section).

Tokens: Background `--c-bg`, Surface `--c-surface`, Border `--c-border`, Text Primary `--c-text`, Text Secondary
`--c-text-2`, Accent `--c-accent`. Text presets: H1 `TB2u98oLS` = `t-h1`, H2 `HmDLO_Rtk` = `t-h2`, H3 `X07im2mzX` =
`t-h3`, H4 `TCvQ7cG0I` = `t-h4`, Lead `JNQ4X1wce` = `t-lead`, Body `kOxsGkmkK` = `t-body`, Label `VuXCwP05s` = `t-label`,
Small `qj414ABQK` = `t-small`.

Borders: Framer draws every border inside the frame without taking layout space. The code draws them with an inset
`::after` / `::before` or an inset box-shadow so padding is measured from the outer edge, as in Framer.

Page order: Features Hero, Board Showcase, Capabilities, Dependencies, Integrations, Security, Page CTA, all inside the
layout template "Main" (`SiteLayout current="/features"`).

## 1. Features Hero `ThwQrearH` -> `sections/features/FeaturesHero.tsx`

- Section shell, page head (`Section head`): outer `section`, padding 0 32 / 0 24 / 0 16, no top border; inner max 1280,
  1px Border rails left and right; content stack vertical, centred, padding 112 64 88 64, gap 24.
  Tablet content padding 96 48 96 48, gap 24. Phone content padding 64 20 64 20, gap 36.
- Eyebrow: Label, Accent, centred, width 1fr.
- Title: `h1`, H1, Text Primary, centred, max width 900, width 100%, text-wrap balance.
- Body: `p`, Lead (Text Secondary), centred, max width 560, width 100%, text-wrap balance.
- Actions: stack horizontal, gap 10, padding-top 8. Button Secondary (md 40px) then Button Primary (md 40px).
- No effects. No breakpoint overrides other than the section shell padding and gap.

## 2. Board Showcase `IpRueCYvh` -> `sections/features/BoardShowcase.tsx`

- Outer `section`: padding 0 32 / 0 24 / 0 16, **no top border** (`Section noBorder`). Inner: max 1280, rails.
- Content `rfDgcPXb5`: padding 0 24 24 24, gap 0. Phone: padding 0 12 12 12.
- Board Plate `esaT3InLu`: image fill (Framer asset `Qm5f0sre4ez1xrZFIeAsAONnhk.jpg`, 2400x1350, cover, centred, alt
  "Soft green and peach gradient") saved as `web/public/landing/features/board-plate.jpg`; radius 24; overflow clip;
  padding 64 56; stack vertical, centred.
  Tablet: padding 40 24. Phone: padding 20 12, radius 18.
- Board Window `iAcCLkTYu`: Background fill, radius 14, overflow clip, width 100%, max width 1040, stack vertical.
  Shadows `0px 40px 80px -24px rgba(21, 23, 28, 0.30)`, `0px 0px 0px 1px rgba(21, 23, 28, 0.06)` (note 0.30, not the
  0.35 of the home App Window).
  **Effect** `styleTransformEffect`: trigger onInView, viewport end, spring stiffness 500, damping 60, mass 1, delay 0,
  from opacity 1, y 32px, scale 0.98 to y 0, scale 1. Code: `ScrollLift y={32} scale={0.98}` on the window itself.
- Board Bar `Tny2aCsub`: stack horizontal, centred, gap 10, padding 14 18, 1px bottom Border.
  Icon: Phosphor "Kanban" 16x16, Text Primary, stroke 1.5. Title: Label, width 1fr. Filter: Small, Text Secondary, auto.
- Board Columns `DOBL_gVGT`: Surface fill, padding 16, gap 12, stack horizontal, align start.
  Tablet: layout grid, 2 columns (min 50px), rows fit, gap 12. Phone: stack vertical, padding 12, gap 12, columns width 100%.
- Board Column: stack vertical, gap 8, width 1fr, min width 200.
  Head: stack horizontal, centred, gap 8, padding 4. Dot 8x8 radius 8, fills in order: Text Secondary, Text Primary,
  Accent, Border. Title Label, width 1fr.
- Board Card: Background fill, 1px Border, radius 10, padding 12, gap 10, stack vertical, width 100%.
  Title Small (Text Primary). Meta Small, Text Secondary.
  **Hover** `hoverEffect`: x 0, y -2px, scale 1.1, opacity 1, shadow `0px 10px 20px -10px rgba(21, 23, 28, 0.25)`,
  transition spring duration 0.3s, bounce 0, delay 0. Scale 1.1 is confirmed on the live template
  (computed `matrix(1.1, 0, 0, 1.1, 0, -2)` on hover). Code: `motion.div` whileHover with those values.

## 3. Capabilities `zkFX9RJ2I` -> `sections/features/Capabilities.tsx`

- Standard section shell (`Section`): 1px top Border; content padding 120 64, gap 56; tablet 96 48, gap 56;
  phone 64 20, gap 36.
- Heading Group: stack vertical, gap 20. Eyebrow Label in Accent. Heading `h2`, H2, max width 820, two runs
  (Text Primary, then Text Secondary) = `SplitHeading as="h2"`.
- Capabilities Grid `aFmXCnkFi` = foundation `FeatureGrid`: grid 3 columns (min 240), rows auto, gap 1px, Border fill,
  1px Border, radius 18, clip. Tablet 2 columns (min 200). Phone: stack vertical.
  **Effect** on the grid: onInView, viewport end, spring stiffness 500, damping 60, mass 1, from y 32px scale 0.98
  (built into `FeatureGrid`).
- Six Feature Card instances (`Gb5Q7P0K_`, variant Default; Phone variant `TLI8tn9hV` with width 100%, height auto) =
  foundation `FeatureCard`. Icon control `re5Pd83o4` (Phosphor set), title `l5ntJ7oNZ`, body `pkyTIDbnq`.
  Icon box 36x36, Surface, 1px Border, radius 10; icon 18px Text Primary, stroke 1.5.

## 4. Dependencies `BFBxV929S` -> `sections/features/ExitTimeline.tsx`

- Section shell with 1px top Border and rails; content `MIvO9jO3z` has **no padding and no gap** (overridden with
  `contentClassName`).
- Columns `xxia1Nhkd`: stack horizontal, align centre. Tablet and Phone: stack vertical.
- Text `NVzeniKw4`: width 1fr, stack vertical, gap 28, padding 96 56 96 64.
  Tablet: width 100%, padding 80 48. Phone: padding 56 20.
  Eyebrow Label Accent. Heading `h3`, H3, two runs (Text Primary, Text Secondary).
  Three points: stack horizontal, centred, gap 10; icon Phosphor "Check Circle" 18px Accent, stroke 1.5; text Label
  (Text Primary), width 1fr.
- Visual `M7anFgmoh`: width 1fr, height 560, Surface fill, 1px left Border, padding 56 40, gap 14, stack vertical,
  centred on both axes. Tablet: width 100%, height auto, left border 0, top border 1px. Phone: also padding 40 16.
  **Effect**: onInView, viewport end, spring stiffness 500, damping 60, mass 1, from y 32px scale 0.98 (`ScrollLift`).
- Dependency Row (x3): max width 460, width 100%, stack horizontal, centred. Offset spacer height 4, width 0% / 30% / 62%.
  Bar width 46% / 56% / 38%; Background fill (second bar Accent fill), 1px Border, radius 10, padding 10 12, shadow
  `0px 8px 16px -8px rgba(21, 23, 28, 0.15)`; text Small, one line, clipped with ellipsis (second bar text Background).
- Dependency Note: Text Primary fill, radius 12, padding 12 14, gap 10, max width 460, stack horizontal, centred;
  icon Phosphor "Bell" 16px Background; text Small, Background, width 1fr.

## 5. Integrations `E6keqeSjV` -> `sections/features/Integrations.tsx`

- Standard section shell, 1px top Border; content 120 64 / 96 48 / 64 20, gap 56 / 56 / 36.
- Heading Group: gap 20; Eyebrow Label Accent; `h2` H2 max 820, two runs.
- Integrations Grid `b0k3UxmJm` = foundation `IntegrationGrid`: grid 4 columns (min 200), rows auto, gap 12.
  Tablet 2 columns. Phone 2 columns (min 140).
- Eight Integration Tile instances (`ApInVGTjW`) = foundation `IntegrationTile`: icon control `BFDfaSIFN` (22px),
  title `U4Bwry45L` (Label), body `dxWxMuNSN` (Small, Text Secondary). Hover y -3px, scale 1.1 per the lead's live check,
  shadow `0px 16px 32px -16px rgba(21, 23, 28, 0.22)`, spring 0.3s bounce 0 (component, owned by foundation).
- No scroll effect on this grid.

## 6. Security `LNQvhFLFo` -> `sections/features/TrustAssumptions.tsx`

- Section shell with **Surface** fill on the outer section (`Section surface`), 1px top Border; content
  120 64 / 96 48 / 64 20, gap 56 / 56 / 36.
- Heading Group: gap 20; Eyebrow Label Accent; `h2` H2 max 820, two runs.
- Security Row `EB44rzABQ`: grid 4 columns (min 200), rows auto, gap 24. Tablet 2 columns. Phone: stack vertical
  (gap 24).
- Item: stack vertical, gap 10, padding 0 0 0 16, 2px Accent left border (inside the frame). Icon 20x20 Text Primary,
  stroke 1.5; title `h4` H4; body Body (Text Secondary).
- No effects.

## 7. Page CTA `pDBPX5Ak7` -> foundation `PageCTA`

- Component `fSTDtB1cM`, width 100%; variant Desktop `U8gHAYHok`, Tablet `ClERUCXIS`, Phone `tYmWWmQbK`.
- Controls: heading `VquNWsZNL`, body `Gxd2itg8v`, secondary label/link `ourN9cac0`/`UNAUMutAG` (template "Book a demo"
  `/contact`), primary label/link `WGSdVqo5L`/`RkMSTNK_s` (template "Start for free" `/pricing`).

## Icons

The template's IconNodes and icon controls use the Phosphor set (`omX0gWFPqDwhaiWwf6ab`, controls color, width 1.5,
alpha 0). `tree.toSVG` refuses IconNodes ("must be a vector, shape, or SVG node"), so the icons are taken from the
Phosphor source itself: `@phosphor-icons/core@2.1.1/assets/regular/<name>.svg` (256 grid with 16-unit strokes, which is
exactly stroke 1.5 on the 24 grid Framer renders). They live in `sections/features/icons.tsx`.
Template icons kept: Kanban (board bar), Check Circle (points), Bell (note), Key and Shield Check (security).
Covenant icons chosen from the same set for the new content: Hand Coins (Tap), Lock Open (Performance unlock),
Door Open (Book-value exit), Heartbeat (Abandonment switch), File Text (Disclosure), Robot (Agent layer),
Rocket Launch (Flap), Chart Line Up (Atlas), Database (CoinMarketCap DEX API), Vault (OpenFour), Swap (PancakeSwap V2),
Identification Card (ERC-8004), Plugs Connected (Covenant MCP server), Gavel (Cournot), Scales and Lock (security).

## Verification

Checked at http://localhost:3107/features at 1200, 810 and 390 (device emulation, DPR 1) against the references.
Final shots: `docs/landing/screens/features/<section>-<1200|810|390>.jpg`.
