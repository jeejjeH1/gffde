/** In-memory TTL cache with in-flight de-duplication and stale-on-error reads. */
interface Entry<T> { value: T; at: number }

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>, now = () => Date.now()): Promise<{ value: T; at: number; stale: boolean }> {
    const hit = this.store.get(key) as Entry<T> | undefined;
    if (hit && now() - hit.at < ttlMs) return { value: hit.value, at: hit.at, stale: false };
    let p = this.inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load().finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    try {
      const value = await p;
      const at = now();
      this.store.set(key, { value, at });
      return { value, at, stale: false };
    } catch (e) {
      if (hit) return { value: hit.value, at: hit.at, stale: true };
      throw e;
    }
  }

  clear() { this.store.clear(); this.inflight.clear(); }
}

export const cache = new TtlCache();
