# Home, part B: spec extracted from Framer

Source: Framer project "Forgiving Needs (copy)", Home page `augiA20Il`. Breakpoints Desktop `WQLkyLRf1`
(>= 1200), Tablet `ebOjTho_n` (810 to 1199.98), Phone `jr0Z0EBZf` (< 810). Replica ids are
`${breakpointId}${primaryId}`; tablet and phone values below are the overrides those replicas store.
Tokens: BG, SURFACE, BORDER, TEXT, TEXT2, ACCENT, DANGER (see contract.md). Text styles: H1, H2, H3, H4, Lead,
Body, Label, Small (`t-*` classes). Icons are the Framer "Phosphor" set (`omX0gWFPqDwhaiWwf6ab`, controls
color / width / alpha). `width 1.5` renders as Phosphor regular (stroke 16 on the 256 grid); `width 2` as stroke 21.3.
`tree.toSVG` refuses icon nodes, so the SVGs are the Phosphor regular raw files (phosphor-icons/core `raw/regular`).

Every section uses the shell: outer `section` (100%, border-top 1px BORDER, padding 0 32 / 0 24 / 0 16) >
inner (max 1280, 1px left and right BORDER rails) > content. Reference shots:
`reference/home/<section>-<desktop|tablet|phone>.jpg`.

## Stats `s8Ki2GStV` -> HomeStats

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Content | padding 0, gap 0 | same | same |
| Stats Row `R8I1hAr78` | stack horizontal, gap 0, align start | grid 2 cols (min 50px), row height auto, gap 0 | stack vertical, gap 0 |
| Stat cell | width 1fr, padding 48 40, gap 10, vertical | height 1fr, padding 36 32 | width 100%, padding 28 20 |
| Borders | cells 2, 3, 4: left 1px BORDER | 2: left; 3: top; 4: left + top | 2, 3, 4: top |

Value: H2 (`h2`), width fill. Label: Body (`p`), width fill. No effects.

## Weekly Update `b_FQIsQ8W` -> HomeAgentLayer

- Content padding 0, gap 0. Columns `vbTsraA3Z`: horizontal, align center, gap 0 (tablet and phone: vertical).
- Text `vV7sg2rbl`: width 1fr, padding 96 56 96 64, gap 32 (tablet: width 100%, padding 80 48; phone: 56 20).
  - Eyebrow Label ACCENT. Heading H3 (`h3`), two runs: run 1 TEXT, run 2 TEXT2.
  - Points: vertical, gap 20. Point: horizontal, gap 14, align start. Icon Box 32x32, radius 9, fill SURFACE,
    border 1px BORDER, centred; icon 16px TEXT, width 1.5 (Sparkle, Chat Circle Text, Users).
    Point text: vertical, gap 4; title Label, body Body.
- Visual `PKGzNSSCy`: width 1fr, height 640, padding 56 40, centred, overflow clip, border-left 1px BORDER,
  image fill (cover) `9V9raZlhFsB0W0u7CYafv8IJUfQ.jpg` (alt "Soft iridescent gradient") -> `/landing/home/agent-plate.jpg`.
  Tablet: width 100%, height 560, padding 40 16, border-top 1px instead of left. Phone: height 480.
- Message Card `wUA_n_Q_r`: width 100%, max 440, padding 20, gap 14, radius 16, fill BG,
  shadows `0px 30px 60px -20px rgba(21,23,28,0.30)`, `0px 0px 0px 1px rgba(21,23,28,0.05)`.
  - **styleTransformEffect**: trigger onInView, viewport end, spring stiffness 500 damping 60 mass 1 delay 0,
    from opacity 1, y 40px, scale 0.98 to y 0, scale 1. (ScrollLift y 40 scale 0.98.)
  - Header: horizontal, gap 10, centred. Avatar 30x30, radius 9, fill TEXT, padding 5, children at bottom right;
    dot 9x9 radius 9 BG. Meta vertical gap 1: sender Label (text "Ondrel  ·  #product", two spaces each side),
    time Small TEXT2.
  - Title H4 (`h4`).
  - Line: horizontal, gap 10, align start. Tag width 92, padding 2 8, gap 6, radius 6, fill SURFACE; dot 6x6
    radius 6 (ACCENT, TEXT, DANGER for lines 1, 2, 3); tag text Small. Line text Small TEXT2, width 1fr.
  - Reactions: horizontal gap 6; pill padding 3 9, radius 999, border 1px BORDER, text Small.

