"use client";

/*
 * StreamingResponse (beUI's streaming-response): the assistant's answer as Markdown (GitHub flavour: headings, lists,
 * bold, tables, inline code, links), a caret while it streams and a Copy action once it is complete. Raw HTML in the
 * model's text is never rendered, images are dropped and only http(s) links survive, opening in a new tab: the text
 * can quote on-chain strings other people wrote.
 */
import { memo, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";
import { closeOpenMarks, safeHref } from "@/lib/ai/markdown";

const COMPONENTS: Components = {
  a: ({ href, children }) => {
    const h = safeHref(href);
    return h ? <a href={h} target="_blank" rel="noreferrer noopener" className="link">{children}</a> : <span>{children}</span>;
  },
  img: () => null,
  table: ({ children }) => <div className="ag-md-table"><table>{children}</table></div>,
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
};

export const MarkdownText = memo(function MarkdownText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className="ag-md">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>{streaming ? closeOpenMarks(text) : text}</Markdown>
    </div>
  );
});

export function StreamingResponse({ children, status = "complete", showActions = true, copyText, className }: { children: string; status?: "streaming" | "complete"; showActions?: boolean; copyText?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const streaming = status === "streaming";
  return (
    <div className={cx("ag-stream", streaming && "is-streaming", className)} aria-busy={streaming}>
      <MarkdownText text={children} streaming={streaming} />
      {showActions && !streaming && children.trim() ? (
        <div className="ag-stream-actions">
          <button type="button" className="ag-icon-btn" aria-label={copied ? "Copied" : "Copy answer"} title={copied ? "Copied" : "Copy"}
            onClick={() => { void navigator.clipboard?.writeText(copyText ?? children).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }}>
            <Icon name={copied ? "check" : "copy"} size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
