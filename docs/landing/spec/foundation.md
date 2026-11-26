# Foundation spec (shared styles and components)

Source: Framer project "Forgiving Needs copy" (template Ondrel), read with the Framer MCP (read only), plus the live
template at https://forgiving-needs-325167.framer.app for runtime checks (same renderer as our harness).
Code: `web/src/landing/styles/landing.css`, `web/src/landing/components/*`. Reference shots: `reference/shared/`.

Framer draws borders inside a frame without taking layout space. Every border below is reproduced with an absolutely
positioned overlay (`::before` / `::after`, `pointer-events: none`) so sizes match Framer to the pixel.

## Colour styles (ColorStyleTokenNode)

| Framer token | Name | Value | CSS |
| --- | --- | --- | --- |
| fa640121 | Background | rgb(255, 255, 255) | `--c-bg` |
| ecd697ca | Surface | rgb(244, 245, 247) | `--c-surface` |
| 4a29f1fd | Border | rgb(227, 230, 235) | `--c-border` |
| 07ff22ec | Text Primary | rgb(21, 23, 28) | `--c-text` |
| 1047f8e1 | Text Secondary | rgb(107, 115, 130) | `--c-text-2` |
| 450d9726 | Accent | rgb(43, 89, 255) | `--c-accent` |
| 46b360b8 | Danger | rgb(229, 72, 77) | `--c-danger` |
| 3aef1929 | Glass | rgba(255, 255, 255, 0.72) | `--c-glass` |
| d7853166 | Input Border | rgba(136, 136, 136, 0.1) | `--c-input-border` |
| a7b4b732 | Input Focus | rgb(0, 153, 255) | `--c-input-focus` |
| 1cf32c1b | Transparent | rgba(0, 0, 0, 0) | (use `transparent`) |

## Text styles (TextStylePresetNode), confirmed

| Class | Preset id | Font | Weight | 1200+ / 810 / 0 size | Letter spacing | Line height | Colour | Tag |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `t-h1` | TB2u98oLS | Inter Display | 600 | 72 / 56 / 42 | -0.035em | 1em | Text Primary | h1 |
| `t-h2` | HmDLO_Rtk | Inter Display | 500 | 52 / 42 / 34 | -0.03em | 1.04em | Text Primary | h2 |
| `t-h3` | X07im2mzX | Inter Display | 500 | 34 / 30 / 26 | -0.02em | 1.16em | Text Primary | h2 |
| `t-h4` | TCvQ7cG0I | Inter Display | 500 | 20 / 20 / 19 | -0.01em | 1.25em | Text Primary | h4 |
| `t-lead` | JNQ4X1wce | Inter | 500 | 18 / 18 / 17 | -0.011em | 1.5em | Text Secondary | p |
| `t-body` | kOxsGkmkK | Inter | 500 | 15 / 15 / 15 | -0.006em | 1.55em | Text Secondary | p |
| `t-label` | VuXCwP05s | Inter | 500 | 13 / 13 / 13 | none (0) | 1.3em | Text Primary | p |
| `t-small` | qj414ABQK | Inter | 500 | 12 / 12 / 12 | none (0) | 1.35em | Text Primary | p |

- No OpenType features on any preset (live computed `font-feature-settings: normal`). Label and Small have no letter
  spacing. Paragraph spacing (H1 0, H2-H4 40px, others 20px) only applies between paragraphs inside one text node;
  the template never has multi-paragraph nodes outside CMS rich text, so it is not reproduced globally.
- Inter Display = Inter variable with `font-variation-settings: "opsz" 32`. Font family `var(--font-inter), "Inter"`.
- Live check: nav link computed 500 / 13px / 16.9px line height / rgb(21,23,28), identical to our harness render.

Link styles (LinkStylePresetNode):
- `Nav Link` sXawT3qmx -> `.link-nav`: Text Primary, hover Text Secondary, current Accent; tween 0.2s ease (0.44,0,0.56,1).
- `Footer Link` QtfT4K64G -> `.link-footer`: Text Secondary, hover Text Primary, current Text Primary; same tween.
- Current = `aria-current="page"`.

