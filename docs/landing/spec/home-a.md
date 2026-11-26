# Home, part A: Hero and Features (spec extracted from Framer)

Source: Framer project "Ondrel" (read only), Home page `augiA20Il`. Breakpoints: Desktop `WQLkyLRf1` (>= 1200),
Tablet `ebOjTho_n` (810 to 1199.98), Phone `jr0Z0EBZf` (< 810). Replica ids are `${breakpoint}${primaryId}`.
Tokens are the contract names (`bg`, `surface`, `border`, `text`, `text-2`, `accent`, `danger`, `glass`).
Text styles are the contract classes (`t-h1` ... `t-small`). Rects are Desktop, relative to the parent.

Framer draws borders inside the frame (no layout space). The code uses inset box-shadows for bordered auto-size
frames so sizes match (for example the announcement pill is 30px tall: 4 + 22 + 4, the border adds nothing).

Reference screenshots: `reference/home/hero-{desktop,tablet,phone}.jpg`, `reference/home/features-{desktop,tablet,phone}.jpg`.
Built output: `docs/landing/screens/home/hero-{1200,810,390}.jpg`, `features-{1200,810,390}.jpg`.

Code: `web/src/landing/sections/home/HomeHero.tsx`, `hero/*`, `HomeFeatures.tsx`, `features/*`.

## Icons

Framer icon nodes (set "Phosphor", `omX0gWFPqDwhaiWwf6ab`) cannot be exported with `tree.toSVG` (the API only
exports vector, shape or SVG nodes). Icons are Phosphor's own paths (core 2.1.1, 256 grid) inlined in
`hero/icons.tsx`. Framer stroke 1.5 equals Phosphor "regular" (16 on 256 = 1.5 on 24); the logo row marks use
stroke 2 and are drawn with the "bold" weight (2.25 on 24, the nearest published weight).

## Section `Hero` (NPB4fqmao)

`section`, stack vertical, align center, gap 64, padding 96 32 0, overflow clip, width 100%. Height 1470 (Desktop).
Tablet: padding 80 24 0. Phone: gap 40, padding 56 16 0. Sits directly under the 64px navigation, no top border.

### Hero Grid Lines (gZbs9ZNjf)
Absolute, top 0, left 0, right 0, height 640, padding 0 32 (Tablet 0 24, Phone 0 16), pointer-events none, z 0,
stack horizontal, distribute center. Child `Grid Columns`: max-width 1280, width 1fr, border-right 1px `border`;
its child `Grid Column 1`: width 1fr, border-left 1px `border`. Two masks, intersected:
- `radial-gradient(36% 46% at 50% 44%, rgba(0,0,0,0) 35%, rgba(0,0,0,1) 100%)`
- `linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)`
(Framer labels the mode "luminance" but renders by alpha; the live site shows the rails, so alpha masks are used.)

### Hero Intro (SJSajtdEv)
Stack vertical, align center, gap 24, max-width 880, width 100%, z 1. Rect 160,96 880x380.
- `Hero Announcement` (CpFUNRuLy): link `/changelog`; stack horizontal, align center, gap 8, padding 4 12 4 4,
  fill `bg`, border 1px `border`, radius 999. 364x30.
  hoverEffect: backgroundColor `surface`, scale 1.1 (verified on the live site), tween 0.2s ease [0.44, 0, 0.56, 1].
  - `Announcement Chip`: fill `accent`, padding 3 8, radius 999; text `t-small` in `bg` ("New").
  - `Announcement Text`: `t-label`, `text`. Phone override: shorter text, text-align start.
  - `Announcement Arrow`: Phosphor Caret Right, 12px, `text-2`, stroke 1.5.
- `Hero Heading` (QFrNlSUIe): `h1`, `t-h1`, center, text-wrap balance, width 1fr. 880x144 (two lines).
  textEffect: trigger onMount, tokenization word, delay 0.05s (per word stagger), replay false;
  from opacity 0, x 0, y 14px, scale 1, rotate 0, blur 6px; transition spring, duration 0.7s, bounce 0, delay 0.05s.
