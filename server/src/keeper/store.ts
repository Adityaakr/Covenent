import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Small durable JSON store: atomic write (tmp + rename) so a crash never leaves a torn file. */
export class JsonStore<T extends object> {
  private data: T;
  constructor(
    readonly file: string,
    initial: T,
  ) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.data = existsSync(file) ? { ...initial, ...(JSON.parse(readFileSync(file, 'utf8')) as T) } : initial;
  }
  get(): T {
    return this.data;
  }
  update(fn: (d: T) => void): void {
    fn(this.data);
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * One process per state directory. A second keeper on the same key would race nonces; a second
 * keeper with its own key and state dir is fine (the oracle's 1-hour rule and a pre-send
 * simulation make extra pokes cost nothing).
 */
export function acquireLock(file: string): () => void {
  mkdirSync(path.dirname(file), { recursive: true });
  if (existsSync(file)) {
    const pid = Number(readFileSync(file, 'utf8'));
    if (pid && pid !== process.pid && alive(pid)) throw new Error(`another process (pid ${pid}) holds ${file}`);
  }
  writeFileSync(file, String(process.pid));
  return () => {
    try {
      if (readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file);
    } catch {
      /* already gone */
    }
  };
}
