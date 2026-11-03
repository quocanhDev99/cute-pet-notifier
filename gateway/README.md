# ☁️ Cute Pet Companion — Integration Gateway

Server công khai **của riêng bạn** để nhận webhook realtime (Composio triggers, Slack Events API, webhook HMAC bất kỳ) và chuyển sang desktop qua **kết nối SSE đi ra** từ máy người dùng. Theo Blueprint V3.2 §6.4:

- Desktop **không bao giờ** mở `127.0.0.1:3721` ra Internet, không cần port-forwarding.
- Composio API key / webhook secret / Slack signing secret **chỉ nằm trên gateway**, không bao giờ có trong bộ cài desktop.

```
Composio / Slack / HMAC ──► POST /webhooks/{composio|slack|generic}
                              ├─ xác thực chữ ký (HMAC-SHA256)
                              ├─ chống replay (±300 s)
                              ├─ idempotency (webhook-id / event_id)
                              └─ ghi bền vào data/events.jsonl  → trả 200
Desktop  ◄── GET /events (Bearer DESKTOP_TOKEN, SSE, Last-Event-ID resume)
```

## Chạy

```bash
DESKTOP_TOKEN=$(openssl rand -hex 24) \
COMPOSIO_WEBHOOK_SECRET=whsec_xxx \
SLACK_SIGNING_SECRET=xxx \
node gateway/server.js          # lắng nghe :8787 (HTTP) — đặt HTTPS phía trước
```

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DESKTOP_TOKEN` | ✅ (≥ 24 ký tự) | Token desktop dùng cho `/events` |
| `COMPOSIO_WEBHOOK_SECRET` | | Bật `/webhooks/composio` |
| `SLACK_SIGNING_SECRET` | | Bật `/webhooks/slack` (Events API) |
| `GENERIC_WEBHOOK_SECRET` | | Bật `/webhooks/generic` (`X-Signature: sha256=hex(HMAC(secret, "{X-Timestamp}.{body}"))`) |
| `PORT` / `HOST` / `DATA_DIR` | | Mặc định `8787` / `0.0.0.0` / `gateway/data` |
| `TOLERANCE_SEC` | | Cửa sổ chống replay, mặc định 300 |
| `COMPOSIO_REALTIME_PREFIXES` | | Mặc định `SLACK_,NOTION_,OUTLOOK_` → gắn nhãn `realtime_push` |
| `COMPOSIO_POLLING_PREFIXES` | | Mặc định `GMAIL_,GOOGLECALENDAR_` → `near_realtime_poll` |

Trigger không nằm trong danh sách nào **luôn được gắn nhãn `near_realtime_poll`**. Không bao giờ gọi một trigger là realtime khi chưa kiểm chứng.

### HTTPS (bắt buộc ở production)
- **Cloud Run / Fly.io / Render:** chạy `node gateway/server.js`, dùng HTTPS do nền tảng cấp, mount volume cho `DATA_DIR`.
- **VPS:** chạy sau Caddy (`reverse_proxy localhost:8787`), Caddy tự cấp chứng chỉ.
- **Phát triển:** `cloudflared tunnel --url http://localhost:8787`. Riêng desktop cho phép `http://` khi gateway ở localhost.

## Kết nối Composio
1. Trong dashboard Composio: kết nối tài khoản ứng dụng (Slack, Notion, Outlook…) và tạo **trigger instance** cho đúng trigger cần dùng.
2. Đặt **project webhook URL** = `https://<gateway>/webhooks/composio`, rồi copy webhook secret vào `COMPOSIO_WEBHOOK_SECRET`.
3. Tạo một sự kiện thật trong ứng dụng nguồn và kiểm tra `GET /health` → `lastSeq` tăng.

Chữ ký được kiểm tra theo tài liệu Composio (đã đối chiếu ngày 03/11/2026):
- **Header:** `webhook-id`, `webhook-timestamp`, `webhook-signature`.
- **Chữ ký:** `base64(HMAC-SHA256(secret, "{id}.{timestamp}.{rawBody}"))`, header có dạng `v1,<sig>`.
- **Payload:** hỗ trợ V3 (`metadata.trigger_slug`), có fallback cho V2/V1.

## Kết nối desktop
Control Center → **Kết nối ứng dụng → Cloud Integration Gateway**:
1. Dán URL gateway và `DESKTOP_TOKEN` (token được lưu trong Keychain / DPAPI).
2. Bấm **Lưu & kết nối**.

Desktop giữ con trỏ `lastSeq` trong `userData/gateway-cursor.json`. Sau khi mất mạng hoặc tắt máy, các sự kiện bị lỡ sẽ được phát lại.

## Bảo mật & giới hạn
- **Không log nội dung:** payload không bao giờ bị log, chỉ ghi event ID và kết quả xử lý.
- **Dead-letter:** payload hợp lệ chữ ký nhưng không parse được sẽ vào `dead-letter.jsonl`.
- **Lưu trữ:** chỉ giữ `RETENTION` sự kiện gần nhất (mặc định 5000).
- **Một người dùng:** mỗi gateway phục vụ một người dùng / một `DESKTOP_TOKEN`. Gateway chưa hỗ trợ multi-tenant.
