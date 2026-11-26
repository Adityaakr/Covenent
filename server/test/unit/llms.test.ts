import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config.js';
import { renderLlmsFull } from '../../mcp/reference.js';
import { TOOL_NAMES } from '../../mcp/tools.js';

const read = (...p: string[]) => readFileSync(path.join(REPO_ROOT, ...p), 'utf8');

describe('agent-facing docs match the MCP server', () => {
  it('web/public/llms-full.txt is the current render (pnpm --dir server gen:llms)', async () => {
    expect(read('web', 'public', 'llms-full.txt')).toBe(await renderLlmsFull());
  });
  it('llms.txt, SKILL.md, the README and the web Agents page name every tool', () => {
    for (const [file, text] of [
      ['web/public/llms.txt', read('web', 'public', 'llms.txt')],
      ['server/mcp/SKILL.md', read('server', 'mcp', 'SKILL.md')],
      ['README.md', read('README.md')],
      ['web/src/app/app/settings/agents/page.tsx', read('web', 'src', 'app', 'app', 'settings', 'agents', 'page.tsx')],
    ] as const) {
      for (const t of TOOL_NAMES) expect(text, `${file} lacks ${t}`).toContain(t);
    }
  });
});
