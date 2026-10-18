/**
 * Resilient JSON fetch: timeout, bounded retries with exponential backoff,
 * Retry-After handling for 429/418, and sanitized errors (no URLs with secrets,
 * no response bodies in messages). Public endpoints only.
 */
export class HttpError extends Error {
  constructor(message: string, public status?: number, public retryable = false) {
    super(message);
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 8000, retries = 2, fetchImpl = fetch, sleep = defaultSleep } = opts;
  const host = new URL(url).host;
  let lastErr: HttpError = new HttpError(`${host}: unknown error`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let waitMs = 300 * 2 ** attempt;
    try {
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status === 418 || res.status >= 500;
      lastErr = new HttpError(`${host}: HTTP ${res.status}`, res.status, retryable);
      const ra = Number(res.headers.get("retry-after"));
      if (Number.isFinite(ra) && ra > 0) waitMs = Math.min(ra * 1000, 10_000);
      if (!retryable) throw lastErr;
    } catch (e) {
      if (e instanceof HttpError) {
        if (!e.retryable) throw e;
      } else {
        const aborted = (e as Error)?.name === "AbortError";
        lastErr = new HttpError(`${host}: ${aborted ? "timeout" : "network error"}`, undefined, true);
      }
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(waitMs);
  }
  throw lastErr;
}

/** Sequential-batch concurrency limiter for per-instrument fan-out calls. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
