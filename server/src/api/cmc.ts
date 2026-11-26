/**
 * CoinMarketCap DEX API proxy. The key lives only on the server (CMC_API_KEY in server/.env).
 * Without a key it tries CMC's keyless `/public-api` prefix, which the doc names as the fallback;
 * that path supports fewer networks and endpoints, and the response says which mode served it.
 */

export interface CmcRoute {
  /** our path under /api/cmc */
  name: string;
  method: 'GET' | 'POST';
  /** upstream path */
  path: string;
  /** default query merged under the caller's */
  defaults?: Record<string, string>;
  use: string;
}

/** The endpoints listed in docs/DESIGN.md "CoinMarketCap DEX API in the app". */
export const CMC_ROUTES: CmcRoute[] = [
  { name: 'pair-quote', method: 'GET', path: '/v4/dex/pairs/quotes/latest', defaults: { aux: 'holders,security_scan' }, use: 'Live pair quote, holders and security scan on the covenant sheet' },
  { name: 'token-liquidity', method: 'GET', path: '/v1/dex/token-liquidity/query', use: 'Liquidity now, for depth alerts' },
  { name: 'liquidity-change', method: 'GET', path: '/v1/dex/liquidity-change/list', use: 'Liquidity changes, for depth alerts' },
  { name: 'candles', method: 'GET', path: '/v1/k-line/candles', use: 'Price history for the price against book chart' },
  { name: 'transactions', method: 'GET', path: '/v1/dex/tokens/transactions', use: 'Recent swaps, to show who is selling into an exit round' },
  { name: 'new-list', method: 'POST', path: '/v1/dex/new/list', use: 'Sample of new launches for the simulator' },
];

const FORBIDDEN_PARAMS = /key|token_secret|auth/i;

export interface CmcResult {
  status: number;
  body: unknown;
  mode: 'pro' | 'keyless-public-api';
  cached: boolean;
}

export class CmcClient {
  private cache = new Map<string, { at: number; value: CmcResult }>();
  constructor(
    private apiKey: string | undefined,
    private baseUrl = 'https://pro-api.coinmarketcap.com',
    private ttlMs = 30_000,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  get hasKey(): boolean {
    return Boolean(this.apiKey);
  }

  async call(route: CmcRoute, query: Record<string, string>, body?: unknown): Promise<CmcResult> {
    const params = new URLSearchParams({ ...(route.defaults ?? {}) });
    for (const [k, v] of Object.entries(query)) if (!FORBIDDEN_PARAMS.test(k)) params.set(k, v);
    const mode: CmcResult['mode'] = this.apiKey ? 'pro' : 'keyless-public-api';
    const url = `${this.baseUrl}${mode === 'pro' ? '' : '/public-api'}${route.path}${params.size ? `?${params}` : ''}`;
    const key = `${route.method} ${url} ${body ? JSON.stringify(body) : ''}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return { ...hit.value, cached: true };
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['X-CMC_PRO_API_KEY'] = this.apiKey;
    if (route.method === 'POST') headers['content-type'] = 'application/json';
    const res = await this.fetchImpl(url, {
      method: route.method,
      headers,
      body: route.method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    let parsed: unknown;
    const text = await res.text();
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: 'upstream returned non-JSON', status: res.status };
    }
    const value: CmcResult = { status: res.status, body: parsed, mode, cached: false };
    if (res.ok) this.cache.set(key, { at: Date.now(), value });
    return value;
  }
}
