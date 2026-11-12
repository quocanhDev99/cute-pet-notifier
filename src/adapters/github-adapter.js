/**
 * GitHub adapter — official REST API `GET /notifications` with a Personal Access
 * Token (classic: `notifications` scope; fine-grained tokens are NOT supported by
 * this endpoint). Honors `X-Poll-Interval` and uses `If-Modified-Since` so polls
 * that return 304 don't count against the rate limit.
 */
const { ApplicationAdapter, STATUS } = require('./base-adapter');

const API = 'https://api.github.com';

const REASON_LABEL = {
  assign: 'Bạn được giao việc',
  author: 'Cập nhật trên thread bạn tạo',
  comment: 'Có bình luận mới',
  ci_activity: 'Kết quả CI/CD',
  invitation: 'Lời mời tham gia repo',
  manual: 'Thread bạn theo dõi',
  mention: 'Bạn được nhắc đến (@mention)',
  review_requested: 'Review requested — cần bạn review',
  security_alert: 'Security alert — cảnh báo bảo mật',
  state_change: 'Trạng thái thay đổi',
  subscribed: 'Repo bạn theo dõi',
  team_mention: 'Team của bạn được nhắc đến'
};

function apiToHtmlUrl(apiUrl, repoHtml) {
  if (!apiUrl) return repoHtml || null;
  const m = apiUrl.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/(pulls|issues|commits|releases)\/(.+)$/);
  if (!m) return repoHtml || null;
  const kind = m[2] === 'pulls' ? 'pull' : m[2] === 'commits' ? 'commit' : m[2];
  if (kind === 'releases') return `https://github.com/${m[1]}/releases`;
  return `https://github.com/${m[1]}/${kind}/${m[3]}`;
}

class GitHubAdapter extends ApplicationAdapter {
  constructor(ctx, fetchImpl = globalThis.fetch) {
    super(ctx, {
      id: 'github',
      name: 'GitHub',
      icon: '🐙',
      description: 'Thông báo PR, review, @mention, CI từ GitHub Notifications API.',
      help: 'Tạo Personal Access Token (classic) tại github.com/settings/tokens với scope "notifications" (thêm "repo" nếu muốn đọc repo private). GitHub không có push cho Notifications API → đây là near real-time polling.',
      deliveryMode: 'near_realtime_poll',
      fields: [
        { key: 'token', label: 'Personal Access Token (classic)', type: 'secret', placeholder: 'ghp_…' },
        { key: 'participatingOnly', label: 'Chỉ thread tôi tham gia', type: 'boolean' },
        { key: 'pollSeconds', label: 'Chu kỳ kiểm tra (giây, ≥60)', type: 'number' }
      ]
    });
    this.fetch = fetchImpl;
    this.timer = null;
    this.lastModified = null;
    this.seen = new Map(); // threadId -> updated_at
    this.intervalSec = 60;
    this.gen = 0; // bumped by connect/disconnect: an in-flight request from before must not reschedule
  }

  token() { return this.ctx.secrets.get('github.token'); }

  intervalSeconds() { return this.status === STATUS.CONNECTED ? this.intervalSec : (this.config.pollSeconds || 60); }

