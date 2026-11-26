/** Write web/public/llms-full.txt from the MCP server's own tool list (server/mcp/reference.ts). */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../src/config.js';
import { renderLlmsFull } from '../mcp/reference.js';

const file = path.join(REPO_ROOT, 'web', 'public', 'llms-full.txt');
writeFileSync(file, await renderLlmsFull());
console.error(`wrote ${path.relative(REPO_ROOT, file)}`);
