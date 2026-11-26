import { encodeFunctionData, formatEther, getAddress, maxUint256, type Abi, type Address, type Hex } from 'viem';
import { erc20Abi } from '../abi/index.js';
import { pokeCalldata, type AtlasReport } from '../atlas/report.js';
import type { UnsignedTx } from '../schema.js';
import type { CovenantService } from './read.js';

/**
 * Unsigned transaction builders. Nothing here signs or holds a key: the caller's wallet (a
 * browser wallet, a local agent key, or the user behind an MCP client) signs and sends.
 */
export class TxBuilder {
  constructor(private svc: CovenantService) {}

  private tx(p: {
    to: Address;
    abi: Abi;
    functionName: string;
    args?: unknown[];
    value?: bigint;
    from?: Address | null;
    description: string;
    data?: Hex;
    prerequisites?: UnsignedTx['prerequisites'];
  }): UnsignedTx {
    return {
      chainId: this.svc.cfg.chainId,
      to: getAddress(p.to),
      data: p.data ?? encodeFunctionData({ abi: p.abi, functionName: p.functionName, args: p.args ?? [] }),
      value: (p.value ?? 0n).toString(),
      from: p.from ?? null,
      functionName: p.functionName,
      description: p.description,
      prerequisites: p.prerequisites ?? [],
    };
  }

  private async launcherOf(vault: string): Promise<Address> {
    const s = await this.svc.sheet(vault);
    if (!s.launcher) throw new Error('launcher address unknown for this covenant');
    return s.launcher;
  }

  async commit(vaultOrLauncher: { vault?: string; launcher?: string }, amountWei: bigint): Promise<UnsignedTx> {
    const launcher = vaultOrLauncher.launcher ? getAddress(vaultOrLauncher.launcher) : await this.launcherOf(vaultOrLauncher.vault!);
    return this.tx({
      to: launcher,
      abi: this.svc.abis.launcher,
      functionName: 'contribute',
      value: amountWei,
      description: `Commit ${formatEther(amountWei)} BNB to the raise. If the raise is oversubscribed the unaccepted part is refundable; below the minimum all of it is.`,
    });
  }

  async claimRefund(vaultOrLauncher: { vault?: string; launcher?: string }): Promise<UnsignedTx> {
    const launcher = vaultOrLauncher.launcher ? getAddress(vaultOrLauncher.launcher) : await this.launcherOf(vaultOrLauncher.vault!);
    return this.tx({ to: launcher, abi: this.svc.abis.launcher, functionName: 'claimRefund', description: 'Claim the refundable part of your commitment.' });
  }

  claimTokens(vault: string): UnsignedTx {
    return this.tx({ to: vault as Address, abi: this.svc.abis.vault, functionName: 'claimTokens', description: 'Claim your sale tokens from the vault.' });
  }

  /** redeem(amount, minOut) with a token approval first when the allowance is short. */
  async redeem(vault: string, amount: bigint, holder?: Address, slippageBps = 50): Promise<UnsignedTx> {
    const s = await this.svc.sheet(vault);
    if (!s.token) throw new Error('token address unknown for this covenant');
    const book = s.bookValueWei ? BigInt(s.bookValueWei) : 0n;
    const fee = s.state === 'WIND_DOWN' ? 0n : BigInt(s.exit.exitFeeBps ?? 0);
    const expected = (((amount * book) / 10n ** 18n) * (10_000n - fee)) / 10_000n;
    const minOut = (expected * (10_000n - BigInt(slippageBps))) / 10_000n;
    const prerequisites: UnsignedTx['prerequisites'] = [];
    if (holder) {
      const allowance = await this.svc.client.readContract({ address: s.token, abi: erc20Abi, functionName: 'allowance', args: [holder, s.vault] });
      if (allowance < amount) {
        prerequisites.push({
          chainId: this.svc.cfg.chainId,
          to: s.token,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [s.vault, maxUint256] }),
          value: '0',
          from: holder,
          functionName: 'approve',
          description: 'Approve the vault to take the tokens you redeem (they are sent to the burn address).',
        });
      }
    }
    const open = s.state === 'EXIT_ROUND' || s.state === 'WIND_DOWN';
    return this.tx({
      to: s.vault,
      abi: this.svc.abis.vault,
      functionName: 'redeem',
      args: [amount, minOut],
      from: holder ?? null,
      prerequisites,
      description: `${open ? '' : 'NOT REDEEMABLE NOW (state ' + s.state + '); this call would revert. '}Burn ${formatEther(amount)} tokens for about ${formatEther(expected)} BNB at book value${fee ? ` after the ${Number(fee) / 100}% exit fee` : ''}; reverts if less than ${formatEther(minOut)} BNB.`,
    });
  }

  poke(vault: string, report?: AtlasReport): UnsignedTx {
    const oracle = this.svc.cfg.oracle;
    if (!oracle) throw new Error('oracle address unknown: set COVENANT_ORACLE or publish contracts/deployments/local.json');
    return this.tx({
      to: oracle,
      abi: this.svc.abis.oracle,
      functionName: 'poke',
      data: pokeCalldata(this.svc.abis.oracle, getAddress(vault), report?.extraData),
      description: report
        ? `Record a price observation for this covenant, with a signed BNB/USD report (${report.mode}) appended.`
        : 'Record a price observation without an Atlas report: the exit rule still steps (on-chain numbers only); tap rate and unlocks do not.',
    });
  }

  declareAbandoned(vault: string): UnsignedTx {
    return this.tx({
      to: vault as Address,
      abi: this.svc.abis.vault,
      functionName: 'declareAbandoned',
      description: 'The team or agent has been silent past its heartbeat window: end the tap, burn locked team tokens, open the treasury to holders with no fee.',
    });
  }

  private async team(vault: string): Promise<Address | null> {
    return (await this.svc.sheet(vault)).issuer.teamWallet;
  }

  async claimTap(vault: string): Promise<UnsignedTx> {
    return this.tx({ to: vault as Address, abi: this.svc.abis.vault, functionName: 'claimTap', from: await this.team(vault), description: 'Pay the accrued tap to the team wallet. Counts as a heartbeat.' });
  }

  async heartbeat(vault: string): Promise<UnsignedTx> {
    return this.tx({ to: vault as Address, abi: this.svc.abis.vault, functionName: 'heartbeat', from: await this.team(vault), description: 'Reset the abandonment clock.' });
  }

  async lowerTap(vault: string, newUsdPer30d: bigint): Promise<UnsignedTx> {
    return this.tx({
      to: vault as Address,
      abi: this.svc.abis.vault,
      functionName: 'lowerTap',
      args: [newUsdPer30d],
      from: await this.team(vault),
      description: `Lower the tap to $${formatEther(newUsdPer30d)} per 30 days. It can never be raised again. Counts as a heartbeat.`,
    });
  }

  async postReport(vault: string, period: bigint, uri: string, hash: Hex): Promise<UnsignedTx> {
    return this.tx({
      to: vault as Address,
      abi: this.svc.abis.vault,
      functionName: 'postReport',
      args: [period, uri, hash],
      from: await this.team(vault),
      description: `Post the period ${period} report pointer and hash. Counts as a heartbeat.`,
    });
  }
}