  async request(pathname, opts = {}) {
    const res = await this.fetch(API + pathname, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'CutePetCompanion',
        Authorization: `Bearer ${this.token()}`,
        ...(opts.headers || {})
      }
    });
    return res;
  }

  async connect() {
    if (!this.token()) { this.setStatus(STATUS.AUTH, 'Chưa có token'); return false; }
    const gen = ++this.gen;
    try {
      const res = await this.request('/user');
      if (gen !== this.gen) return false; // disconnected while waiting
      if (res.status === 401) { this.setStatus(STATUS.AUTH, 'Token không hợp lệ hoặc đã hết hạn'); return false; }
      if (!res.ok) { this.setStatus(STATUS.ERROR, `GitHub trả về ${res.status}`); return false; }
      const user = await res.json();
      if (gen !== this.gen) return false;
      const scopes = res.headers.get('x-oauth-scopes');
      // Exact scope names: "public_repo" contains "repo" but does NOT grant notifications.
      const list = scopes === null ? null : scopes.split(',').map(s => s.trim());
      if (list !== null && !list.includes('notifications') && !list.includes('repo')) {
        this.setStatus(STATUS.LIMITED, `@${user.login} — token thiếu scope "notifications"`);
        return false;
      }
      this.login = user.login;
      this.connectedAt = new Date();
      this.lastModified = null;
      this.seen.clear();
      this.setStatus(STATUS.CONNECTED, `Đăng nhập @${user.login}`);
      this.schedule(1000);
      return true;
    } catch (err) {
      if (gen === this.gen) this.setStatus(STATUS.ERROR, `Không kết nối được: ${err.message}`);
      return false;
    }
  }

  async disconnect() {
    this.gen++;
    clearTimeout(this.timer);
    this.timer = null;
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  schedule(ms, gen = this.gen) {
    if (gen !== this.gen || this.status !== STATUS.CONNECTED) return; // disconnected meanwhile
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(), ms);
    if (this.timer.unref) this.timer.unref();
  }

  async poll() {
    if (this.status !== STATUS.CONNECTED) return;
    const gen = this.gen;
    const cfg = this.config;
    try {
      const params = new URLSearchParams({ all: 'false', participating: String(cfg.participatingOnly !== false), per_page: '50' });
      const headers = this.lastModified ? { 'If-Modified-Since': this.lastModified } : {};
      const res = await this.request(`/notifications?${params}`, { headers });
      if (gen !== this.gen) return;
      const pollHeader = Number(res.headers.get('x-poll-interval'));
      this.intervalSec = Math.max(cfg.pollSeconds || 60, Number.isFinite(pollHeader) ? pollHeader : 60);

      if (res.status === 401) { this.setStatus(STATUS.AUTH, 'Token bị thu hồi'); return; }
      if (res.status === 304) { this.schedule(this.intervalSec * 1000, gen); return; }
      if (!res.ok) { this.detail = `Lỗi poll ${res.status}`; this.schedule(this.intervalSec * 1000, gen); return; }
      this.lastModified = res.headers.get('last-modified') || this.lastModified;
      const threads = await res.json();
      if (gen !== this.gen) return;

      for (const t of (Array.isArray(threads) ? threads : []).reverse()) {
        const prev = this.seen.get(t.id);
        // Re-insert so the Map's order is "least recently seen first": eviction then drops threads
        // that went quiet, not a busy old thread that would be re-announced as new.
        this.seen.delete(t.id);
        this.seen.set(t.id, t.updated_at);
        // Only notify for activity after we connected and not already shown.
        if (prev === t.updated_at) continue;
        if (new Date(t.updated_at) < this.connectedAt) continue;
        this.publish(t);
      }
      if (this.seen.size > 500) this.seen = new Map([...this.seen].slice(-300));
      this.detail = `@${this.login} · kiểm tra mỗi ${this.intervalSec}s`;
    } catch (err) {
      if (gen !== this.gen) return;
      this.detail = `Lỗi mạng: ${err.message}`;
    }
    this.schedule(this.intervalSec * 1000, gen);
  }

  normalizeNotification(t) {
    const repo = t.repository && t.repository.full_name || 'GitHub';
    const reason = REASON_LABEL[t.reason] || t.reason;
    const type = t.subject && t.subject.type || '';
    let priority = null;
    if (t.reason === 'security_alert') priority = 'high';
    return {
      app: 'github',
      title: `[${repo}] ${t.subject && t.subject.title || 'Cập nhật mới'}`,
      message: `${reason}${type ? ` · ${type}` : ''}`,
      url: apiToHtmlUrl(t.subject && t.subject.url, t.repository && t.repository.html_url),
      priority,
      deliveryMode: 'near_realtime_poll',
      sourceCreatedAt: t.updated_at,
      sourceEventId: `${t.id}:${t.updated_at}`
    };
  }

  async handleNotificationAction(action, externalId) {
    if (!externalId || !this.token()) return;
    const threadId = String(externalId).split(':')[0];
    if (action === 'open' || action === 'markRead') {
      await this.request(`/notifications/threads/${encodeURIComponent(threadId)}`, { method: 'PATCH' }).catch(() => {});
    }
  }
}

module.exports = { GitHubAdapter, apiToHtmlUrl };
