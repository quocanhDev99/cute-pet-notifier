/**
 * Calendar adapter — reads a private iCal (.ics) feed. Works with Google Calendar
 * ("Secret address in iCal format"), Outlook / Microsoft 365 ("Publish calendar → ICS")
 * and Apple iCloud (public calendar link). Emits a reminder N minutes before each meeting.
 */
const { ApplicationAdapter, STATUS } = require('./base-adapter');
const { parseICS, upcomingOccurrences } = require('./ics-parser');

const MAX_ICS_BYTES = 15 * 1024 * 1024;

/** Response text, stopping at `max` bytes even when no Content-Length was sent (chunked). */
async function readTextLimited(res, max) {
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw Object.assign(new Error('too large'), { tooLarge: true });
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (Buffer.byteLength(text) > max) throw Object.assign(new Error('too large'), { tooLarge: true });
    return text;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch { /* ignore */ } throw Object.assign(new Error('too large'), { tooLarge: true }); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

class CalendarAdapter extends ApplicationAdapter {
  constructor(ctx, fetchImpl = globalThis.fetch) {
    super(ctx, {
      id: 'calendar',
      name: 'Google / Outlook Calendar (iCal)',
      icon: '📅',
      description: 'Nhắc lịch họp trước giờ bắt đầu từ link iCal bí mật của bạn.',
      help: 'Google Calendar → Cài đặt lịch → "Địa chỉ bí mật ở định dạng iCal". Outlook → Cài đặt → Lịch → Lịch đã chia sẻ → Xuất bản → ICS. Lịch được đồng bộ theo chu kỳ (scheduled sync), nhắc họp chạy cục bộ mỗi 30s.',
      deliveryMode: 'scheduled_sync',
      fields: [
        { key: 'icsUrl', label: 'Link iCal bí mật (https://…/basic.ics)', type: 'secret', placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics' },
        { key: 'leadMinutes', label: 'Nhắc trước (phút)', type: 'number' },
        { key: 'pollMinutes', label: 'Đồng bộ lịch mỗi (phút)', type: 'number' }
      ]
    });
    this.fetch = fetchImpl;
    this.events = [];
    this.notified = new Set();
    this.syncTimer = null;
    this.tickTimer = null;
    this.running = false; // reminders run while connected, even if a later re-sync fails
    this.gen = 0;
  }

  intervalSeconds() { return Math.max(5, this.config.pollMinutes || 10) * 60; }

  url() {
    const raw = this.ctx.secrets.get('calendar.icsUrl');
    if (!raw) return null;
    return raw.replace(/^webcal:\/\//i, 'https://');
  }

  async connect() {
    const url = this.url();
    if (!url) { this.setStatus(STATUS.AUTH, 'Chưa có link iCal'); return false; }
    if (!/^https:\/\//i.test(url)) { this.setStatus(STATUS.ERROR, 'Link phải bắt đầu bằng https:// hoặc webcal://'); return false; }
    const gen = ++this.gen;
    const ok = await this.sync({ initial: true });
    if (!ok || gen !== this.gen) return false; // failed, or disconnected while downloading
    this.startTimers();
    return true;
  }

  startTimers() {
    clearInterval(this.syncTimer);
    clearInterval(this.tickTimer);
    const pollMin = Math.max(5, this.config.pollMinutes || 10);
    this.running = true;
    this.syncTimer = setInterval(() => this.sync(), pollMin * 60 * 1000);
    this.tickTimer = setInterval(() => this.tick(), 30 * 1000);
    this.tick();
  }

  async disconnect() {
    this.gen++;
    this.running = false;
    clearInterval(this.syncTimer);
    clearInterval(this.tickTimer);
    this.syncTimer = this.tickTimer = null;
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  async sync({ initial = false } = {}) {
    const gen = this.gen;
    // A periodic re-sync that fails keeps the reminders of the calendar we already have running.
    const fail = (status, detail) => {
      if (gen !== this.gen) return false;
      if (!initial && this.running && this.events.length) this.setStatus(STATUS.LIMITED, `⚠️ ${detail} — vẫn nhắc theo lịch đã tải`);
      else this.setStatus(status, detail);
      return false;
    };
    try {
      const res = await this.fetch(this.url(), { headers: { 'User-Agent': 'CutePetCompanion', Accept: 'text/calendar' } });
      if (gen !== this.gen) return false;
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return fail(STATUS.AUTH, `Link iCal bị từ chối (${res.status}) — kiểm tra lại link bí mật`);
      }
      if (!res.ok) return fail(STATUS.ERROR, `Máy chủ lịch trả về ${res.status}`);
      let text;
      try { text = await readTextLimited(res, MAX_ICS_BYTES); } catch (err) { if (err.tooLarge) return fail(STATUS.ERROR, 'File lịch quá lớn'); throw err; }
      if (gen !== this.gen) return false;
      if (!text.includes('BEGIN:VCALENDAR')) return fail(STATUS.ERROR, 'Link không trả về dữ liệu iCal');
      this.events = parseICS(text);
      const now = Date.now();
      const next = upcomingOccurrences(this.events, now, now + 7 * 864e5)[0];
      const nextLabel = next ? ` · tiếp theo: "${next.summary}" ${new Date(next.start).toLocaleString('vi-VN', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : '';
      this.setStatus(STATUS.CONNECTED, `${this.events.length} sự kiện${nextLabel}`);
      return true;
    } catch (err) {
      return fail(STATUS.ERROR, `Không tải được lịch: ${err.message}`);
    }
  }

  tick() {
    if (!this.running) return;
    const lead = (this.config.leadMinutes ?? 5) * 60 * 1000;
    const now = Date.now();
    for (const occ of upcomingOccurrences(this.events, now, now + lead + 30 * 1000)) {
      const key = `${occ.uid}@${occ.start}`;
      if (this.notified.has(key)) continue;
      // Don't fire for meetings that already started more than 1 minute ago.
      if (occ.start < now - 60 * 1000) continue;
      this.notified.add(key);
      this.publish(occ);
    }
    if (this.notified.size > 2000) this.notified = new Set([...this.notified].slice(-500));
  }

  normalizeNotification(occ) {
    const mins = Math.max(0, Math.round((occ.start - Date.now()) / 60000));
    const time = new Date(occ.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return {
      app: 'calendar',
      title: `📅 Sắp họp: ${occ.summary}`,
      message: `${mins > 0 ? `Còn ${mins} phút` : 'Bắt đầu ngay bây giờ'} · ${time}${occ.location ? ` · ${occ.location}` : ''}`,
      url: occ.url && /^https?:\/\//.test(occ.url) ? occ.url : null,
      event: 'IDLE_DND',
      priority: 'important',
      category: 'calendar',
      deliveryMode: 'scheduled_sync',
      sourceEventId: `${occ.uid}@${occ.start}`
    };
  }
}

module.exports = { CalendarAdapter };