## Base reset

Scoped to `.landing-root` with `:where()` (element specificity, so module classes always win): border-box, zero margins
and padding on text and list elements, links inherit colour without underline, buttons unstyled. `.landing-root`:
Background fill, Text Primary colour, antialiased font smoothing, `overflow-x: clip` (layout `Main` clips), flex column.
`body:has(.landing-root)` gets the Background colour.

## Layout template `Main` (bjIxcK_F0)

Breakpoints Desktop QkG00Ej1g (min 1200), Tablet C_pxGSkrf (810 to 1199.98), Phone UFASUBhQr (max 809.98).
Frame: Background fill, vertical stack, centred, gap 0, overflow clip. Children: `Navigation` (component instance,
width 100%, position sticky, top 0, z-index 5; Phone breakpoint sets variant Phone, Tablet keeps Desktop), page
placeholder, `Footer`, `Template Dock` (not rebuilt). No flow effect on the template.

Page transition (Home primary breakpoint WQLkyLRf1 `pageEffects.all`):
- enter: from opacity 0, y 16px (x 0, scale 1), tween ease [0.22, 1, 0.36, 1], 0.5s.
- exit: opacity 0, tween ease [0.4, 0, 1, 1], 0.2s.
Implemented in `PageTransition` (wraps the page in `<main>`): the enter runs on client navigation only, never on first
load, so content is visible without JS. Exit is not reproduced (App Router unmounts the old page immediately).

## Section shell (confirmed on Home `Features` ZN5NVUdId, /features `Features Hero` ThwQrearH, `Security` LNQvhFLFo)

| Layer | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| `<Name>` (section tag, width 100%, stack centred, 1px top border) | padding 0 32 | 0 24 | 0 16 |
| `<Name> Inner` (1fr, max 1280, 1px left/right rails) | | | |
| `<Name> Content` | padding 120 64, gap 56 | 96 48, gap 56 | 64 20, gap 36 |
| Page head content (`Features Hero Content`, no top border, centred) | padding 112 64 88, gap 24 | 96 48, gap 24 | 64 20, gap 36 |
| `surface` (`Security`) | Surface fill on `<Name>` | same | same |

## Button (Cd7LjBF5C)

Variables: Label (string), Link. All variants: stack horizontal, centred, gap 6, padding 0 16, radius 10,
height 40 (instances use 44 in Page CTA and the nav drawer), width auto, cursor pointer,
transition spring duration 0.25s bounce 0. Label: Text/Label.

| Variant | id | Fill | Border | Shadow | Label colour | Label scale |
| --- | --- | --- | --- | --- | --- | --- |
| Primary | klp6ZcQBk | Text Primary | none | none | Background | 1 |
| Primary Hover (hover) | Zl8fSSwsZ | Accent | none | none | Background | 1 |
| Primary Pressed (pressed) | Bt0D6Fn0C | Accent | none | inset 0 2px 4px 0 rgba(0,0,0,0.25) | Background | 0.97 |
| Secondary | ZjQZNDm4b | Background | 1px Border | none | Text Primary | 1 |
| Secondary Hover (hover) | JHvJeQ8ul | Surface | 1px Border | none | Text Primary | 1 |
| Secondary Pressed (pressed) | g4FXjDGGP | Border | 1px Border | inset 0 2px 4px 0 rgba(0,0,0,0.08) | Text Primary | 0.97 |

Code: `motion` variants rest / hover (whileHover) / pressed (whileTap), same spring.

## Navigation (U2c0fyMuW)

Variants Desktop VuOsdAYtB (Desktop and Tablet), Phone Pglm8NsFd, Phone Open AuLykuXWe.
- Frame: Background fill, 1px bottom border (Border), padding 0 32 (Phone 0 16), clip, height 64 (Phone Open auto),
  transition spring 0.45s bounce 0. No backdrop blur, no shadow; solid Background. Sticky top 0, z-index 5.