## Stories `PXR78n2mP` -> HomeUseCases

- Content: padding 120 64 / 96 48 / 64 20, gap 56 / 56 / 36.
- Header: horizontal, align end, gap 40 (phone: vertical, align start, gap 20). Heading group: width 1fr, gap 20;
  eyebrow Label ACCENT; heading H2 two runs, max width 760. Link `/customers` -> `/use-cases`: horizontal,
  gap 6, padding 8 0, Label + Arrow Right 14px TEXT width 1.5.
- List `u94S1ddXg`: Stories CMS, limit 3, no sort. Grid 3 cols min 260, gap 20, alignment center
  (tablet: 2 cols min 200; phone: vertical stack gap 16).
- Story Card `KMi1pvSEa`: link `/customers/:slug`, width 1fr, padding 12 12 24 12, gap 18, radius 18, fill BG,
  border 1px BORDER, cursor pointer.
  - **hoverEffect**: opacity 1, x 0, y -4px, scale 1.1, rotate 0, shadow `0px 24px 48px -24px rgba(21,23,28,0.25)`,
    transition spring duration 0.35s bounce 0 delay 0.
  - Cover: height 220, radius 12, clip, image (cover) from CMS.
  - Meta: padding 0 8, gap 10. Company row: gap 8, centred; mark icon 18px TEXT width 2; company Label width 1fr;
    industry Small TEXT2 auto. Headline H4. Result: border-top 1px BORDER, padding-top 12, gap 8, centred;
    value H4 ACCENT auto; label Small TEXT2 1fr.

## Quote `TEBvGuPxi` -> HomeQuote

- Content: padding 112 64 / 96 48 / 64 20, gap 56 / 56 / 36, align center.
- List: Stories CMS filtered Featured = true, limit 1. Item: vertical, centred, gap 32.
  Quotes icon 32px ACCENT width 1.5. Quote text H2 (`h2`), centred, max 960, text-wrap balance.
  Author row: horizontal, gap 10, centred: name Label TEXT, "·" Label TEXT2, role Label TEXT2, company Label TEXT2.

## Pricing Preview `sDxb7qiFd` -> HomePricing

- Content: shell padding, align center. Heading group: vertical, centred, gap 20; eyebrow Label ACCENT centred;
  heading H2 two runs, centred, max 820.
- Plans List `mAdkVtiCE`: Plans CMS sorted by Order asc. Grid 4 cols min 240, gap 16 (tablet: 2 cols min 200;
  phone: vertical stack gap 12, card height auto, width 100%).
