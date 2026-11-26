import type { Candle } from './replay.js';

export interface SampledPool {
  pair: `0x${string}`;
  token: `0x${string}`;
  symbol: string | null;
  createdAt: number | null;
}

export interface MarketSource {
  name: string;
  /** how the headline names the sample, e.g. "actively traded BNB Chain launches" */
  sampleLabel: string;
  sampleDescription: string;
  candleDescription: string;
  notes: string[];
  sample(opts: { maxPools: number; minAgeDays: number; maxAgeDays: number }): Promise<SampledPool[]>;
  dailyCandles(p: SampledPool): Promise<Candle[]>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WBNB = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

async function getJson(url: string, init: RequestInit = {}, tries = 4): Promise<unknown> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...init, headers: { accept: 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
    if (res.status === 429 && i < tries) {
      await sleep(15_000 * (i + 1));
      continue;
    }
    // CoinMarketCap answers an intermittent 500 "system is busy": retry it quickly
    if (res.status >= 500 && i < tries) {
      await sleep(2_000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.replace(/\?.*/, '')}`);
    return res.json();
  }
}

/**
 * GeckoTerminal public API, the stated fallback when no CoinMarketCap key is available.
 * Sample: BNB Chain PancakeSwap V2 pools quoted in WBNB, from GeckoTerminal's pool listings
 * (sorted by 24h transactions and by 24h volume, up to 10 pages each, the API's maximum), whose
 * pool was created inside the age window. Candles: daily OHLCV priced in WBNB.
 */
export class GeckoTerminalSource implements MarketSource {
  name = 'geckoterminal';
  sampleLabel = 'actively traded BNB Chain launches';
  sampleDescription =
    'GeckoTerminal pool listings for BNB Chain: /dexes/pancakeswap_v2/pools (sort h24_tx_count_desc, h24_volume_usd_desc), /pools (sort h24_tx_count_desc) and /trending_pools, pages 1-10 each; WBNB-quoted pools created inside the age window';
  candleDescription = 'GeckoTerminal /networks/bsc/pools/{pool}/ohlcv/day?currency=token&token=base (price in WBNB per token)';
  notes = [
    'No CoinMarketCap API key was available, so this run uses GeckoTerminal as the stated fallback (the keyless CMC /public-api route answered with an anonymous-access limit).',
    'Survivorship bias: the listings rank pools by current activity, so tokens that died quietly are under-sampled. The trigger share is therefore a conservative estimate for launches in general.',
    'Days with no trades are filled with the previous close. A pool whose liquidity was pulled shows no candles after that, so a rug after launch can be missed.',
  ];
  private last = 0;
  constructor(
    private base = 'https://api.geckoterminal.com/api/v2',
    private minGapMs = 2_200, // public limit is about 30 calls per minute
  ) {}

  private async call(path: string): Promise<unknown> {
    const wait = this.last + this.minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
    return getJson(`${this.base}${path}`);
  }

  async sample(opts: { maxPools: number; minAgeDays: number; maxAgeDays: number }): Promise<SampledPool[]> {
    const now = Date.now() / 1000;
    const seen = new Map<string, SampledPool>();
    const lists = [
      (page: number) => `/networks/bsc/dexes/pancakeswap_v2/pools?page=${page}&sort=h24_tx_count_desc`,
      (page: number) => `/networks/bsc/dexes/pancakeswap_v2/pools?page=${page}&sort=h24_volume_usd_desc`,
      (page: number) => `/networks/bsc/pools?page=${page}&sort=h24_tx_count_desc`,
      (page: number) => `/networks/bsc/trending_pools?page=${page}`,
    ];
    for (const list of lists) {
      for (let page = 1; page <= 10 && seen.size < opts.maxPools; page++) {
        let j: {
          data?: { attributes: { address: string; name: string; pool_created_at: string | null }; relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } } } }[];
        };
        try {
          j = (await this.call(list(page))) as typeof j;
        } catch {
          break; // a listing that refuses a page ends that listing, the others still run
        }
        for (const p of j.data ?? []) {
          const quote = p.relationships.quote_token.data.id.replace(/^bsc_/, '').toLowerCase();
          if (quote !== WBNB) continue;
          const created = p.attributes.pool_created_at ? Date.parse(p.attributes.pool_created_at) / 1000 : null;
          if (created === null) continue;
          const age = (now - created) / 86_400;
          if (age < opts.minAgeDays || age > opts.maxAgeDays) continue;
          const pair = p.attributes.address.toLowerCase() as `0x${string}`;
          const token = p.relationships.base_token.data.id.replace(/^bsc_/, '').toLowerCase() as `0x${string}`;
          // one entry per launch: a token with several WBNB pools is still one launch (keyed by token, not pool)
          if (seen.has(token)) continue;
          seen.set(token, {
            pair,
            token,
            symbol: p.attributes.name.split(' / ')[0] ?? null,
            createdAt: created,
          });
          if (seen.size >= opts.maxPools) break;
        }
        if (!j.data?.length) break;
      }
    }
    return [...seen.values()];
  }

  async dailyCandles(p: SampledPool): Promise<Candle[]> {
    const j = (await this.call(`/networks/bsc/pools/${p.pair}/ohlcv/day?currency=token&token=base&limit=1000`)) as {
      data?: { attributes?: { ohlcv_list?: number[][] } };
    };
    return (j.data?.attributes?.ohlcv_list ?? [])
      .map(([t, o, h, l, c]) => ({ t: t!, o: o!, h: h!, l: l!, c: c! }))
      .filter((k) => k.o > 0 && k.c > 0)
      .sort((a, b) => a.t - b.t);
  }
}

/**
 * CoinMarketCap DEX API source, the doc's primary: POST /v1/dex/new/list for the sample and
 * GET /v1/k-line/candles for daily candles, with X-CMC_PRO_API_KEY. Field mapping is written to
 * CMC's DEX docs but has not been exercised in this build (no key was available); any response it
 * cannot map makes the job fall back to GeckoTerminal and say so in the output.
 */
export class CmcSource implements MarketSource {
  name = 'coinmarketcap';
  sampleLabel = 'new BNB Chain launches';
  sampleDescription = 'CoinMarketCap POST /v1/dex/new/list (BNB Chain)';
  candleDescription = 'CoinMarketCap GET /v1/k-line/candles (platform=bsc, token address, interval 1d, unit native: BNB per token)';
  notes = ['Sample and candles from the CoinMarketCap DEX API with a server-side key.'];
  constructor(
    private apiKey: string,
    private base = 'https://pro-api.coinmarketcap.com',
  ) {}

  private headers() {
    return { 'X-CMC_PRO_API_KEY': this.apiKey, 'content-type': 'application/json' };
  }

  async sample(opts: { maxPools: number; minAgeDays: number; maxAgeDays: number }): Promise<SampledPool[]> {
    const j = (await getJson(`${this.base}/v1/dex/new/list`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ network_slug: 'bsc', limit: Math.min(500, opts.maxPools * 4) }),
    })) as { data?: Record<string, unknown>[] };
    if (!Array.isArray(j.data)) throw new Error('unrecognized /v1/dex/new/list response');
    const now = Date.now() / 1000;
    const out: SampledPool[] = [];
    for (const r of j.data) {
      const pair = String(r.pair_address ?? r.contract_address ?? r.pairAddress ?? '').toLowerCase();
      const token = String(r.base_asset_contract_address ?? r.token_address ?? r.baseTokenAddress ?? '').toLowerCase();
      const createdRaw = r.created_at ?? r.date_added ?? r.launchTime;
      const created = typeof createdRaw === 'number' ? createdRaw : typeof createdRaw === 'string' ? Date.parse(createdRaw) / 1000 : null;
      if (!/^0x[0-9a-f]{40}$/.test(pair) || !/^0x[0-9a-f]{40}$/.test(token) || created === null) continue;
      const age = (now - created) / 86_400;
      if (age < opts.minAgeDays || age > opts.maxAgeDays) continue;
      out.push({ pair: pair as `0x${string}`, token: token as `0x${string}`, symbol: (r.base_asset_symbol as string) ?? null, createdAt: created });
      if (out.length >= opts.maxPools) break;
    }
    if (out.length === 0) throw new Error('no usable rows in /v1/dex/new/list response');
    return out;
  }

  /**
   * Token-level daily candles priced in BNB. Verified with the owner's key (keys-check, 2026-11-26):
   * platform=bsc&address=<token>&interval=1d&unit=native, limit at most 500, rows [o, h, l, c, volume, ts_ms, traders].
   */
  async dailyCandles(p: SampledPool): Promise<Candle[]> {
    const q = new URLSearchParams({ platform: 'bsc', address: p.token, interval: '1d', unit: 'native', limit: '500' });
    const j = (await getJson(`${this.base}/v1/k-line/candles?${q}`, { headers: this.headers() })) as { data?: unknown[] };
    if (!Array.isArray(j.data)) throw new Error('unrecognized /v1/k-line/candles response');
    return (j.data as (number[] | Record<string, number>)[])
      .map((k) =>
        Array.isArray(k)
          ? { t: k[5]! > 1e12 ? k[5]! / 1000 : k[5]!, o: k[0]!, h: k[1]!, l: k[2]!, c: k[3]! }
          : { t: k.time ?? k.timestamp ?? 0, o: k.open ?? 0, h: k.high ?? 0, l: k.low ?? 0, c: k.close ?? 0 },
      )
      .filter((k) => k.o > 0 && k.c > 0)
      .sort((a, b) => a.t - b.t);
  }
}

/**
 * GeckoTerminal sample, CoinMarketCap candles. POST /v1/dex/new/list is plan-gated (403, error 1006) on the owner's
 * key, so the doc's unbiased new-launch sample needs a higher CMC plan; until then the sample is GeckoTerminal's and
 * only the price history comes from CoinMarketCap.
 */
export class HybridSource implements MarketSource {
  name = 'geckoterminal+coinmarketcap';
  sampleLabel: string;
  sampleDescription: string;
  candleDescription: string;
  notes: string[];
  constructor(
    private gt: GeckoTerminalSource,
    private cmc: CmcSource,
  ) {
    this.sampleLabel = gt.sampleLabel;
    this.sampleDescription = gt.sampleDescription;
    this.candleDescription = cmc.candleDescription;
    this.notes = [
      'CoinMarketCap /v1/dex/new/list is not on this key\'s plan (403, error 1006), so the sample comes from GeckoTerminal and the daily candles from CoinMarketCap.',
      ...gt.notes.slice(1),
    ];
  }
  sample(opts: { maxPools: number; minAgeDays: number; maxAgeDays: number }) {
    return this.gt.sample(opts);
  }
  dailyCandles(p: SampledPool) {
    return this.cmc.dailyCandles(p);
  }
}
