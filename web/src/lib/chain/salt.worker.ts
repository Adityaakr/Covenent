/// <reference lib="webworker" />
import { cloneInitCodeHash, predictClone, saltFrom, type MineMessage, type MineRequest } from "./salt";

self.onmessage = (e: MessageEvent<MineRequest>) => {
  const { deployer, implementation, seed, suffix } = e.data;
  const hash = cloneInitCodeHash(implementation);
  const want = suffix.toLowerCase();
  const start = performance.now();
  let last = start;
  const base = BigInt(seed);
  for (let i = 0n; ; i++) {
    const salt = saltFrom(base, i);
    const address = predictClone(deployer, salt, hash);
    if (address.toLowerCase().endsWith(want)) {
      (self as unknown as Worker).postMessage({ type: "found", salt, address, tries: Number(i) + 1, ms: performance.now() - start } satisfies MineMessage);
      return;
    }
    if ((i & 2047n) === 0n) {
      const now = performance.now();
      if (now - last > 120) {
        last = now;
        (self as unknown as Worker).postMessage({ type: "progress", tries: Number(i), rate: Number(i) / ((now - start) / 1000) } satisfies MineMessage);
      }
    }
  }
};
