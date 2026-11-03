/**
 * Calendar adapter — reads a private iCal (.ics) feed. Works with Google Calendar
 * ("Secret address in iCal format"), Outlook / Microsoft 365 ("Publish calendar → ICS")
 * and Apple iCloud (public calendar link). Emits a reminder N minutes before each meeting.
 */
const { ApplicationAdapter, STATUS } = require('./base-adapter');
const { parseICS, upcomingOccurrences } = require('./ics-parser');

const MAX_ICS_BYTES = 15 * 1024 * 1024;

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
    const ok = await this.sync();
    if (!ok) return false;
    this.startTimers();
    return true;
  }

  startTimers() {
    clearInterval(this.syncTimer);
    clearInterval(this.tickTimer);
    const pollMin = Math.max(5, this.config.pollMinutes || 10);
    this.syncTimer = setInterval(() => this.sync(), pollMin * 60 * 1000);
    this.tickTimer = setInterval(() => this.tick(), 30 * 1000);
    this.tick();
  }

  async disconnect() {
    clearInterval(this.syncTimer);
    clearInterval(this.tickTimer);
    this.syncTimer = this.tickTimer = null;
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  async sync() {
    try {
      const res = await this.fetch(this.url(), { headers: { 'User-Agent': 'CutePetCompanion', Accept: 'text/calendar' } });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.setStatus(STATUS.AUTH, `Link iCal bị từ chối (${res.status}) — kiểm tra lại link bí mật`);
        return false;
      }
      if (!res.ok) { this.setStatus(STATUS.ERROR, `Máy chủ lịch trả về ${res.status}`); return false; }
      const len = Number(res.headers.get('content-length') || 0);
      if (len > MAX_ICS_BYTES) { this.setStatus(STATUS.ERROR, 'File lịch quá lớn'); return false; }
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) { this.setStatus(STATUS.ERROR, 'Link không trả về dữ liệu iCal'); return false; }
      this.events = parseICS(text.slice(0, MAX_ICS_BYTES));
      const now = Date.now();
      const next = upcomingOccurrences(this.events, now, now + 7 * 864e5)[0];
      const nextLabel = next ? ` · tiếp theo: "${next.summary}" ${new Date(next.start).toLocaleString('vi-VN', { weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : '';
      this.setStatus(STATUS.CONNECTED, `${this.events.length} sự kiện${nextLabel}`);
      return true;
    } catch (err) {
      this.setStatus(STATUS.ERROR, `Không tải được lịch: ${err.message}`);
      return false;
    }
  }

  tick() {
    if (this.status !== STATUS.CONNECTED) return;
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