- Plan Card `pgW6y25wr`: height 1fr, padding 24, gap 20, radius 18, fill BG, border 1px BORDER.
  - **hoverEffect**: y -4px, scale 1.1, shadow `0px 24px 48px -24px rgba(21,23,28,0.22)`, spring duration 0.35s bounce 0.
  - Head: horizontal gap 8, centred; name H4 1fr; badge (visible when Highlighted) fill ACCENT, radius 999,
    padding 3 8, text Small BG "Most popular" (here the plan's `badge`).
  - Description Body. Price row: horizontal, wrap, align end, gap 4 8; price H2; unit Small TEXT2.
  - Button: Button component default variant (Primary), height 40, width 100%, label from CMS, link `/pricing`
    (here the plan's `buttonHref`).
  - Features: border-top 1px BORDER, padding-top 16, gap 10; row gap 8 centred; Check 14px ACCENT width 1.5; text Small.

## FAQ `kY7AleVo1` -> HomeFAQ

- Content: padding 120 64 / 96 48 / 64 20, gap 0 / 0 / 36.
- Columns: horizontal, gap 64, align start (tablet and phone: vertical, gap 40).
- Intro: width 340 (tablet and phone: 100%), gap 24: eyebrow Label ACCENT, heading H2 (one run), body Body,
  Button Secondary 40px "Contact us" `/contact`.
- FAQ List `m7ss9f4S2`: width 1fr, border-top 1px BORDER, FAQs CMS sorted by Order; each row is the FAQ Item
  component (`VrMDv2AIP`), rendered by the foundation `FAQList`.

## Changelog Preview `zsKT4BHwt` -> HomeMilestones

- Inner carries padding 120 64 / 96 48 / 64 20 and gap 56 / 56 / 36 (same as the shell content).
- Header: as Stories (align end, gap 40; phone vertical gap 20). Eyebrow width auto. Heading H2 two runs, 1fr.
  Link `/changelog` "See every update", gap 6, padding 8 0, Arrow Right 14px.
- List `rls40VGtU`: Changelog CMS sorted by Date desc, limit 4, border-top 1px BORDER.
- Entry `ZlJ6Gzkd4`: link `/changelog/:slug`, horizontal, gap 48, align start, padding 32 0, border-bottom 1px
  BORDER (tablet gap 32; phone vertical, gap 14, padding 28 0).
  - **hoverEffect**: x 6px, y 0, scale 1.1, no shadow, spring duration 0.35s bounce 0.
  - Meta: width 180 (tablet 120; phone 100%, horizontal, centred, gap 12), vertical gap 10. Date Label TEXT2,
    width 1fr, format `toDateString` dateStyle medium ("Sep 22, 2026"). Version chip: padding 3 8, gap 2, radius 6,
    fill SURFACE, border 1px BORDER; "v" + version, Small TEXT2.
  - Content: 1fr, gap 10. Tag: gap 6, dot 6x6 ACCENT, text Small ACCENT. Title H4. Summary Body, max 560.
  - Cover: 240x150 (tablet 200x125; phone 100% x 200), radius 12, border 1px BORDER, clip, image (cover).

## Closing CTA `HV9whzZS4` -> HomeClosingCTA

- Content: padding 24 (phone 12), gap 0.
- CTA Plate `CMDuX4Ssr`: width 100%, padding 120 32 (phone 80 20), gap 28, radius 24 (phone 18), clip, centred,
  image fill (cover) `j0CEjC9tR7tO7Bk2OBfJ7BpCJ4.jpg` (alt "Blue to pink gradient sky") -> `/landing/home/cta-plate.jpg`.
  - **styleTransformEffect**: onInView, viewport end, spring stiffness 500 damping 60 mass 1, from y 40px scale 0.96
    to y 0 scale 1. (ScrollLift y 40 scale 0.96.) This differs from the Page CTA component (y 32, 0.98, padding 96,
    gap 24, H2), so PageCTA is not used here.
  - Heading H1 (`h2` tag), centred, fill. Body Lead in TEXT, centred, max 520.
  - Actions: horizontal gap 10: Button Secondary 44px, Button Primary 44px.

## Effects summary

| Node | Effect | Values |
| --- | --- | --- |
| Message Card `wUA_n_Q_r` | styleTransformEffect | onInView, end; spring 500 / 60 / 1; y 40px -> 0, scale 0.98 -> 1 |
| Story Card `KMi1pvSEa` | hoverEffect | y -4px, scale 1.1, shadow 0 24 48 -24 rgba(21,23,28,0.25); spring 0.35s bounce 0 |
| Plan Card `pgW6y25wr` | hoverEffect | y -4px, scale 1.1, shadow 0 24 48 -24 rgba(21,23,28,0.22); spring 0.35s bounce 0 |
| Changelog Entry `ZlJ6Gzkd4` | hoverEffect | x 6px, scale 1.1; spring 0.35s bounce 0 |
| CTA Plate `CMDuX4Ssr` | styleTransformEffect | onInView, end; spring 500 / 60 / 1; y 40px -> 0, scale 0.96 -> 1 |
| Buttons | component variants | foundation `Button` (spring 0.25s bounce 0) |

No appearEffect on any node in these sections. The lead confirmed on the live site that the template hovers
include scale 1.1, so it is reproduced as stored.
