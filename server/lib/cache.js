/**
 * AppCache — In-memory cache với TTL + Request Coalescing + Stale-While-Revalidate
 *
 * Pattern dùng bởi: GitHub, Shopify, Stripe (layer 1 trước Redis)
 *
 * Features:
 *  - TTL per key
 *  - Request coalescing: 100 req/s cùng key → chỉ 1 DB query duy nhất
 *  - Stale-while-revalidate: trả data cũ ngay, refresh background
 *  - invalidate() / invalidatePrefix() để xóa cache khi data thay đổi
 *  - Auto-prune mỗi 5 phút, không cần Redis
 */

class AppCache {
  constructor() {
    this._store    = new Map(); // key → { value, expiry, staleAt }
    this._inflight = new Map(); // key → Promise (request coalescing)

    // Dọn TTL-expired entries mỗi 5 phút
    setInterval(() => this._prune(), 5 * 60 * 1000).unref?.();
  }

  /**
   * cache.get(key, fetchFn, ttlMs, staleMs?)
   *
   * - Nếu cache còn fresh → trả ngay, không query DB
   * - Nếu cache stale nhưng chưa expired → trả ngay + refresh background
   * - Nếu cache expired (hoặc miss) + có request đang inflight → chờ chung 1 request
   * - Nếu cache miss hoàn toàn → fetch, cache, trả về
   */
  async get(key, fetchFn, ttlMs, staleMs) {
    const now  = Date.now();
    const hit  = this._store.get(key);

    if (hit) {
      if (hit.expiry > now) {
        // Fresh hit — trả ngay
        // Stale-while-revalidate: nếu sắp hết hạn, refresh background
        if (staleMs && hit.staleAt && now >= hit.staleAt && !this._inflight.has(key)) {
          this._bgRefresh(key, fetchFn, ttlMs, staleMs);
        }
        return hit.value;
      }
      // Expired — tiếp tục fetch mới
    }

    // Request coalescing: nếu đã có request đang chạy cho key này → chờ chung
    if (this._inflight.has(key)) {
      return this._inflight.get(key);
    }

    // Miss hoàn toàn — fetch và cache
    return this._fetch(key, fetchFn, ttlMs, staleMs);
  }

  _fetch(key, fetchFn, ttlMs, staleMs) {
    const promise = fetchFn().then(value => {
      const now = Date.now();
      this._store.set(key, {
        value,
        expiry:  now + ttlMs,
        staleAt: staleMs ? now + (ttlMs - staleMs) : null,
      });
      this._inflight.delete(key);
      return value;
    }).catch(err => {
      this._inflight.delete(key);
      throw err;
    });

    this._inflight.set(key, promise);
    return promise;
  }

  // Background refresh — không block caller, không throw
  _bgRefresh(key, fetchFn, ttlMs, staleMs) {
    const promise = fetchFn().then(value => {
      const now = Date.now();
      this._store.set(key, {
        value,
        expiry:  now + ttlMs,
        staleAt: staleMs ? now + (ttlMs - staleMs) : null,
      });
      this._inflight.delete(key);
    }).catch(() => {
      this._inflight.delete(key);
      // Ignore lỗi background refresh — data cũ vẫn còn giá trị
    });
    this._inflight.set(key, promise);
  }

  /** Xóa 1 key cụ thể (dùng khi data thay đổi) */
  invalidate(key) {
    this._store.delete(key);
    this._inflight.delete(key);
  }

  /** Xóa tất cả keys bắt đầu bằng prefix */
  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
        this._inflight.delete(key);
      }
    }
  }

  /** Xóa toàn bộ cache */
  flush() {
    this._store.clear();
    this._inflight.clear();
  }

  /** Thống kê (debug) */
  stats() {
    const now = Date.now();
    let fresh = 0, stale = 0, inflight = 0;
    for (const e of this._store.values()) {
      if (e.expiry > now) fresh++; else stale++;
    }
    inflight = this._inflight.size;
    return { total: this._store.size, fresh, stale, inflight };
  }

  _prune() {
    const now = Date.now();
    for (const [key, e] of this._store) {
      if (e.expiry <= now) this._store.delete(key);
    }
  }
}

const cache = new AppCache();
module.exports = cache;
