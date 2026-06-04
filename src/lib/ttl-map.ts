/**
 * Process-level TTL map with lazy eviction and in-flight tracking.
 *
 * Two separate Maps back this class:
 *   - `_expiry`   : key → absolute expiry timestamp (ms). Set by `set()`.
 *   - `_inFlight` : key → present when a fetch is currently running.
 *
 * Eviction is lazy: expired entries are removed on the next `has()` / `get()`
 * call for that key, with no background setInterval needed.
 *
 * Designed as a module-level singleton so all HTTP handlers and the poller
 * share the same state within one Node.js process (PM2 single-instance mode).
 */
export class TtlMap<K = string> {
  private readonly _expiry = new Map<K, number>();
  private readonly _inFlight = new Set<K>();

  /** True if the key is present AND has not expired. */
  has(key: K): boolean {
    const exp = this._expiry.get(key);
    if (exp === undefined) return false;
    if (Date.now() >= exp) {
      this._expiry.delete(key);
      return false;
    }
    return true;
  }

  /** Store key with an explicit TTL (ms from now). */
  set(key: K, ttlMs: number): void {
    this._expiry.set(key, Date.now() + ttlMs);
  }

  /** Remove a TTL entry (does not affect in-flight state). */
  delete(key: K): void {
    this._expiry.delete(key);
  }

  /** True if a fetch for this key is currently running. */
  isInFlight(key: K): boolean {
    return this._inFlight.has(key);
  }

  /** Mark a fetch as started. */
  markInFlight(key: K): void {
    this._inFlight.add(key);
  }

  /** Clear the in-flight marker (call in finally). */
  clearInFlight(key: K): void {
    this._inFlight.delete(key);
  }

  /** True if the key is either fresh (TTL not expired) or currently in-flight. */
  isFreshOrInFlight(key: K): boolean {
    return this.isInFlight(key) || this.has(key);
  }
}
