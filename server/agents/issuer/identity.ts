import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { decodeEventLog, encodeFunctionData, getAddress, parseAbi, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { identityRegistryAbi } from '../../src/abi/index.js';
import type { ServerConfig } from '../../src/config.js';

/** ERC-8004 registry addresses from docs/DESIGN.md (ERC-8004 contracts repo). */
export const ERC8004 = {
  56: { identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' },
  97: { identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e', reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713' },
} as const;

const registeredEvent = parseAbi(['event Registered(uint256 indexed agentId, string agentURI, address indexed owner)', 'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)']);

export interface RegistrationInput {
  name: string;
  description: string;
  mcpEndpoint: string;
  covenantVaults: Address[];
  image?: string;
}

/**
 * The agent's ERC-8004 registration file. It lists the Covenant MCP endpoint under services and
 * crypto-economic under supportedTrust: the covenant vault is the stake that backs the agent.
 */
export function registrationFile(cfg: ServerConfig, input: RegistrationInput, agentId?: bigint) {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: input.name,
    description: input.description,
    image: input.image ?? '',
    services: [
      { name: 'MCP', endpoint: input.mcpEndpoint, version: '2025-06-18' },
      ...input.covenantVaults.map((v) => ({ name: 'covenant-vault', endpoint: `eip155:${cfg.chainId}:${v}` })),
    ],
    active: true,
    registrations: agentId !== undefined && cfg.identityRegistry ? [{ agentId: Number(agentId), agentRegistry: `eip155:${cfg.chainId}:${cfg.identityRegistry}` }] : [],
    supportedTrust: ['crypto-economic'],
  };
}

export function writeRegistrationFile(cfg: ServerConfig, owner: Address, body: unknown): { file: string; uri: string } {
  const dir = path.join(cfg.dataDir, 'agents');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${owner.toLowerCase()}.json`);
  writeFileSync(file, JSON.stringify(body, null, 2));
  return { file, uri: `${cfg.apiBaseUrl}/agents/${owner.toLowerCase()}/registration.json` };
}

/** register(agentURI) from the team wallet; returns the new agent id. */
export async function registerAgent(cfg: ServerConfig, wallet: WalletClient, client: PublicClient, agentURI: string): Promise<{ agentId: bigint; tx: Hex }> {
  if (!cfg.identityRegistry) throw new Error('ERC-8004 identity registry address unknown (ERC8004_IDENTITY or deployments)');
  const account = wallet.account!;
  const data = encodeFunctionData({ abi: identityRegistryAbi, functionName: 'register', args: [agentURI] });
  await client.call({ account: account.address, to: cfg.identityRegistry, data });
  const tx = await wallet.sendTransaction({ account, chain: wallet.chain, to: cfg.identityRegistry, data });
  const r = await client.waitForTransactionReceipt({ hash: tx });
  for (const log of r.logs) {
    if (getAddress(log.address) !== getAddress(cfg.identityRegistry)) continue;
    try {
      const ev = decodeEventLog({ abi: registeredEvent, data: log.data, topics: log.topics });
      if (ev.eventName === 'Registered') return { agentId: ev.args.agentId, tx };
      if (ev.eventName === 'Transfer') return { agentId: ev.args.tokenId, tx };
    } catch {
      /* other event */
    }
  }
  throw new Error('register() emitted no Registered/Transfer event');
}
