import { describe, expect, it } from "vitest";
import type { PublicClient } from "viem";
import { discoverLaunchers } from "./discover";
import type { DeploymentPayload } from "./deployment";

const A = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as const;
const FACTORY_ABI = [{ type: "function", name: "allLaunchers", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] }] as const;

function payload(addresses: Record<string, string>): DeploymentPayload {
  return { status: "ok", dir: ".", problems: [], abis: { CovenantLauncherFactory: FACTORY_ABI as never }, deployment: { chainId: 97, addresses, demo: {} } };
}

describe("discoverLaunchers", () => {
  it("lists launchers from every covenant launcher factory in the record, current and earlier, once each", async () => {
    const byFactory: Record<string, string[]> = { [A(1)]: [A(11)], [A(2)]: [A(21), A(22)], [A(3)]: [A(31)], [A(4)]: [A(41)], [A(9)]: [A(99)] };
    const client = { readContract: async ({ address }: { address: string }) => byFactory[address.toLowerCase()] ?? [] } as unknown as PublicClient;
    const got = await discoverLaunchers(client, payload({
      launcherFactory: A(1), demoLauncherFactory: A(2), previousDemoLauncherFactory: A(3), round1LauncherFactory: A(4),
      fourLiteLauncherFactory: A(9), // the Four.meme path's factory makes Lite vaults, not covenants
      legacyCovenantLauncher: A(31), // named in the record and made by a factory: listed once
    }));
    expect(got.map((a) => a.toLowerCase()).sort()).toEqual([A(11), A(21), A(22), A(31), A(41)].sort());
  });

  it("keeps going when one factory does not answer", async () => {
    const client = { readContract: async ({ address }: { address: string }) => { if (address === A(1)) throw new Error("rpc"); return [A(21)]; } } as unknown as PublicClient;
    expect(await discoverLaunchers(client, payload({ launcherFactory: A(1), demoLauncherFactory: A(2) }))).toEqual([A(21)]);
  });
});