- `Hero Subheading` (zUQ3FYl4_): `t-lead` (text-2), center, balance, max-width 560, width 100%.
- `Hero Actions` (bggdNJN6S): stack horizontal, gap 10. `Button` (Cd7LjBF5C) secondary variant (ZjQZNDm4b) then
  primary, both 40px (md).
- `Hero Note` (CVeOdgOeQ): `t-small`, `text-2`, center, width 1fr. Separator is "  ·  ".

### Hero Showcase (A55NpRgEt)
Image fill `RHsfUQ9mSQJ5F6qbGUl40nif1IM.jpg` (alt "Soft evening sky", cover) -> `/landing/home/hero-plate.jpg`.
Stack vertical, align center, height 700, max-width 1280, width 100%, padding 72 72 0, radius 24, overflow clip,
z 1. Rect 32,540 1136x700. Tablet: height 620, padding 48 32 0. Phone: height 540, padding 24 12 0, radius 18.

#### App Window (LKGAwSLlP)
Fill `bg`, radius 14, overflow clip, height 660 (Phone 560), max-width 1040, width 100%, stack vertical.
Shadow `0px 40px 80px -24px rgba(21,23,28,0.35), 0px 0px 0px 1px rgba(21,23,28,0.06)`.
styleTransformEffect: trigger onInView, viewport end, spring stiffness 500 damping 60 mass 1 delay 0;
from opacity 1, y 56px, scale 0.96 to y 0, scale 1. (Built with `ScrollLift y={56} scale={0.96}`.)

- `Window Bar` (jMkX4e5tE): height 38, fill `surface`, border-bottom 1px `border`, padding 0 14, gap 7, align center.
  Dots 10x10 radius 10 fill `border` (x3). `Bar Address`: `t-small`, `text-2`, center, width 1fr (Phone: one-line
  truncation). `Bar Spacer` 44x10.
- `Window Body` (pMt4Ci_bw): stack horizontal, align start, height 1fr.
- `Sidebar` (indWVZ4co): width 216 (Tablet 180, Phone hidden), height 100%, padding 14 10, gap 2, fill `bg`,
  border-right 1px `border`.
  - Workspace: gap 8, padding 4 6 10 6, align center. Mark 20x20 fill `text`, radius 6, padding 4, content
    bottom-right; dot 7x7 radius 7 `bg`. Name `t-label` 1fr. Caret Down 12 `text-2`.
  - Search: border 1px `border`, radius 8, padding 6 8, gap 6. Magnifying Glass 13 `text-2`; "Search" and "⌘K"
    `t-small` `text-2`.
  - Gap 8. Nav items: gap 8, padding 6 8, radius 8; icon 15 `text-2`, label `t-small` `text-2` 1fr.
    Active item: fill `surface`, icon and label `text`. (Template: Home, Inbox (count 12), My work, Roadmap (active),
    Releases, Reports.)
  - Gap 14. Group label `t-small` `text-2`. Gap 4. Project rows: gap 10, padding 6 8; dot 8x8 radius 3
    (`accent`, `text`, `text-2`, `border`); label `t-small`.
