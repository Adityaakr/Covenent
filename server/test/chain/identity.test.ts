import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWalletClient, encodeFunctionData, getAddress, http, parseAbi, zeroHash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { registerAgent, registrationFile, writeRegistrationFile } from '../../agents/issuer/identity.js';
import { createApp } from '../../src/api/app.js';
import { CovenantService } from '../../src/covenant/read.js';
import { addr, deployFixture, KEYS, startAnvil, type Anvil, type Fixture } from './harness.js';

let anvil: Anvil;
let fx: Fixture;

beforeAll(async () => {
  anvil = await startAnvil();
  fx = await deployFixture(anvil, { identity: true });
});
afterAll(() => anvil?.stop());

const giveFeedback = parseAbi(['function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)']);

describe('ERC-8004 identity link', () => {
  it('the sheet shows the agent id, its registration file and that the owner is the team wallet', async () => {
    const svc = new CovenantService({ cfg: fx.cfg(), client: fx.client });
    const s = await svc.sheet(fx.vault);
    expect(s.agentId).toBe('1');
    expect(s.issuer.ownerMatchesTeam).toBe(true);
    expect(s.issuer.registrationUri).toMatch(/registration\.json$/);
    expect(s.issuer.reputation!.count).toBe('0');
  });

  it('counts outcome feedback written by covenant vaults only (spam from others is filtered out)', async () => {
    const cfg = fx.cfg();
    const rep = cfg.reputationRegistry!;
    // a covenant vault records an outcome (the contract does this on abandonment, wind-down or unlock)
    await fx.test.impersonateAccount({ address: fx.vault });
    await fx.test.setBalance({ address: fx.vault, value: 10n ** 21n });
    const data = encodeFunctionData({ abi: giveFeedback, functionName: 'giveFeedback', args: [1n, -100n, 0, 'covenant', 'abandoned', '', 'ipfs://x', zeroHash] });
    const h1 = await fx.test.sendUnsignedTransaction({ from: fx.vault, to: rep, data });
    await fx.client.waitForTransactionReceipt({ hash: h1 });
    await fx.test.stopImpersonatingAccount({ address: fx.vault });
    // a stranger tries to pad the record
    const stranger = createWalletClient({ account: privateKeyToAccount(KEYS.whale), chain: foundry, transport: http(fx.rpcUrl) });
    const spam = encodeFunctionData({ abi: giveFeedback, functionName: 'giveFeedback', args: [1n, 100n, 0, 'covenant', 'great', '', '', zeroHash] });
    await fx.client.waitForTransactionReceipt({ hash: await stranger.sendTransaction({ to: rep, data: spam }) });

    const s = await new CovenantService({ cfg, client: fx.client }).sheet(fx.vault);
    expect(s.issuer.reputation!.count).toBe('1');
    expect(s.issuer.reputation!.summaryValue).toBe('-100');
    expect(s.issuer.reputation!.clientFilter.map((a) => a.toLowerCase())).toEqual([fx.vault.toLowerCase()]);
  });

  it('registers an agent from the team wallet and serves its registration file', async () => {
    const cfg = fx.cfg();
    const wallet = createWalletClient({ account: privateKeyToAccount(KEYS.buyer1), chain: foundry, transport: http(fx.rpcUrl) });
    const owner = addr(KEYS.buyer1);
    const input = { name: 'Test agent', description: 'd', mcpEndpoint: 'stdio', covenantVaults: [fx.vault] };
    const { uri } = writeRegistrationFile(cfg, owner, registrationFile(cfg, input));
    const { agentId } = await registerAgent(cfg, wallet, fx.client, uri);
    expect(agentId).toBe(2n);
    writeRegistrationFile(cfg, owner, registrationFile(cfg, input, agentId));
    const res = await createApp({ cfg }).request(`/agents/${owner}/registration.json`);
    const body = (await res.json()) as { supportedTrust: string[]; services: { name: string }[]; registrations: { agentId: number; agentRegistry: string }[] };
    expect(body.supportedTrust).toEqual(['crypto-economic']);
    expect(body.services[0]!.name).toBe('MCP');
    expect(body.registrations[0]).toEqual({ agentId: 2, agentRegistry: `eip155:31337:${getAddress(cfg.identityRegistry!)}` });
  });
});