- `Nav Inner`: height 64, width 100%, max 1280, row, space-between, centred.
- `Logo` (link `/`): row gap 9; `Logo Mark` 22x22 frame, radius 7, Text Primary fill, padding 4, aligned end/end,
  holding `Logo Dot` 8x8 Background circle (bottom right). It is a frame, not a vector, so `tree.toSVG` cannot export
  it; rebuilt as an inline SVG (rect 22 r7 + circle cx14 cy14 r4) in `LogoMark.tsx`. Wordmark Text/H4.
- `Nav Links`: row gap 32, Text/Label + Nav Link. Hidden on Phone.
- `Nav Actions`: row gap 18: text link (Label + Nav Link, hidden on Phone), Primary Button 40px (hidden on Phone),
  `Menu Button` 40x40 radius 10 with Phosphor `List` 22px stroke 1.5 Text Primary (Phone only), `Close Button` same
  with Phosphor `X` (Phone Open only). Tap Menu -> Phone Open, tap Close -> Phone.
- `Drawer` (visible on Phone variants, clipped by the 64px height when closed): column gap 4, padding 8 0 24, width 100%.
  Each item: row, padding 12 0, 1px bottom border, link in Text/H3 + Nav Link. `Drawer Actions`: row gap 10, padding
  top 16: Secondary + Primary Buttons, height 44, width 1fr each.
- Code: the drawer is a `motion.div` animating height 0 <-> auto with spring 0.45s bounce 0 (same visual as Framer's
  64 -> auto frame change). Closes on link tap, Escape, and when the viewport grows past Phone.

## Footer (layout `Main`, xQFxeZ3LK)

| Layer | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| `Footer` (footer tag, 1px top border, clip) | padding 0 32 | 0 24 | 0 16 |
| `Footer Inner` (1fr, max 1280, rails, clip) | | | |
| `Footer Top` | row, gap 48, padding 80 64 64 | row, gap 32, padding 72 48 56 | column, gap 36, padding 56 20 40 |
| `Footer Brand` | 1fr, column gap 20 | same | full width |
| `Footer Column` x3 | width 160, column gap 14 | width 120 | width 100% |
| `Footer Wordmark Band` (clip) | padding 0 48 | 0 48 | 0 16 |
| `Footer Bottom` (1px top border) | row space-between, padding 20 64 | padding 20 48 | column, gap 6, padding 20 |

- Logo as in nav (gap 9). Tagline Text/Body, max width 320, width 100%.
- Status pill: 1px Border, padding 6 12, radius 999, row gap 8; dot 7x7 Accent radius 7; text Text/Small (Text Primary).
- Column title Text/Label; links Text/Body + Footer Link (external ones open in a new tab).
- `Footer Big Wordmark`: Inter Display 600, letter spacing -0.05em, line height 0.8em, centred, `user-select: none`,
  font size auto-fit to the band width, text fill `linear-gradient(0deg, rgb(226,229,235) 0%, rgba(244,245,247,0.4) 70%,
  rgba(255,255,255,0) 100%)`. Live Framer renders it as an SVG `viewBox="0 0 44.8 13"` (text measured at 16px, box
  height 12.8 rounded to 13) scaled to the width. Ours: band is a size container, font size `calc(100cqw / 3.9864)`
  (3.9864em = measured advance of "Covenant" in Inter opsz 32 / 600 / -0.05em), gradient via `background-clip: text`
  on an inner span, line height 0.8em plus 0.0125em bottom padding (the 13/12.8 rounding). Live "Ondrel" footer
  height at 1200 = 665px; ours with "Covenant" is 575px because the longer word gets a smaller fitted size.
- Copyright and note: Text/Small in Text Secondary.

## Page CTA (fSTDtB1cM)