- `Main` (MgFSGVVVX): stack vertical, width 1fr.
  - `Main Header`: padding 18 22 12 (Phone 14 16 10), space-between, align center. Title group gap 10: title
    `t-h4`; chip fill `surface`, border 1px `border`, padding 2 8, radius 6, `t-small` `text-2`.
    Actions (Phone hidden) gap 10: avatars gap 4, each 24x24 radius 24, border 2px `bg`, fills `accent`, `text`,
    `text-2`, initials `t-small` `bg`; Share button border 1px `border`, padding 5 10, radius 8, `t-small`.
  - `Main Tabs`: height 34, border-bottom 1px, gap 20 (Phone 14), padding 0 22 (Phone 0 16), align end. Each tab
    stack vertical gap 8: label `t-small` (active `text`, others `text-2`), underline 2px (active `accent`).
  - `Main Timeline` (Phone hidden): Months row height 36, border-bottom; label column 190; three month columns
    1fr, border-left 1px, padding 0 12, `t-small` `text-2`. Rows height 52, border-bottom; label column 190
    padding 0 22, name `t-small` one-line truncation; track 1fr, padding-left 12: offset spacer then a bar
    height 28, radius 7, padding 0 10, label `t-small` truncated.
    Row offsets / bar widths (px): 0/150, 90/190, 170/260, 240/230, 390/170, 520/110, 590/130.
    Bar styles: done = fill `surface` + border 1px, `text-2`; active = fill `accent`, label `bg`;
    upcoming = fill `bg` + border 1px, `text-2`.
    `Today Line`: absolute left 534, top 36, bottom 0, width 2, `accent`, z 1. `Today Chip`: absolute left 513,
    top 8, fill `accent`, padding 2 7, radius 6, `t-small` `bg`, z 2. Both hidden on Tablet and Phone.
  - `Phone Timeline` (visible on Phone only): rows border-bottom, padding 12 16, gap 8, stack vertical. Top: gap 8,
    name `t-small` 1fr, right text `t-small` `text-2`. Track height 6 radius 6 fill `surface`, fill bar height 6
    radius 6 (`border` at 100% for done rows, `accent` at the progress share for active rows, none otherwise).

#### Update Card (Yr9Ys5uBd)
Absolute right 40, bottom 40 (Phone: left 12, bottom 12, width 334), width 320, z 2, fill `bg`, radius 14,
padding 16, gap 12, stack vertical. Shadow `0px 24px 48px -12px rgba(21,23,28,0.28), 0px 0px 0px 1px rgba(21,23,28,0.06)`.
Header gap 8: Sparkle 15 `accent`; title `t-label` 1fr; time `t-small` `text-2`. Body `t-small` `text-2`.
Actions gap 8: outline button border 1px, padding 5 10, radius 8, `t-small`; dark button fill `text`, `t-small` `bg`.
No effects.

### Logo Row (X47suo8O0)
Stack vertical, align center, gap 28 (Phone 20), padding 8 0 88 (Phone 0 0 56), max-width 1280, width 100%, z 1.
- Caption: `t-label`, `text-2`, center.
- `Logo Row Marks` (D09F6HI6d): stack horizontal, gap 72 (Phone 40), overflow clip, mask
  `linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 88%, rgba(0,0,0,0) 100%)`.
  tickerEffect: velocity 40 (px/s, leftwards), hoverModifier 40%, directionModifier default, draggable false.
  Items: opacity 0.72, gap 8, icon 20px `text` stroke 2, name `t-h4`.

## Section `Features` (ZN5NVUdId)

Outer `section`: border-top 1px `border`, padding 0 32 (Tablet 0 24, Phone 0 16), align center (the shared
`Section` shell). Inner `Features Inner`: max-width 1280, rails border-left/right 1px. Content padding 0, gap 0.
Height 3331 Desktop, 3180 Tablet, 3340 Phone.

- `Features Intro` (DMM6hrpjG): stack vertical, gap 20, padding 120 64 96 (Tablet 96 48 72, Phone 64 20 48).
  Eyebrow `t-label` `accent`. Heading `t-h2`, two runs (`text`, then `text-2`), max-width 1040.
