# Covenant landing

The Covenant marketing site is a code copy of the Framer template "Ondrel", with Covenant's content in place of the
template's. It lives in the Next.js app in `web/`. Layout, tokens, text styles, components and motion are copied from
the template, and every fact and number comes from `docs/DESIGN.md`.

- Framer source, used read-only: https://framer.com/projects/Forgiving-Needs-copy--KOrJQvHyKOwWFmVuSpiK-c7Nhr
  ("Forgiving Needs (copy)"). Nothing was changed or published there. Branching isn't available on that project's
  plan, so there is no Framer branch.
- Live template, with the template's own content, as a reference for motion and hover:
  https://forgiving-needs-325167.framer.app

## Where things are

| Path | What |
| --- | --- |
| `web/src/landing/index.tsx` | Default export renders `/`. It also re-exports every page. |
| `web/src/landing/pages/<route>.tsx` | Default exports for the app router: `features`, `pricing`, `use-cases`, `use-case` (dynamic, with `generateStaticParams`), `changelog`, `changelog-entry` (dynamic), `contact`, `not-found`. |
| `web/src/landing/components/` | Foundation: navigation, footer, section shell, buttons, page CTA, FAQ, card grids, motion helpers. |
| `web/src/landing/sections/` | Sections for each page. |
| `web/src/landing/content/` | Covenant data: FAQs, plans, use cases, milestones, the problem stats (`problem.ts`) and the cited voices (`voices.ts`). |
| `web/src/landing/meta.ts` | Page metadata and Open Graph, including the home headline and subline. |
| `web/src/landing/styles/landing.css` | Tokens and text styles, scoped under `.landing-root`. |
| `web/public/landing/` | Images reused from the template (plates and covers), served at `/landing/...`. |
| `web/public/landing/logos/` | The Built-on marks, monochrome SVGs from each project's own site or Simple Icons. Sources: `SOURCES.md` there. |
| `docs/landing/sources.md` | Every outside number and quote on the landing, with the exact source wording and link. |
| `docs/landing/content.md` | Every section's final copy, with the DESIGN.md source for each fact. The v2 sections are in `content/home-v2.md`. |
| `docs/landing/spec/` | Extracted design spec for each page, the build contract, and Framer reference screenshots in `reference/`. |
| `docs/landing/screens/` | Final screenshots of the rebuilt pages at 1200, 810 and 390 px. |

## Routes

`/`, `/features` (the five rules and the agent layer), `/pricing` (how Covenant is paid for), `/use-cases` and
`/use-cases/<slug>` (five cases), `/changelog` and `/changelog/<slug>` (build milestones), `/contact`, plus a 404 page.
"Launch app" and "Connect wallet" go to `/app` on the same origin. The app runs at http://localhost:8080.

## Requirements in the app shell

- Metadata: the page modules export `metadata` (or `generateMetadata`), and `@/landing` exports the home `metadata`.
  The route files should re-export them, for example `export { default, metadata } from "@/landing"` in
  `app/page.tsx` and `export { default, generateStaticParams, generateMetadata } from ...` for the slug routes.

- Fonts: `--font-inter` for text, and `--font-inter-display` for headings, with Inter at optical size 32 as the
  fallback.
- Packages: `motion` for the effects. Nothing else.
- CSS modules: the Turbopack Tailwind rule must not match `*.module.css`. With the rule key `"*.css"`, every
  landing module class comes out empty. Key it to the app's own stylesheets instead, for example
  `"{globals,app}.css"`.

## Not copied

The template's "Template Dock" (template sales links and the template author's contact details) is not part of the
site and is not rebuilt. Forms have no backend: the subscribe and contact forms show their pending and success
states only.
