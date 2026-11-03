# COMPOSIO_INTEGRATION_REPORT

*Cập nhật: 03/11/2026*

## 1. Kiến trúc
```
Ứng dụng nguồn (Slack/Notion/Outlook/Gmail…)
   └─► Composio trigger instance (gắn với connected account)
         └─► Project webhook URL = https://<gateway của bạn>/webhooks/composio
               ├─ verify HMAC-SHA256 (webhook-id.webhook-timestamp.rawBody, base64, "v1,<sig>")
               ├─ timestamp ±300 s (chống replay)
               ├─ idempotency: "composio:<webhook-id>" (lưu bền, giữ qua restart)
               ├─ chuẩn hóa → NormalizedNotification (provider=composio, sourceApplication theo slug)
               └─ ghi data/events.jsonl (seq tăng dần) → trả 200
Desktop ── GET /events (Bearer DESKTOP_TOKEN, SSE, Last-Event-ID) ─► GatewayAdapter
   └─► Pipeline: idempotency (sourceEventId) → Emotion Engine → Attention → render
```

- **Không có secret trên desktop:** không SDK Composio và không API key nào nằm trên máy người dùng (Blueprint nguyên tắc 13). Desktop chỉ giữ URL gateway và `DESKTOP_TOKEN` (trong Keychain/DPAPI).
- **Tách Actions và Triggers:** app **chỉ dùng Triggers** để nhận thông báo. Không có Action Composio nào được gọi.
- **OAuth / Connect Link:** thực hiện trên dashboard Composio (hoặc trên gateway nếu sau này bổ sung). Desktop không xử lý OAuth của Composio.

## 2. Đối chiếu đặc tả (docs.composio.dev, kiểm tra 03/11/2026)
| Mục | Tài liệu | Triển khai |
|---|---|---|
| Header | `webhook-id`, `webhook-timestamp`, `webhook-signature` | ✅ |
| Chuỗi ký | `{webhook-id}.{webhook-timestamp}.{rawBody}` | ✅ dùng raw body |
| Thuật toán | HMAC-SHA256, base64 | ✅ |
| Header chữ ký | Phần sau dấu phẩy (`v1,<sig>`), có thể có nhiều chữ ký | ✅ hỗ trợ nhiều chữ ký cách nhau bởi dấu cách |
| So sánh | constant-time | ✅ `crypto.timingSafeEqual` |
| Tolerance | SDK mặc định 300 s | ✅ `TOLERANCE_SEC=300` |
| Payload V3 | `{id, type, metadata{trigger_slug, connected_account_id,…}, data, timestamp}` | ✅. Có fallback V2/V1 |
| Sự kiện project (vd. connection expiry) | Cùng URL | ✅ `type` dạng `composio.connected_account…` được bỏ qua |
| At-least-once | Tài liệu **không nêu** | Vẫn idempotent theo `webhook-id` (gateway) và `sourceEventId` (desktop) |

## 3. Delivery mode theo trigger
- **`realtime_push`:** prefix `SLACK_`, `NOTION_`, `OUTLOOK_`. Đây là các trigger Composio mô tả là realtime, **chưa được chúng tôi test E2E**.
- **`near_realtime_poll`:** prefix `GMAIL_`, `GOOGLECALENDAR_` (Composio liệt kê là polling; Gmail managed OAuth ≥ 15 phút), và **mọi trigger chưa biết**.
- Có thể cấu hình bằng `COMPOSIO_REALTIME_PREFIXES` / `COMPOSIO_POLLING_PREFIXES` sau khi tự kiểm chứng.

## 4. Kết quả kiểm thử
| Test | Kết quả |
|---|---|
| Chữ ký hợp lệ → 200, seq 1 | ✅ |
| Gửi lại cùng `webhook-id` → duplicate, không tạo seq mới | ✅ |
| Body bị sửa / sai secret → 401 | ✅ |
| Timestamp lệch 1 giờ → 401 `timestamp_out_of_tolerance` | ✅ |
| Restart gateway → idempotency vẫn giữ, sự kiện cũ vẫn còn | ✅ |
| SSE `Last-Event-ID: 1` → chỉ phát lại seq 2, 3 | ✅ |
| E2E: webhook ký → gateway → SSE → `GatewayAdapter` → pipeline → **render** trên app thật | ✅ 30/30, nguồn→render p50 30 ms / p95 76 ms (gateway localhost) |
| Cooldown khi 20 sự kiện cùng app `slack` | ✅ 10 vào Inbox với lý do `cooldown` |

## 5. Chưa làm / cần làm
1. **Chưa có tài khoản Composio:** chưa tạo trigger thật, chưa nhận sự kiện thật từ Internet.
2. **Chưa triển khai HTTPS công khai:** chưa đặt gateway trên Cloud Run/Fly/VPS. Xem `gateway/README.md`.
3. **Chưa xử lý Connected account revoke / expiry:** sự kiện bị bỏ qua, chưa hiển thị trạng thái trong UI.
4. **Một người dùng:** gateway chưa hỗ trợ multi-tenant.
