/**
 * Write the MCP reference into the web docs from the server's own tool list (server/mcp/reference.ts):
 * web/src/docs/generated/mcp-reference.md (the /docs/mcp-reference page, also in /llms-full.txt) and
 * web/src/docs/generated/mcp-tools.json (the tool table on /docs/agents and in /llms.txt).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.js';
import { renderMcpReference, renderMcpTools } from '../mcp/reference.js';

const dir = path.join(REPO_ROOT, 'web', 'src', 'docs', 'generated');
for (const [name, text] of [['mcp-reference.md', await renderMcpReference()], ['mcp-tools.json', await renderMcpTools()]] as const) {
  const file = path.join(dir, name);
  writeFileSync(file, text);
  console.error(`wrote ${path.relative(REPO_ROOT, file)}`);
}
