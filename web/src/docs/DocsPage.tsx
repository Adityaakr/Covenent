/* One docs page: the site's navigation and footer, a sidebar with every page, the article, "On this page" and
   previous / next. Server component; the body comes from docs/content/<slug>.md through docs/source.ts. */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteLayout } from "@/landing/components/SiteLayout";
import { pageMetadata } from "@/landing/meta";
import { DocsMarkdown } from "./DocsMarkdown";
import { ThemeSwitch } from "./ThemeSwitch";
import { DOC_GROUPS, DOC_PAGES, docHref, docMdHref, findDoc, neighbours, type DocPage } from "./pages";
import { expand, headingId, outline, readBody, REPO_URL } from "./source";
import "./docs.css";

export function docMetadata(slug: string): Metadata {
  const page = findDoc(slug)!;
  const meta = pageMetadata(slug === "introduction" ? "Docs" : `${page.title} · Docs`, page.answer, docHref(slug));
  return { ...meta, alternates: { canonical: docHref(slug), types: { "text/markdown": docMdHref(slug) } } };
}

function NavList({ current }: { current: string }) {
  return (
    <nav aria-label="Docs" className="docs-nav">
      {DOC_GROUPS.map((g) => (
        <div key={g} className="docs-nav-group">
          <p className="docs-nav-title">{g}</p>
          <ul>
            {DOC_PAGES.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <Link href={docHref(p.slug)} aria-current={p.slug === current ? "page" : undefined}>
                  {p.nav ?? p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Pager({ page }: { page: DocPage }) {
  const { prev, next } = neighbours(page.slug);
  return (
    <nav className="docs-pager" aria-label="Previous and next page">
      {prev ? (
        <Link href={docHref(prev.slug)} className="docs-pager-link">
          <span>Previous</span>
          <b>{prev.title}</b>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={docHref(next.slug)} className="docs-pager-link docs-pager-next">
          <span>Next</span>
          <b>{next.title}</b>
        </Link>
      ) : <span />}
    </nav>
  );
}

export function DocsPage({ slug }: { slug: string }) {
  const page = findDoc(slug)!;
  const body = expand(readBody(slug), "html");
  const toc = outline(body);
  return (
    <SiteLayout current="/docs" className="docs-root">
      <div className="docs-wrap">
        <aside className="docs-side">
          <NavList current={slug} />
          <div className="docs-side-foot">
            <ThemeSwitch />
            <a href="/llms.txt" className="docs-side-link">llms.txt for agents</a>
          </div>
        </aside>

        <article className="docs-main">
          <details className="docs-mobile-nav" key={slug}>
            <summary>
              <span>Docs</span>
              <b>{page.title}</b>
            </summary>
            <NavList current={slug} />
            <ThemeSwitch />
          </details>

          <header className="docs-head">
            <p className="docs-eyebrow">{page.group}</p>
            <h1>{page.title}</h1>
            <p className="docs-answer">{page.answer}</p>
          </header>

          <div className="docs-prose">
            <DocsMarkdown source={body} />
          </div>

          <div className="docs-meta">
            <a href={docMdHref(slug)}>View as markdown</a>
            <a href={`${REPO_URL}/blob/main/web/src/docs/content/${slug}.md`} target="_blank" rel="noopener noreferrer">
              Edit on GitHub
            </a>
          </div>
          <Pager page={page} />
        </article>

        <aside className="docs-toc" aria-label="On this page">
          {toc.length > 0 && (
            <>
              <p className="docs-nav-title">On this page</p>
              <ul>
                {toc.map((h) => (
                  <li key={h}>
                    <a href={`#${headingId(h)}`}>{h.replace(/`/g, "")}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </SiteLayout>
  );
}