- `Features Body` (Mq3MPC4oZ): border-top 1px `border`, stack horizontal (Phone vertical).
  - `Feature Index Column` (g8H4WfxzO): position sticky, top 64, width 300, padding 64 32 64 40. Hidden on
    Tablet and Phone.
    - `Feature Index` instance of component ZZU0_EyGl (variants Step 1 `vrwczXarb`, Step 2 `AVz3yfhId`,
      Step 3 `vItF3ab7G`, Step 4 `P57fpQPgr`; transition spring 0.4s bounce 0). Width 100% (228). Stack vertical,
      gap 16. Items: stack horizontal gap 14, align center; marker 2x22 (`accent` when current, else `border`);
      label `t-h4`, opacity 1 when current, else 0.45.
    - scrollVariantEffect: trigger onScrollTarget, threshold 0.5, replay true; sections: `uS2tl_NUo` -> Step 1,
      `VQ4zHtSE9` -> Step 2, `HWW9XIhhZ` -> Step 3, `I8J516_yP` -> Step 4. Built as: the current step is the last
      block whose top is at or above 50% of the viewport height (scroll listener, rAF throttled); scrolling back
      returns to earlier steps.
  - `Feature Blocks` (XQ180NDWp): width 1fr, border-left 1px (Tablet and Phone transparent), stack vertical,
    gap 112 (Phone 72), padding 64 64 120 (Tablet 56 48 96, Phone 40 20 64).
    Each block (`elementId` feature-1..4, scrollTargetEnabled): stack vertical, gap 40. Statement `t-h3`, two runs,
    max-width 680. Every panel has styleTransformEffect onInView, viewport end, spring 500/60/1, from y 40px,
    scale 0.98 (`ScrollLift y={40} scale={0.98}`).

### 1. `Feature Requests Panel` (QfZPhXaDH)
Fill `surface`, height 440 (Phone 400), overflow clip, padding 48 48 0 (Phone 20 16 0), radius 20 (Phone 16),
align center. `Inbox Card`: fill `bg`, radius 14, overflow clip, width 100%, shadow
`0px 20px 40px -16px rgba(21,23,28,0.18), 0px 0px 0px 1px rgba(21,23,28,0.06)`.
- Header: padding 14 18, gap 10, border-bottom. Tray icon 16 `text`; title `t-label`; spacer 1fr; filters
  (Phone hidden): pill padding 4 10 radius 999, `t-small`; first fill `text` with `bg` text, others border 1px
  `border`, `text-2`.
- Rows: padding 14 18 (Phone 12 14), gap 16 (Phone 12), border-bottom, align center.
  Votes box 40 wide, border 1px, radius 8, padding 4 0, stack vertical center: caret 12 (`accent` rows 1 and 4,
  else `text-2`), count `t-small`. Text 1fr gap 3: title `t-label`, detail `t-small` `text-2`, both truncated.
  Source chip (Phone hidden): fill `surface`, padding 3 8, radius 6, `t-small` `text-2`.
  Status (Phone hidden): width 110, gap 6, dot 7x7 radius 7, `t-small`.

### 2. `Feature Roadmap Panel` (e3lRj30Jc)
Image fill `ZklcwB3KmSKgLMzY89upy0vSg.jpg` (alt "Wind-shaped ripples in pale sand") ->
`/landing/home/features-roadmap-plate.jpg`. Padding 48 (Phone 16), radius 20 (Phone 16), overflow clip, align center.
`Roadmap Board`: fill `glass`, background blur 16, shadow `0px 24px 48px -20px rgba(21,23,28,0.30)`, padding 12,
gap 12, radius 16, stack horizontal (Phone vertical, third column hidden).
- Column: fill `surface`, padding 10, gap 8, radius 10, width 1fr. Header gap 8, padding 2 4 6: `t-label` title,
  `t-small` `text-2` count.
- Card: fill `bg`, border 1px `border`, padding 12, gap 10, radius 8. Title `t-label`. Meta gap 8: avatar 20x20
  radius 20 fill `text` with `t-small` `bg` initial; owner `t-small` `text-2` 1fr; due `t-small` `text-2`.
  Progress 4px fill `surface` radius 4, fill `accent` at its share.

