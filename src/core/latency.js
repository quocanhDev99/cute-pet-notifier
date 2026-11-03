/**
 * Latency recorder — keeps a bounded window of samples per key and reports
 * real measured p50 / p95 (no estimates).
 */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

class LatencyRecorder {
  constructor(max = 500) {
    this.max = max;
    this.samples = new Map(); // key -> number[]
  }

  add(key, ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    const list = this.samples.get(key) || [];
    list.push(Math.round(ms));
    if (list.length > this.max) list.shift();
    this.samples.set(key, list);
  }

  stats(key) {
    const list = this.samples.get(key) || [];
    const sorted = [...list].sort((a, b) => a - b);
    return { count: list.length, p50: percentile(sorted, 50), p95: percentile(sorted, 95), max: sorted.length ? sorted[sorted.length - 1] : null };
  }

  all() {
    const out = {};
    for (const k of this.samples.keys()) out[k] = this.stats(k);
    return out;
  }
}

module.exports = { LatencyRecorder, percentile };
