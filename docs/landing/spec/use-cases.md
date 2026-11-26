# /use-cases and /use-cases/[slug] spec

Framer sources (read-only): page `/customers` `wBmMaVIkR` (breakpoints Desktop `exFEu17S4` 1200, Tablet `I6nodKHLq`
810, Phone `NimDgTdlX` 390) and the Stories CMS detail page `UUPt0HfzN` (Desktop `JpDwJJ2t3`, Tablet `yT7ncyxcu`,
Phone `Rdj8kvQuH`). Replica values below come from diffing `${breakpointId}${primaryId}` against the primary node.
Tokens: `$border` = `--c-border`, `$surface`, `$text`, `$text2`, `$accent`, `$bg`. Text styles map to `t-*` classes.
Reference screenshots: `docs/landing/spec/reference/use-cases/`. Final shots: `docs/landing/screens/use-cases/`.

Code: `web/src/landing/pages/UseCasesPage.tsx`, `UseCasePage.tsx`, `web/src/landing/sections/usecases/*`,
content `web/src/landing/content/useCases.tsx`, images `web/public/landing/usecases/<slug>.jpg` (covers made for each case; see docs/landing/sources.md).

## CMS "Stories" (`D9wcyChdJ`) -> `content/useCases.tsx`

Fields: Company -> `name`, Slug -> `slug`, Headline, Summary, Industry -> `category` (label "Category"),
Team Size -> `who` (label "Who"), Result -> `result` (label "Key term"), Result Label, Quote, Quote Author,
Author Role -> `quoteRole`, Cover (image) -> `cover`, Mark (icon from set "Phosphor" `omX0gWFPqDwhaiWwf6ab`) -> `mark`,
Story (rich text) -> `body`, Featured (boolean). Six items; item 1 is the only featured one.

Covers: the six template cover photos (1600px wide, neutral architecture/interiors), downloaded unchanged
(`J8L45jn4…`, `wC7LDFC9…`, `w6vTNiu6…`, `laBNEghV…`, `upabmX37…`, `TGE3mVEf…`) to `cover-1..6.jpg`, same order.
Image fill = cover, centred (`object-fit: cover`).

Marks: the template icon modules (`framerusercontent.com/modules/...`) for the six items: circle, triangle, hexagon,
sun, diamond, tree. Exported paths are inlined in `sections/usecases/marks.tsx` (24 viewBox, stroke only, alpha 0).
Instances set colour `$text` and width (stroke) 2; size 18 (Story Mark), 20 (Featured Mark), 24 (detail Story Mark).
`tree.toSVG` refuses IconNodes ("must be a vector, shape or SVG node"), so the paths were read from the icon modules.
Arrow Right / Arrow Left / Quotes use the same set at stroke 1.5; drawn from Phosphor regular geometry (256 box).

## /use-cases (Customers)

Section shell everywhere: outer `section` padding 0 32 / 0 24 / 0 16, inner max 1280 with 1px `$border` rails.

### Customers Hero `L9fI8vxK1` (page head, no top border)
- Content `X5IoIGdfm`: vertical, centred, gap 24 / 24 / 36, padding 112 64 88 / 96 48 96 / 64 20 64 (`Section head`).
- Eyebrow: Label, `$accent`, centred, width fill. Copy "Use cases".
- Title `dq2UUTOOM`: h1, H1, centred, max-width 900, width 100%, text-wrap balance. Two runs: `$text` / `$text2`.

### Featured Story `QMXtE7I4A` (no top border)
- Content `it2Y301ej`: vertical, gap 56, padding 0 64 96 / 0 48 80 / 0 20 64.
- Collection list: Stories, filter Featured = true, limit 1.
- Featured Card `C_RAl9t7Z`: link to the detail page. Horizontal stack (Tablet/Phone vertical), align center,
  fill `$bg`, border 1px `$border`, radius 24 / 24 / 18, overflow clip, cursor pointer.
  - Scroll effect (styleTransformEffect, trigger onInView, viewport end): from y 32px, scale 0.98, opacity 1 to rest;
    spring stiffness 500, damping 60, mass 1, delay 0 (`ScrollLift` defaults).
  - Hover: scale 1.1, shadow `0px 30px 60px -30px rgba(21, 23, 28, 0.25)`, spring duration 0.4s, bounce 0.
    (x/y 0, opacity 1.) Scale 1.1 is applied per the lead's check of the live site.
- Featured Cover `UOIe5tABg`: width 1fr, height 480 / Tablet width 100% height 360 / Phone 240; image fill cover.
- Featured Text `Gy25Tsjoe`: vertical, gap 20, padding 48 / 36 / 24 20, width 1fr (Tablet/Phone 100%).
  - Company row: horizontal, gap 8, align center; Mark 20px (stroke 2, `$text`); name Label width 1fr.
  - Headline: h2, H2. Summary: p, Lead.
  - Result row `xamElPI13`: horizontal, gap 10, align end, padding-top 16, border-top 1px `$border`;
    value h2 H2 `$accent` (auto width); label Body (1fr).
  - Read row: horizontal gap 6, Label "Read the use case" + Arrow Right 14px (stroke 1.5, `$text`).

### Customer Stats `YZNdciN1E` (top border)
- Content `t2LmB2hzQ`: padding 0, gap 0. Row `R4hoiCC_s`: horizontal (Phone vertical), align start.
- Cells: vertical gap 8, padding 44 40 / 32 24 / 24 20, width 1fr (Phone 100%); cells 2..4 border-left 1px `$border`
  (Phone: border-top 1px instead, no left). Value h2 H2; label Body. Cells hug their height (align start).

