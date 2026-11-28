import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config.js';
import { renderMcpReference, renderMcpTools } from '../../mcp/reference.js';
import { TEAM_TOOLS, TOOL_NAMES } from '../../mcp/tools.js';

const read = (...p: string[]) => readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

describe('agent-facing docs match the MCP server', () => {
  it('the web docs carry the current MCP reference (pnpm --dir server gen:llms)', async () => {
    expect(read('web', 'src', 'docs', 'generated', 'mcp-reference.md')).toBe(await renderMcpReference());
    expect(read('web', 'src', 'docs', 'generated', 'mcp-tools.json')).toBe(await renderMcpTools());
  });
  it('the tool list names every tool once, and marks the team tools', async () => {
    const { tools } = JSON.parse(await renderMcpTools()) as { tools: { name: string; signer: string }[] };
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(tools.filter((t) => t.signer === 'team').map((t) => t.name).sort()).toEqual([...TEAM_TOOLS].sort());
  });
  it('SKILL.md and the web Agents page name every tool', () => {
    for (const [file, text] of [
      ['server/mcp/SKILL.md', read('server', 'mcp', 'SKILL.md')],
      ['web/src/app/app/settings/agents/page.tsx', read('web', 'src', 'app', 'app', 'settings', 'agents', 'page.tsx')],
    ] as const) {
      for (const t of TOOL_NAMES) expect(text, `${file} lacks ${t}`).toContain(t);
    }
  });
});
