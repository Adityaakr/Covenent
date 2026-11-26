# Landing rebuild contract

The Framer template "Ondrel" (project https://framer.com/projects/Forgiving-Needs-copy--KOrJQvHyKOwWFmVuSpiK-c7Nhr,
read-only reference) is rebuilt in code inside the Next.js app as an exact visual copy, with Covenant's content.

## Ownership and paths

- Code: `web/src/landing/**` only. Images: `web/public/landing/**`, served at `/landing/...`.
- Spec: `docs/landing/spec/` (one markdown file per page or component group, plus `reference/` screenshots).
- The app worker owns the rest of `web/` and routes our exports. It provides `next/font` Inter and the
  `motion` package. Fonts are read from `var(--font-inter)` with a plain `Inter` fallback.
- No other dependency. Icons are inline SVG, exported from the Framer icon nodes with `tree.toSVG`.

## Routes (exported from `web/src/landing/index.ts`)

| Route | Export | Framer source |
| --- | --- | --- |
| `/` | `Landing` | Home `augiA20Il` |
| `/features` | `FeaturesPage` | `O4jNLwO0Z` |
| `/pricing` | `PricingPage` | `gCJGzj4DE` |
| `/use-cases` | `UseCasesPage` | /customers `wBmMaVIkR` |
| `/use-cases/[slug]` | `UseCasePage({ slug })`, `useCaseSlugs` | story detail `UUPt0HfzN` |
| `/changelog` | `ChangelogPage` | `M3aXaoeK3` |
| `/changelog/[slug]` | `ChangelogEntryPage({ slug })`, `changelogSlugs` | entry detail `e861ZTNWV` |
| `/contact` | `ContactPage` | `q0GecTnYS` |
| not found | `NotFoundPage` | `QEEZ4rtiI` |

"Launch app" and every primary product CTA go to `/app`. Internal links use `next/link`.

## Breakpoints

Desktop at 1200px and up, Tablet 810 to 1199.98px, Phone up to 809.98px. CSS media queries:
`@media (max-width: 1199.98px)` for tablet, `@media (max-width: 809.98px)` for phone.

## Tokens (global CSS custom properties, `web/src/landing/styles/landing.css`)

| Token | Value |
| --- | --- |
| `--c-bg` Background | rgb(255, 255, 255) |
| `--c-surface` Surface | rgb(244, 245, 247) |
| `--c-border` Border | rgb(227, 230, 235) |
| `--c-text` Text Primary | rgb(21, 23, 28) |
| `--c-text-2` Text Secondary | rgb(107, 115, 130) |
| `--c-accent` Accent | rgb(43, 89, 255) |
| `--c-danger` Danger | rgb(229, 72, 77) |
| `--c-glass` Glass | rgba(255, 255, 255, 0.72) |
| `--c-input-border` | rgba(136, 136, 136, 0.1) |
| `--c-input-focus` | rgb(0, 153, 255) |

Text styles (classes `t-h1` ... `t-small`). Inter Display is Inter with `font-variation-settings: "opsz" 32`.

| Class | Font | Weight | Desktop / Tablet / Phone size | Letter spacing | Line height | Default colour |
| --- | --- | --- | --- | --- | --- | --- |
| `t-h1` | Inter Display | 600 | 72 / 56 / 42 | -0.035em | 1em | text |
| `t-h2` | Inter Display | 500 | 52 / 42 / 34 | -0.03em | 1.04em | text |
| `t-h3` | Inter Display | 500 | 34 / 30 / 26 | -0.02em | 1.16em | text |
| `t-h4` | Inter Display | 500 | 20 / 20 / 19 | -0.01em | 1.25em | text |
| `t-lead` | Inter | 500 | 18 / 18 / 17 | -0.011em | 1.5em | text-2 |
| `t-body` | Inter | 500 | 15 | -0.006em | 1.55em | text-2 |
| `t-label` | Inter | 500 | 13 | 0 | 1.3em | text |
| `t-small` | Inter | 500 | 12 | 0 | 1.35em | text |

