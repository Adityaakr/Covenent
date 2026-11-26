import { encodeAbiParameters, getAddress, isAddress, type Address, type Hex, type PublicClient } from 'viem';
import { deploymentAddress, type ServerConfig } from '../config.js';

/**
 * The Four.meme path (Covenant Lite). A founder who picks a tax vault template on Four.meme's Unverified Royalty
 * path gets an OpenFour ForwardVault as the token's founder recipient; ForwardVault clones the template with init data
 * it decodes as ONE struct, `(address template, bytes initData)`, so the bytes must be tuple-wrapped
 * (`abi.encode(InitParams(template, initData))`), not the flat `abi.encode(template, initData)` the docs suggest
 * (verified against the live implementation on a BNB Chain fork). Covenant Lite's initData is
 * `abi.encode(uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps)`.
 */
export interface LiteFields {
  tapBps: number;
  tapPeriod: number;
  heartbeat: number;
  redeemFeeBps: number;
}

/** CovenantLiteVault's own bounds (its _customInit reverts outside them). */
export const LITE_BOUNDS = {
  tapBps: { min: 1, max: 5000 },
  tapPeriod: { min: 86_400, max: 7_776_000 },
  heartbeat: { min: 604_800, max: 15_552_000 },
  redeemFeeBps: { min: 0, max: 300 },
} as const;

export function liteProblems(f: LiteFields): string[] {
  const out: string[] = [];
  for (const k of Object.keys(LITE_BOUNDS) as (keyof LiteFields)[]) {
    const v = f[k];
    const b = LITE_BOUNDS[k];
    if (!Number.isInteger(v) || v < b.min || v > b.max) out.push(`${k} must be an integer from ${b.min} to ${b.max}`);
  }
  return out;
}

export function encodeLiteInitData(f: LiteFields): Hex {
  return encodeAbiParameters(
    [{ type: 'uint16' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint16' }],
    [f.tapBps, f.tapPeriod, f.heartbeat, f.redeemFeeBps],
  );
}

/** The vaultData bytes ForwardVault.initialize takes: the tuple (template, initData). */
export function encodeForwardVaultData(template: Address, f: LiteFields): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ name: 'template', type: 'address' }, { name: 'initData', type: 'bytes' }] }],
    [{ template, initData: encodeLiteInitData(f) }],
  );
}

const LAUNCHER_ABI = [
  {
    type: 'function', name: 'launches', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'tuple[]', components: [
      { name: 'token', type: 'address' }, { name: 'forwardVault', type: 'address' }, { name: 'liteVault', type: 'address' },
      { name: 'pair', type: 'address' }, { name: 'founder', type: 'address' }, { name: 'at', type: 'uint64' },
    ] }],
  },
] as const;

const LITE_VIEWS = ['open', 'abandoned', 'lastHeartbeat', 'heartbeatDeadline', 'tapPaidNative', 'tokensBurned', 'redeemableSupply'] as const;
const LITE_ABI = [
  ...LITE_VIEWS.map((name) => ({
    type: 'function' as const, name, stateMutability: 'view' as const, inputs: [],
    outputs: [{ type: name === 'open' || name === 'abandoned' ? ('bool' as const) : ('uint256' as const) }],
  })),
  { type: 'function', name: 'params', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint16' }] },
  { type: 'function', name: 'tapAvailable', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;
const TOKEN_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'taxDispatched', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export class FourMeme {
  constructor(
    private cfg: ServerConfig,
    private client: PublicClient,
  ) {}

  template(): Address | undefined {
    return deploymentAddress(this.cfg.deployments, 'liteVaultTemplate');
  }

  launcher(): Address | undefined {
    return deploymentAddress(this.cfg.deployments, 'fourLiteLauncher');
  }

  encode(query: Record<string, string | undefined>) {
    const f: LiteFields = {
      tapBps: Number(query.tapBps ?? 400),
      tapPeriod: Number(query.tapPeriod ?? 2_592_000),
      heartbeat: Number(query.heartbeat ?? 3_888_000),
      redeemFeeBps: Number(query.redeemFeeBps ?? 100),
    };
    const problems = liteProblems(f);
    const t = query.template && isAddress(query.template) ? getAddress(query.template) : this.template();
    if (!t) problems.push('no template: pass template=<CovenantLiteVault address> or deploy one');
    if (problems.length) return { ok: false as const, problems, bounds: LITE_BOUNDS };
    return {
      ok: true as const,
      fields: f,
      template: t!,
      initData: encodeLiteInitData(f),
      vaultData: encodeForwardVaultData(t!, f),
      encoding: 'abi.encode(InitParams(address template, bytes initData)) with initData = abi.encode(uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps)',
      note: 'Paste vaultData as the tax vault parameters on Four.meme\'s Unverified Royalty path; ForwardVault decodes it as one tuple.',
      bounds: LITE_BOUNDS,
      localLauncher: this.launcher() ?? null,
    };
  }

  /** Every Lite covenant the local launcher created, with its vault's state (dev chain). */
  async launches() {
    const l = this.launcher();
    if (!l) return { launcher: null, launches: [] as unknown[] };
    const rows = await this.client.readContract({ address: l, abi: LAUNCHER_ABI, functionName: 'launches' });
    const launches = await Promise.all(
      rows.map(async (r) => {
        const read = <T>(address: Address, abi: readonly unknown[], functionName: string) =>
          this.client.readContract({ address, abi: abi as never, functionName: functionName as never }) as Promise<T>;
        const [open, abandoned, lastHeartbeat, deadline, tapPaid, burned, redeemable, params, tapAvail, owner, symbol, name, taxDispatched, treasury] =
          await Promise.all([
            ...LITE_VIEWS.map((v) => read<unknown>(r.liteVault, LITE_ABI, v)),
            read<readonly [number, number, number, number]>(r.liteVault, LITE_ABI, 'params'),
            read<readonly [bigint, bigint]>(r.liteVault, LITE_ABI, 'tapAvailable'),
            read<Address>(r.liteVault, LITE_ABI, 'owner'),
            read<string>(r.token, TOKEN_ABI, 'symbol'),
            read<string>(r.token, TOKEN_ABI, 'name'),
            read<bigint>(r.token, TOKEN_ABI, 'taxDispatched').catch(() => 0n),
            this.client.getBalance({ address: r.liteVault }),
          ]);
        const p = params as readonly [number, number, number, number];
        return {
          ...r,
          at: Number(r.at),
          name, symbol, owner,
          state: (open as boolean) ? ((abandoned as boolean) ? 'ABANDONED' : 'WOUND_DOWN') : 'ACTIVE',
          treasuryWei: (treasury as bigint).toString(),
          taxDispatchedWei: (taxDispatched as bigint).toString(),
          tapPaidWei: String(tapPaid), tapAvailableWei: (tapAvail as readonly [bigint, bigint])[0].toString(),
          tokensBurnedWei: String(burned), redeemableSupplyWei: String(redeemable),
          lastHeartbeat: Number(lastHeartbeat), heartbeatDeadline: Number(deadline),
          params: { tapBps: p[0], tapPeriod: p[1], heartbeat: p[2], redeemFeeBps: p[3] },
        };
      }),
    );
    return { launcher: l, launches };
  }
}
