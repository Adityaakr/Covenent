/*
 * While an answer streams, its Markdown is often cut mid-mark ("**Book va"). Close a dangling bold, inline code or
 * code fence for rendering, so half-written emphasis never flashes as raw asterisks and the text does not reflow when
 * the closing mark arrives. The stored text is never changed.
 */
export function closeOpenMarks(md: string): string {
  const fences = (md.match(/```/g) ?? []).length;
  if (fences % 2) return `${md}\n\`\`\``;
  let s = md;
  // a mark just opened with nothing after it yet: drop it rather than render "****" (a thematic break)
  if (/(^|[^*])\*\*$/.test(s) && ((s.match(/\*\*/g) ?? []).length % 2)) s = s.slice(0, -2);
  if (/(^|[^`])`$/.test(s) && ((s.match(/`/g) ?? []).length % 2)) s = s.slice(0, -1);
  if ((s.match(/`/g) ?? []).length % 2) s += "`";
  const outsideCode = s.replace(/`[^`]*`/g, "");
  if ((outsideCode.match(/\*\*/g) ?? []).length % 2) s += "**";
  return s;
}

/** Links the answer may render: web pages only (no javascript:, data: or app-relative tricks). */
export function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
