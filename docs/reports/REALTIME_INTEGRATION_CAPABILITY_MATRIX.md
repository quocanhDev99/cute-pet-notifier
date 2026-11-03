# REALTIME_INTEGRATION_CAPABILITY_MATRIX — Năng lực tích hợp thực tế

*Cập nhật: 03/11/2026. Năng lực của nhà cung cấp và Composio có thể thay đổi, cần kiểm tra lại khi triển khai.*

**Quy ước trạng thái:**
- **Verified E2E:** đã chạy một sự kiện thật hoặc mô phỏng đúng đặc tả qua toàn bộ đường đi, tới tận lúc render.
- **Implemented:** có code chạy được nhưng chưa test với tài khoản thật.
- **Unsupported:** không có API chính thức phù hợp. App hiển thị lý do, không làm nút giả.

| Ứng dụng | Đường tích hợp trong app | Actions | Triggers / Events | Delivery mode (nhãn UI) | Xử lý | Trạng thái | Latency đo được |
|---|---|---|---|---|---|---|---|
| Webhook nội bộ | `POST 127.0.0.1:3721/notify` | — | Người gửi đẩy JSON | `realtime_push` | Local | **Verified E2E** | nguồn→render p50 22 ms / p95 31 ms (n=30) |
| macOS / Windows (hệ thống) | Electron `powerMonitor` + Chromium Battery API | — | Pin ≤20 %/≤10 %, sạc/rút, mở khóa (sau ≥ 5 phút), quá nhiệt, thức dậy | `native_os` | Local | **Implemented** (adapter `Connected`). Chưa kích hoạt sự kiện pin/nhiệt thật trong lúc đo | — |
| GitHub | REST `GET /notifications` + PAT | Đánh dấu đã đọc khi bấm thẻ | Thread mới/cập nhật | `near_realtime_poll`, tôn trọng `X-Poll-Interval` (≥ 60 s) | Local | **Implemented**. Đã xác minh API trả 401 → `Requires Authorization` | Bị giới hạn bởi chu kỳ poll ≥ 60 s |
| Google / Outlook / iCloud Calendar | Link iCal bí mật (ICS) | — | Nhắc trước giờ họp (cấu hình được) | `scheduled_sync` (đồng bộ 5–240 phút; nhắc chạy cục bộ mỗi 30 s) | Local | **Verified fetch** (lịch Google công khai: 317 sự kiện). Chưa có lần nhắc họp thật nào được ghi lại | Không phải realtime |
| Slack (trực tiếp) | Socket Mode WebSocket (`xapp-` + `xoxb-`) | — | `app_mention`, `message.im` | `realtime_push` | Local | **Implemented**. Đã xác minh `invalid_auth` với token giả | — |
| Slack (qua Gateway) | Slack Events API → Gateway `/webhooks/slack` | — | `message`, `app_mention` | `realtime_push` | Cloud (gateway của bạn) | **Verified bằng test** (chữ ký v0, url_verification, idempotency theo `event_id`). Chưa có app Slack thật | — |
| Composio (Slack / Notion / Outlook triggers) | Composio → Gateway `/webhooks/composio` → SSE → desktop | Không dùng | Theo trigger instance | `realtime_push` theo tài liệu Composio. **Trigger không có trong danh sách → `near_realtime_poll`** | Cloud | **Verified E2E với payload V3 tự ký** (gateway localhost). **Chưa có tài khoản Composio thật** | gateway→desktop p50 5 ms / p95 42 ms; nguồn→render p50 30 ms / p95 76 ms (n=30, localhost) |
| Gmail | Composio Gmail trigger qua Gateway | — | Thư mới | **`near_realtime_poll`** (Composio managed OAuth: polling tối thiểu 15 phút từ 15/04/2026) | Cloud | Gắn nhãn polling có test bảo vệ. Gmail Pub/Sub push: **chưa triển khai** | Không phải realtime |
| Google Calendar (push) | Calendar API watch channel | — | Resource changed | — | — | **Not Implemented** (đang dùng ICS = scheduled sync) | — |
| Microsoft Outlook (Graph) | — | — | Change notifications | — | — | **Not Implemented** (dùng Composio qua Gateway hoặc ICS) | — |
| Microsoft Teams | — | — | Graph chat resources | — | — | **Unsupported** (hiển thị lý do) | — |
| Notion | Composio qua Gateway | — | Page/database events | `realtime_push` theo tài liệu Composio | Cloud | Đường gateway đã có. **Chưa test với Notion thật** | — |
| Discord | — | — | Gateway WebSocket (bot) | — | — | **Unsupported** (chưa triển khai bot) | — |
| Zalo | — | — | — | — | — | **Unsupported**: không có API cho tài khoản cá nhân | — |
| **macOS Notification Center** (thay thế banner của MỌI app) | Đọc **chỉ-đọc** DB Notification Center cục bộ (`sqlite3 -readonly`). **Không phải API công khai**: người dùng chủ động chọn ngày 03/11/2026 | Bấm thẻ → mở app gốc (`open -b`) | Mọi thông báo macOS ghi vào Notification Center | `native_os` | Local | **Verified E2E** với thông báo macOS thật (macOS 14.6.1) | adapter nhận sau ≈ 5.4 s (macOS tự trễ ≈ 5.25 s khi ghi DB, đo 4/4 lần); nhận → render 10–25 ms |
| Windows Toast Listener | — | — | `UserNotificationListener` | — | — | **Unsupported trong bản hiện tại**: cần đóng gói MSIX + capability | — |

## Gate MVP #8–9 (Blueprint §12)
- **#8 "≥ 1 luồng Native OS thật": đạt một phần.** Adapter hệ thống chạy trên `powerMonitor` thật (sự kiện do OS phát). Nhưng trong phiên đo chưa ghi được sự kiện pin/nhiệt thật nào tới tận lúc render.
- **#9 "≥ 1 luồng Realtime Push thật từ ứng dụng bên ngoài qua E2E test": chưa đạt.** Toàn bộ đường đi (webhook có chữ ký → gateway → SSE → desktop → render) đã chạy và được đo. Nhưng chưa có **ứng dụng bên ngoài thật**: cần tài khoản Composio hoặc app Slack, cùng gateway HTTPS công khai.
