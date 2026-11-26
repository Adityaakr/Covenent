import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Abi, AbiEvent, AbiFunction } from 'viem';
import { abiDir } from '../config.js';
import {
  erc20Abi,
  identityRegistryAbi,
  launcherAbi,
  oracleAbi,
  pairAbi,
  reputationRegistryAbi,
  taxTokenAbi,
  vaultAbi,
} from './fallback.js';

export { erc20Abi, identityRegistryAbi, pairAbi, reputationRegistryAbi, taxTokenAbi };

type Item = AbiFunction | AbiEvent;

/** Read contracts/abi/<name>.json. Accepts a raw ABI array or a Foundry artifact ({ abi: [...] }). */
export function readPublishedAbi(name: string, dir = abiDir()): Abi | null {
  const file = path.join(dir, `${name}.json`);
  if (!existsSync(file)) return null;
  const json = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (Array.isArray(json)) return json as Abi;
  if (json && typeof json === 'object' && Array.isArray((json as { abi?: unknown }).abi)) {
    return (json as { abi: Abi }).abi;
  }
  return null;
}

/** Published ABI entries win by (type, name); fallback entries fill in the rest. */
export function mergeAbi(published: Abi | null, fallback: Abi): Abi {
  if (!published) return fallback;
  const key = (i: Abi[number]) => `${i.type}:${'name' in i ? i.name : ''}`;
  const seen = new Set(published.map(key));
  return [...published, ...fallback.filter((i) => !seen.has(key(i)))] as Abi;
}

export interface CovenantAbis {
  vault: Abi;
  launcher: Abi;
  oracle: Abi;
  /** which names came from contracts/abi */
  published: string[];
}

let cached: CovenantAbis | null = null;

export function loadAbis(dir = abiDir(), fresh = false): CovenantAbis {
  if (cached && !fresh) return cached;
  const published: string[] = [];
  const pick = (name: string, fb: Abi) => {
    const p = readPublishedAbi(name, dir);
    if (p) published.push(name);
    return mergeAbi(p, fb);
  };
  cached = {
    vault: pick('CovenantVault', vaultAbi),
    launcher: pick('CovenantLauncher', launcherAbi),
    oracle: pick('CovenantOracle', oracleAbi),
    published,
  };
  return cached;
}

export function hasFunction(abi: Abi, name: string): boolean {
  return abi.some((i) => i.type === 'function' && i.name === name);
}

export function eventsOf(abi: Abi): AbiEvent[] {
  return abi.filter((i): i is AbiEvent => i.type === 'event');
}

export type { Item };
