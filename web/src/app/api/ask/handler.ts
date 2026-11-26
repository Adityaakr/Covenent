/*
 * Ask AI's request handler, separate from route.ts so tests can call it with a mocked Anthropic client and chain.
 * POST streams NDJSON AskEvents; GET says whether Ask AI is configured. The API key comes only from the server's
 * ANTHROPIC_API_KEY and never reaches the browser.
 */
import Anthropic from "@anthropic-ai/sdk";
import { isAddress } from "viem";
import { apiErrorText, DEFAULT_MODEL, LIMITS, parseHistory, runAsk } from "@/lib/ai/agent";
import { ChainUnavailable, loadContext, type AiContext } from "@/lib/ai/context";
import { clientIp, rateLimit } from "@/lib/ai/limits";
import { scrub } from "@/lib/ai/tools";
import type { AskEvent, AskRequest } from "@/lib/ai/types";

export interface AskDeps {
  env?: Record<string, string | undefined>;
  anthropic?: (apiKey: string) => Anthropic;
  context?: (account?: string) => Promise<AiContext>;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

export function askStatus(deps: AskDeps = {}) {
  const env = deps.env ?? process.env;
  const configured = Boolean(env.ANTHROPIC_API_KEY);
  return json(200, { configured, model: configured ? env.ANTHROPIC_MODEL || DEFAULT_MODEL : null, reason: configured ? null : "Ask AI is not configured on this site: the server has no ANTHROPIC_API_KEY." });
}

export async function askPost(req: Request, deps: AskDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { t: "error", code: "not_configured", message: "Ask AI is not configured on this site: the server has no ANTHROPIC_API_KEY." } satisfies AskEvent);

  const wait = rateLimit(clientIp(req.headers));
  if (wait > 0) return json(429, { t: "error", code: "rate_limited", message: `Too many questions from this address. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.` } satisfies AskEvent, { "retry-after": String(wait) });

  let body: AskRequest;
  try {
    const text = await req.text();
    if (text.length > LIMITS.maxHistoryBytes + 10_000) return json(413, { t: "error", code: "bad_request", message: "This conversation is too long. Start a new one." } satisfies AskEvent);
    body = JSON.parse(text) as AskRequest;
  } catch {
    return json(400, { t: "error", code: "bad_request", message: "The request was not JSON." } satisfies AskEvent);
  }
  const q = typeof body.q === "string" ? body.q.trim() : "";
  if (!q) return json(400, { t: "error", code: "bad_request", message: "Ask something." } satisfies AskEvent);
  if (q.length > LIMITS.maxQuestion) return json(400, { t: "error", code: "bad_request", message: `Keep the question under ${LIMITS.maxQuestion} characters.` } satisfies AskEvent);
  const history = parseHistory(body.messages);
  if (typeof history === "string") return json(400, { t: "error", code: "bad_request", message: history } satisfies AskEvent);
  const account = typeof body.account === "string" && isAddress(body.account) ? body.account : undefined;
  const notes = Array.isArray(body.notes) ? body.notes.filter((n): n is string => typeof n === "string").slice(0, 8) : [];

  let ctx: AiContext;
  try {
    ctx = await (deps.context ?? loadContext)(account);
  } catch (e) {
    return json(503, { t: "error", code: "chain", message: e instanceof ChainUnavailable ? `The chain is not available: ${scrub(e.message)}` : "The chain is not available right now." } satisfies AskEvent);
  }

  const anthropic = (deps.anthropic ?? ((k) => new Anthropic({ apiKey: k, maxRetries: 1, timeout: LIMITS.wallClockMs })))(key);
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const enc = new TextEncoder();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), LIMITS.wallClockMs);
  req.signal?.addEventListener("abort", () => ctl.abort());
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const emit = (e: AskEvent) => { try { c.enqueue(enc.encode(JSON.stringify(e) + "\n")); } catch { /* client went away */ } };
      try {
        await runAsk({ anthropic, model, ctx, history, q, notes, emit, signal: ctl.signal });
      } catch (e) {
        const { message, code } = ctl.signal.aborted ? { message: "That took too long and was stopped. Try a narrower question.", code: "timeout" as const } : apiErrorText(e);
        emit({ t: "error", message, code });
      } finally {
        clearTimeout(timer);
        try { c.close(); } catch { /* closed */ }
      }
    },
    cancel() { ctl.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