Variants Desktop U8gHAYHok, Tablet ClERUCXIS, Phone tYmWWmQbK (chosen by media query in code).
Variables: Heading, Body, Primary Label/Link, Secondary Label/Link.
- Section shell: section tag, 1px top border, padding 0 32 / 0 24 / 0 16; `Inner` 1fr max 1280 rails.
- `Content`: padding 24 (Phone 12).
- `Plate`: image fill `cta-plate.jpg` (asset j0CEjC9tR7tO7Bk2OBfJ7BpCJ4, 2400x1600, cover, centred; saved to
  `web/public/landing/shared/cta-plate.jpg`), radius 24 (Phone 18), clip, column centred, gap 24, padding 96 32
  (Phone 72 20). Scroll lift: `styleTransformEffect` onInView, viewport end, spring 500/60/1, from y 32px scale 0.98.
- Heading Text/H2 centred, width fill, h2. Body Text/Lead in Text Primary, centred, max width 520.
- Actions row gap 10: Secondary then Primary, both 44px.

## FAQ Item (VrMDv2AIP) and FAQ List

- Variants Closed eEX0wI64E (tap -> Open), Open q_jyW1Jay (tap -> Closed), Closed Hover XrJKgzDCu (hover of Closed).
  Transition spring 0.35s bounce 0.
- Item: 1px bottom border, clip, cursor pointer. `FAQ Row`: row, centred, gap 24, padding 22 0; Question Text/H4 (1fr,
  no select); `FAQ Icon` 28x28 circle, 1px Border, centred Phosphor `Plus` 14px stroke 1.5 Text Primary.
  Open: icon Surface fill and rotate 45deg. Closed Hover: icon Surface fill.
- `FAQ Answer`: hidden when Closed; padding 0 64 24 0; Text/Body.
- `FAQ List` (Home): column gap 0, 1px top border, width 1fr; items width 100%. No flow effect found on the list.
- Code: answer height 0 <-> auto plus opacity, same spring.

## Feature Card (Gb5Q7P0K_) and `Capabilities Grid` (/features aFmXCnkFi)

- Grid: Border fill, gap 1px, radius 18, clip, 1px Border border; Desktop grid 3 columns (min 240), Tablet 2 (min 200),
  Phone vertical stack gap 1px; rows auto. Scroll lift y 32 / scale 0.98, spring 500/60/1, viewport end.
- Card (variant Default; Phone variant on Phone): Background fill, column gap 14, padding 32 (Phone 24 20),
  height 100% (Phone auto). Icon Box 36x36 radius 10 Surface fill 1px Border, icon 18px Text Primary. Title Text/H4,
  body Text/Body.
- Hover (hoverEffect): Surface fill AND scale 1.1, tween (0.44,0,0.56,1) 0.25s. The scale was verified on the live
  template (computed transform `matrix(1.1, 0, 0, 1.1, 0, 0)` while hovered).

## Integration Tile (ApInVGTjW) and `Integrations Grid` (/features b0k3UxmJm)

- Grid: gap 12, 4 columns Desktop (min 200), 2 Tablet (min 200), 2 Phone (min 140), rows auto; tiles 1fr x 1fr.
- Tile: Background, 1px Border, radius 14, padding 20, column gap 10; icon 22px Text Primary; title Text/Label; body
  Text/Small in Text Secondary.
- Hover: y -3px, scale 1.1, shadow `0px 16px 32px -16px rgba(21, 23, 28, 0.22)`, spring 0.3s bounce 0
  (live computed `matrix(1.1, 0, 0, 1.1, 0, -3)`).

## Motion helpers

- `ScrollLift`: `styleTransformEffect` trigger onInView, viewport end, spring stiffness 500 damping 60 mass 1, from
  y 32px scale 0.98 (props `y`, `scale` for the 40/0.98 and 56/0.96 variants). Once; reduced motion renders static.

## Icons

Template icon set: Phosphor (omX0gWFPqDwhaiWwf6ab), line icons with stroke width 1.5. IconNodes cannot be exported
with `tree.toSVG`, so `components/icons.tsx` draws List, X and Plus on a 24 grid with stroke 1.5 and round caps.
