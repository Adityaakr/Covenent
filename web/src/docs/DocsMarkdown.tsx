/* Renders a docs page body (markdown, directives already filled) with the site's components. Server component. */
import Link from "next/link";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { Diagram, isDiagram } from "./diagrams";
import { headingId } from "./source";

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: unknown }; children?: HastNode[] };

function textOf(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (typeof n === "object" && "props" in n) return textOf((n as { props: { children?: ReactNode } }).props.children);
  return "";
}

function hastText(n: HastNode | undefined): string {
  if (!n) return "";
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(hastText).join("");
}

const isFile = (href: string) => /\.[a-z]+$/.test(href.split("#")[0]!);

const components: Components = {
  h2: ({ children }) => {
    const id = headingId(textOf(children));
    return (
      <h2 id={id}>
        <a href={`#${id}`} className="docs-anchor">{children}</a>
      </h2>
    );
  },
  h3: ({ children }) => {
    const id = headingId(textOf(children));
    return (
      <h3 id={id}>
        <a href={`#${id}`} className="docs-anchor">{children}</a>
      </h3>
    );
  },
  a: ({ href = "", children }) => {
    if (href.startsWith("#")) return <a href={href}>{children}</a>;
    if (href.startsWith("/") && !isFile(href)) return <Link href={href}>{children}</Link>;
    if (href.startsWith("/")) return <a href={href}>{children}</a>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  pre: ({ node }) => {
    const code = (node as HastNode | undefined)?.children?.find((c) => c.tagName === "code");
    const cls = code?.properties?.className;
    const lang = Array.isArray(cls) ? String(cls.find((c) => String(c).startsWith("language-")) ?? "").slice(9) : "";
    const text = hastText(code).replace(/\n$/, "");
    if (lang === "covenant" && text.startsWith("diagram:")) {
      const name = text.slice("diagram:".length).trim();
      if (isDiagram(name)) return <Diagram name={name} />;
    }
    return <CodeBlock code={text} lang={lang} />;
  },
  table: ({ children }) => (
    <div className="docs-table">
      <table>{children}</table>
    </div>
  ),
};

export function DocsMarkdown({ source }: { source: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {source}
    </Markdown>
  );
}