Colour helpers: `c-text`, `c-text-2`, `c-accent`, `c-bg`. Two-run section headings: first sentence `c-text`, second `c-text-2`.

Link styles: nav link text to text-2 on hover, accent when current; footer link text-2 to text on hover.
Both tween 0.2s, ease cubic-bezier(0.44, 0, 0.56, 1).

## Section shell (from the design-system skill)

`<Section>` renders three nested frames:
- outer `section`: width 100%, 1px top border `--c-border` (none on a page head), padding 0 32px / 0 24px / 0 16px.
- inner: max-width 1280px, 1px left and right rails in `--c-border`.
- content: padding 120px 64px / 96px 48px / 64px 20px, gap 56px / 56px / 36px.
- page head content: padding 112px 64px 88px / 96px 48px / 64px 20px, gap 24px / 24px / 36px, centred.
- `surface` puts `--c-surface` on the outer section.

## Foundation API (`web/src/landing/components/`)

```ts
Button({ variant?: "primary" | "secondary", href: string, size?: "md" | "lg", children })  // md 40px, lg 44px
Section({ name: string, surface?: boolean, head?: boolean, noBorder?: boolean, className?: string,
          contentClassName?: string, id?: string, children })
SplitHeading({ as?: "h1" | "h2" | "h3", className?: string, first: string, second?: string })  // two runs
Eyebrow({ children })                       // t-label in accent
ScrollLift({ y?: number, scale?: number, className?: string, children })  // defaults y 32, scale 0.98
PageCTA({ heading, body, primary: { label, href }, secondary: { label, href } })
FAQList({ items: { q: string; a: string }[] })
FeatureGrid({ children }) and FeatureCard({ icon: ReactNode, title, body })
IntegrationGrid({ children }) and IntegrationTile({ icon: ReactNode, title, body })
SiteLayout({ current?: string, children })  // Navigation + page + Footer, the Framer layout template "Main"
```

`index.ts` re-exports every page. Each page component renders its own `SiteLayout`.

## Motion (all native Framer effects, reproduced with `motion/react`)

- Scroll lift: in view (viewport end), spring stiffness 500, damping 60, mass 1, from y 32px and scale 0.98.
  Feature panels start from y 40px and scale 0.98. The hero App Window starts from y 56px and scale 0.96.
- Hero heading word reveal (home only): per word, 0.05s stagger, from y 14px and blur 6px, spring duration 0.7s.
- Feature Card hover: surface fill, scale 1.1, tween 0.25s ease (0.44,0,0.56,1). Integration Tile hover: y -3px, scale 1.1,
  shadow `0px 16px 32px -16px rgba(21,23,28,0.22)`, spring 0.3s. CMS card hover (story cards): y -4px, scale 1.1, shadow
  `0px 24px 48px -24px rgba(21,23,28,0.25)`, spring 0.35s. Table row hover: surface fill, scale 1.1, tween 0.15s.
  (Scale 1.1 verified on the live template by computed transform.)
- The live template https://forgiving-needs-325167.framer.app is a same-renderer reference for motion and hover.
- Logo ticker: velocity 40 (px per second), loops.
- Exact values live in each page spec; the spec wins over this list.
- The finished state must be visible without JavaScript effects (no hidden start states that never resolve).

Shadows: large product window `0px 40px 80px -24px rgba(21,23,28,0.35), 0px 0px 0px 1px rgba(21,23,28,0.06)`;
card over a photo `0px 20px 40px -16px rgba(21,23,28,0.18), 0px 0px 0px 1px rgba(21,23,28,0.06)`;
timeline bar `0px 8px 16px -8px rgba(21,23,28,0.15)`.

## Not copied

The template's `Template Dock` code component (template sales links and the template author's contact
details) shows in canvas screenshots at the left edge. It is not part of the site and is not rebuilt.