### All Stories `AZfREECh_` (top border)
- Content: padding 120 64 / 96 48 / 64 20, gap 56 / 56 / 36 (`Section` default).
- Heading group: vertical gap 20; eyebrow Label `$accent`; heading h2 H2 two runs, max-width 820.
- Stories Grid `Iblqor5mz`: grid, 3 columns min 240 (Tablet 2 columns min 200), gap 20, alignment center.
  Phone: vertical stack gap 16, cards width 100%.
- Story Card `VdJ7bFvVw`: link; vertical gap 18, padding 12 12 24 12, fill `$bg`, border 1px `$border`, radius 18.
  - Hover: y -4px, scale 1.1, shadow `0px 24px 48px -24px rgba(21, 23, 28, 0.25)`, spring 0.35s bounce 0.
    (Hovered card raised with z-index 1 so the scaled card sits over its neighbours.)
  - Cover: width 100%, height 220, radius 12.
  - Meta: vertical gap 10, padding 0 8. Company row gap 8, center: Mark 18px, name Label (1fr), category Small
    `$text2` (auto). Headline h4 H4. Summary Body.

### Quote Wall `IcGzhspnz` (top border, fill `$surface`)
- Content padding/gap as All Stories. Heading group as above (eyebrow "Jobs to be done").
- Quotes Grid `XjClFw17D`: CMS offset 1, limit 3 (items 2 to 4). Grid 3 columns min 240 (Tablet 2 min 200), gap 16.
  Phone: vertical stack gap 12.
- Quote Card: vertical, distribute space-between, padding 28, fill `$bg`, border 1px `$border`, radius 18,
  height 1fr (stretches to the row; Phone auto). Quote Lead in `$text`. Author: vertical gap 2, padding-top 24;
  name Label, role Small `$text2`. No hover.

### Page CTA `iw4b0NEj1`
Foundation `PageCTA` (component `fSTDtB1cM`, same variant as other pages). Covenant default CTA copy.

## /use-cases/[slug] (story detail `UUPt0HfzN`)

Layout template "Main". Breakpoint transition (page) spring 0.4s bounce 0.2 is the layout's page effect (foundation).

### Story Header `vqGTbvIk6` (no top border)
- Content `tbXSlpnZV`: vertical, align start, gap 24 / 24 / 36, padding 96 64 56 / 96 48 96 / 64 20 64.
- Back Link `mugCxovp3`: link to `/use-cases`; horizontal gap 6, align center; Arrow Left 14 (stroke 1.5, `$text2`)
  + Label `$text2` "All use cases". Hover: x -4px, scale 1.1, spring 0.3s bounce 0.
- Story Company: horizontal gap 10, center; Mark 24 (stroke 2, `$text`); name h4 H4.
- Title: h1 H1, max-width 960. Summary: Lead, max-width 640.

### Story Cover Section `iCjZlM32b` (no top border)
- Content padding 0 24 24 24 (Phone 0 12 12 12), gap 0.
- Story Cover `IQRNOdkhK`: width 100%, height 560 / 420 / 260, radius 20 / 20 / 14, clip, image fill cover.
  Scroll effect: onInView, viewport end, from y 32 scale 0.98, spring 500 / 60 / 1.

### Story Body `KFy_4VWTm` (top border)
- Content padding 120 64 / 96 48 / 64 20, gap 0 (Phone 36).
- Columns `LOBsb59Tj`: horizontal gap 80, align start. Tablet: vertical gap 48. Phone: vertical gap 40.
- Story Facts `a3APSoQHj`: width 260, position sticky, top 96. Tablet/Phone: relative, width 100%.
  - Three fact blocks: vertical gap 4, padding 16 0, border-top 1px `$border`; label Small `$text2`; value Label
    (Key term value: h4 H4 `$accent`). Labels renamed: Industry -> Category, Team size -> Who, Result -> Key term.
  - Then the result label: Small `$text2`, no border.
- Story Rich Text `asIoLzCAV`: width 1fr (Tablet/Phone 100%), max-width 680. Base style Inter 500 15px,
  -0.006em, 1.55em, `$text2`. `h2` uses preset H3 (paragraph spacing 40px), `p` uses preset Lead (paragraph spacing
  20px): each block after the first gets its preset spacing above it.

### Story Quote `mAKo9YoHo` (top border, fill `$surface`)
- Content padding 120 64 / 96 48 / 64 20, gap 28 / 28 / 36, align center.
- Quote mark: Quotes icon 28px, stroke 1.5, `$accent`.
- Quote text: h2 H2, centred, max-width 900, text-wrap balance.
- Author: horizontal gap 8; name Label; role Label `$text2`.

### Page CTA `irPK5KMjb`
Foundation `PageCTA`, Covenant default CTA copy.

## Effects summary

| Element | Trigger | Values | Transition |
| --- | --- | --- | --- |
| Featured Card | in view (end) | y 32 -> 0, scale 0.98 -> 1 | spring stiffness 500, damping 60, mass 1 |
| Featured Card | hover | scale 1.1, shadow 0 30 60 -30 rgba(21,23,28,0.25) | spring 0.4s, bounce 0 |
| Story Card | hover | y -4, scale 1.1, shadow 0 24 48 -24 rgba(21,23,28,0.25) | spring 0.35s, bounce 0 |
| Back Link | hover | x -4, scale 1.1 | spring 0.3s, bounce 0 |
| Story Cover | in view (end) | y 32 -> 0, scale 0.98 -> 1 | spring 500 / 60 / 1 |
| Page CTA plate | in view | foundation `PageCTA` | foundation |
