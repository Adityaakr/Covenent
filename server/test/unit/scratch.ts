import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { onTestFinished } from 'vitest';

/**
 * A fresh directory under the OS temp dir (`os.tmpdir()`, which honours TMPDIR), removed when the current test ends.
 * Call it inside a test. Never hard-code a temp path such as `/tmp` or `/private/tmp`: the second exists only on macOS,
 * and a shared path lets parallel test files read each other's state.
 */
export function scratchDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `covenant-${prefix}-`));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Keeper file paths inside a fresh scratch dir, so a Keeper in a unit test never writes to `server/.data`. */
export function keeperFiles(prefix: string): { stateFile: string; alertsFile: string } {
  const dir = scratchDir(prefix);
  return { stateFile: path.join(dir, 'keeper-state.json'), alertsFile: path.join(dir, 'alerts.jsonl') };
}
