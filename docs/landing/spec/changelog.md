# /changelog and /changelog/[slug] spec

Framer sources: page `M3aXaoeK3` (breakpoints Desktop `yQCVSN8IX`, Tablet `Mt_cGjVnH`, Phone `FvE8rWWhz`) and
entry detail page `e861ZTNWV` (Desktop `tBjVwfLkN`, Tablet `C96nT6u4T`, Phone `ieKTSZlYO`), Changelog CMS
collection `oKg7mawh8` (fields Title, Slug, Date, Version, Tag, Summary, Cover, Body). Replica values below were
read by serializing the compound ids and diffing them against the primary.
Code: `web/src/landing/pages/{ChangelogPage,ChangelogEntryPage}.tsx`, `web/src/landing/sections/changelog/**`,
data `web/src/landing/content/milestones.ts`, covers `web/public/landing/changelog/cover-1..6.jpg`
(the template's six CMS covers, 1200 wide). References: `reference/changelog/*.jpg`.

Token ids: Background `fa640121`, Surface `ecd697ca`, Border `4a29f1fd`, Text Primary `07ff22ec`,
Text Secondary `1047f8e1`, Accent `450d9726`, Input Border `d7853166`, Input Focus `a7b4b732`.
Text presets: H1 `TB2u98oLS`, H2 `HmDLO_Rtk`, H3 `X07im2mzX`, H4 `TCvQ7cG0I`, Lead `JNQ4X1wce`, Body `kOxsGkmkK`,
Label `VuXCwP05s`, Small `qj414ABQK`.

## Changelog Hero (`Bfj_6uiqZ`)

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Outer `section` | padding 0 32, no top border | 0 24 | 0 16 |
| Inner | 1fr, max 1280, 1px left/right Border | same | same |
| Content | vertical, align start, gap 24, padding 112 64 88 64 | gap 24, 96 48 96 48 | gap 36, 64 20 64 20 |

Children, top to bottom:
- Eyebrow `p`, Label, Accent, width 1fr. Copy "Milestones".
- Title `h1`, H1, max width 900, width 100%, `text-wrap: balance`. Two runs: first Text Primary, second Text Secondary.
- Subscribe Form `form` (`mjKz6rV9p`): horizontal, align center, gap 8, padding 6, radius 14, 1px Border, Background fill,
  width 100%, max width 460.
  - Subscribe Email (FormPlainTextInputNode): width 1fr, height 44, padding 10 12, radius 10, 1px **Input Border**
    (rgba(136,136,136,0.1)), Background fill, Inter 500 15px, line height 1.2em, letter spacing 0, Text Primary,
    placeholder Text Secondary, focused border 1px **Input Focus** (rgb(0,153,255)), type email, required.
  - Subscribe Button: Submit Button instance (`isiuHjqjc`), height 44, width auto (the component frame is 200px wide,
    which is what renders), label "Subscribe".
- Subscribe Note `p`, Small, Text Secondary, width 1fr.

## Submit Button (`isiuHjqjc`) — used by Subscribe and Contact

All variants: `button`, horizontal, centred, gap 8, padding 0 18, radius 10, height 44, width 200, label Label preset in
Background colour. Transition on every variant: spring, duration 0.4s, bounce 0.2.

| Variant | id | Fill | Label |
| --- | --- | --- | --- |
| Default | `PwIZ_jXpI` | Text Primary | Label control |
| Default Hover (gesture hover) | `KSnsQbf45` | Accent | Label control |
| Pending | `BEdb9RSSj` | Text Secondary | "Sending…" |
| Success | `hE6iKKYv8` | Accent | "Sent. Thank you" in the template; Covenant uses "Thank you" (nothing is sent) |
| Error | `NR0_NmEKq` | Text Primary | "Error. Please try again" |

Forms have no backend: `useFakeSubmit` prevents default, shows Pending for 900ms, then Success (stays).
Code: `sections/changelog/SubmitButton.tsx`.

## Changelog List Section (`ULaxwbd1g`)

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Outer | padding 0 32, no top border | 0 24 | 0 16 |
| Content | gap 0, padding 0 64 120 64 | 0 48 96 48 | 0 20 64 20 |
| Release Entry | horizontal, align start, gap 56, padding 56 0 | gap 32 | vertical, gap 16, padding 36 0 |
| Release Meta | sticky, top 96, width 200, vertical gap 10 | width 140 | relative, horizontal, align center, width 100%, gap 10 |
| Release Cover | 100% x 360 | x 280 | x 200 |

- Release List: collection list over Changelog, sorting Date **descending**; 1px Border on top only. Code sorts by date,
  then version, descending (several milestones share a date).
- Release Entry: link to `/changelog/:slug`, cursor pointer, 1px Border at the bottom.
- Release Date: Label, Text Secondary, width 1fr; value is Date with `toDateString`, dateStyle long ("November 26, 2026").
- Release Version: horizontal gap 2, padding 3 8, radius 6, 1px Border, Surface fill; "v" + Version, both Small, Text Secondary.
- Release Content: width 1fr (Phone 100%), vertical, gap 16.
- Release Cover: CMS image fill (cover), 1px Border, radius 16. **Hover: scale 1.01, spring duration 0.4s bounce 0.**
- Release Tag: horizontal gap 6, centred; dot 6x6 radius 6 Accent; text Small Accent.
- Release Title `h2`: H3 preset. Release Summary `p`: Body preset, max width 620.
- Release Read: horizontal gap 6, centred; "Read the full update" Label (Text Primary); Arrow Right icon 14px Text Primary.

## Page CTA

Component `fSTDtB1cM`, variant Desktop. Template controls: Heading, Body, Primary Label/Link, Secondary Label/Link.
Rendered with the foundation `PageCTA` and the Covenant default copy.

## Entry detail (`e861ZTNWV`)

Entry Header (`EWO1Z2kfC`), no top border:

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Outer padding | 0 32 | 0 24 | 0 16 |
| Content | vertical, align start, gap 22, padding 96 64 48 64 | gap 22, 96 48 96 48 | gap 36, 64 20 64 20 |

- Back Link: link `/changelog`, horizontal gap 6, centred. Arrow Left 14px Text Secondary; text Label Text Secondary.
  **Hover: x -4px, scale 1.1, spring duration 0.3s bounce 0.**
- Entry Meta Row: horizontal gap 12, centred: date (Label, Text Secondary), version pill (as on the list), tag (as on the list).
- Entry Title `h1`: H1, max width 900. Entry Summary: Lead, max width 640.

Entry Cover Section (`rzV5FZ00g`), no top border, content padding 0 24 24 24 (Phone 0 12 12 12).
Entry Cover: 100% x 520 / 400 / 240, radius 20 / 20 / 14, 1px Border, CMS image fill.
**Appear effect: onInView, viewport end, from y 32px scale 0.98 to rest, spring stiffness 500 damping 60 mass 1** (`ScrollLift`).

Entry Body (`E3rEIs7fH`): 1px top border; content vertical, centred, gap 56 / 56 / 36, padding 120 64 / 96 48 / 64 20.
- Entry Rich Text: width 100%, max 680; base Inter 500 15px / 1.55em / -0.006em Text Secondary;
  `stylePresetHeading2` = H3 (paragraph spacing 40px), `stylePresetParagraph` = Lead (paragraph spacing 20px).
  Spacing is the block's own top margin, except on the first block.
- Entry Subscribe: link `/changelog`, cursor pointer, horizontal, centred, gap 16, padding 20 24, radius 16, 1px Border,
  Surface fill, max 680. Phone: vertical, align start. Bell icon 20 Accent; text column gap 2 (title Label, body Small Text
  Secondary); Arrow Right 16 Text Primary.
  **Hover: background Background, scale 1.1, tween 0.2s ease [0.44, 0, 0.56, 1].**

Then Page CTA (same as the list page).

## Icons

Phosphor (Framer set `omX0gWFPqDwhaiWwf6ab`, stroke 1.5): Arrow Right, Arrow Left, Bell. IconNodes cannot be exported with
`tree.toSVG`, so paths come from `@phosphor-icons/core` 2.1.1 regular (same named icons). `sections/changelog/icons.tsx`.

## Hover scale note

Framer serializes most template hover effects with scale 1.1; the lead confirmed on the live site that it applies, so it
is reproduced (Back Link, Entry Subscribe, contact channels). The Release Cover sets 1.01 explicitly.
