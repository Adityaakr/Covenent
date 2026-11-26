# 404 spec

Framer source: page `QEEZ4rtiI` (Desktop `cIY0BtxoY`, Tablet `JMkjQztaW`, Phone `JsPybDNto`), layout template Main.
Code: `web/src/landing/pages/NotFoundPage.tsx`, `web/src/landing/sections/notfound/**`. References: `reference/not-found/*.jpg`.

## Not Found (`C4_2vGJ02`), no top border, no Page CTA

| | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| Outer padding | 0 32 | 0 24 | 0 16 |
| Inner | max 1280, 1px left/right Border | same | same |
| Content | vertical, centred, gap 24, padding 140 64 160 64 | same as Desktop | gap 24, padding 96 20 112 20 |

- Code `p`: "404", Small, Accent, centred, width 1fr.
- Title `h1`: H1, centred, max width 820, `text-wrap: balance`.
- Body `p`: Lead, centred, max width 520.
- Actions: horizontal, gap 10. Button instances (`Cd7LjBF5C`), height 40: Secondary (`ZjQZNDm4b`) to `/changelog`,
  Primary (`klp6ZcQBk`) to `/`. Rendered with the foundation `Button` (md).
No effects on this page beyond the Button variants.