### 3. `Feature Tracking Panel` (c05v4MpO4)
Fill `surface`, padding 40 (Phone 16), gap 16, radius 20, overflow clip, stack vertical.
- `My Work Card`: fill `bg`, radius 14, overflow clip, shadow
  `0px 20px 40px -16px rgba(21,23,28,0.16), 0px 0px 0px 1px rgba(21,23,28,0.06)`.
  Header padding 14 18, gap 10, border-bottom: Check Square 16 `text`; title `t-label` 1fr; count `t-small` `text-2`.
  Tasks: padding 13 18, gap 12, border-bottom, align center. Check icon 16 (Circle `text-2`, last row Check Circle
  `accent`); title `t-label` truncated 1fr (last row `text-2`); project chip as above (Phone hidden); status width
  96 gap 6 dot 7 (`accent`, `text`, `danger`, `border`, `border`); due `t-small` `text-2` (Phone hidden).
  hoverEffect on each task: backgroundColor `surface`, scale 1.1, tween 0.2s ease [0.44, 0, 0.56, 1].
- `Tracking Side`: stack horizontal (Phone vertical), gap 16, align start.
  - `Blocker Card`: fill `bg`, border 1px, padding 16, gap 10, radius 14, width 1fr. Header gap 8: Flag 15 `text`,
    title `t-label`. Body `t-small` `text-2`. Action: fill `text`, padding 6 10, radius 8, `t-small` `bg`, cursor pointer.
  - `Progress Card`: same card, gap 12. Title `t-label`; value `t-h2` `text`; track 6px `surface` radius 6, fill
    `accent`; note `t-small` `text-2`.

### 4. `Feature Shipping Panel` (bMYIFk4nF)
Image fill `OtX7bK3CEtk1U11RkWSaEXmA.jpg` (alt "White clouds in a blue sky") -> `/landing/home/features-release-plate.jpg`.
Padding 48 (Phone 20 12), radius 20, overflow clip, align center.
- `Release Card`: fill `bg`, max-width 520, padding 24 (Phone 18), gap 16, radius 16, shadow
  `0px 30px 60px -20px rgba(21,23,28,0.35)`. Header gap 10: version chip (fill `surface`, border 1px, padding 3 8,
  radius 6, `t-small` `text-2`), date `t-small` `text-2` 1fr. Title `t-h4`. Groups stack vertical gap 8: tag (dot 6
  radius 6 in `accent` / `text` / `text-2`, gap 6, `t-small`), items `t-body` starting "–  ".
- `Published Toast`: absolute top 32, right 32, z 2, fill `text`, padding 10 14, gap 10, radius 12: Check Circle
  16 `bg`, `t-small` `bg`. Phone hidden.

## Effects summary

| Node | Effect | Values | Built with |
| --- | --- | --- | --- |
| Hero Heading | textEffect | word, onMount, stagger 0.05s, from opacity 0 y 14 blur 6, spring 0.7s bounce 0 delay 0.05s | CSS keyframes per word, the exact critically damped curve sampled into `linear()` (stiffness 174, damping 26.4 equivalent); runs without JS, off under reduced motion |
| Hero Announcement | hoverEffect | bg `surface`, scale 1.1, tween 0.2s [0.44,0,0.56,1] | CSS transition |
| App Window | styleTransformEffect | onInView end, spring 500/60/1, from y 56 scale 0.96 | `ScrollLift` |
| Logo Row Marks | tickerEffect | 40 px/s left, hover 40% speed | `useAnimationFrame` loop over two copies |
| Feature Index | scrollVariantEffect | onScrollTarget, threshold 0.5, replay, spring 0.4s bounce 0 | scroll listener + `motion` animate |
| Feature panels 1-4 | styleTransformEffect | onInView end, spring 500/60/1, from y 40 scale 0.98 | `ScrollLift` |
| Task 1-5 | hoverEffect | bg `surface`, scale 1.1, tween 0.2s | CSS transition |

No appearEffect or loopEffect exists on any node in these two sections (checked by walking both subtrees).

## Known differences

- Hero subheading and heading wrap to one more line than the template at every breakpoint because the Covenant
  copy is longer (Desktop hero 1497 vs 1470 tall; Phone 1220 vs 1154). Layout values are unchanged.
- Logo marks are 7 names (template 6), using the template's generic shapes plus a square.
- Sidebar nav icons are Phosphor icons chosen for the Covenant labels (House, Tray, Scroll, Arrow Counter
  Clockwise, Robot, Shield Check) at the template's size and stroke.
