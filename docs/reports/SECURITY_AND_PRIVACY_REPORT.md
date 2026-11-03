# SECURITY_AND_PRIVACY_REPORT

*Cập nhật: 03/11/2026*

## 1. Cổng nội bộ `127.0.0.1:3721`
| Biện pháp | Trạng thái | Kiểm thử |
|---|---|---|
| Chỉ bind vào loopback | ✅ | — |
| Kiểm tra Host header (chống DNS rebinding) | ✅ chỉ nhận `127.0.0.1:3721` / `localhost:3721` | `test/settings-and-server` → 421 |
| `/api/*` cần `X-Pet-Token` ngẫu nhiên mỗi lần khởi động (24 byte) | ✅ | 401 khi thiếu |
| Không gửi CORS header trên `/api`, nên trang web lạ không preflight hay đọc được | ✅ | Kiểm tra header |
| CSP + `X-Frame-Options: DENY` cho Control Center | ✅ | — |
| Giới hạn body: 64 KB JSON, 60 MB cho GLB (kiểm tra magic `glTF` v2) | ✅ | — |
| Chặn path traversal ở `/assets` và `/control` | ✅ | `..%2f` → 404 |
| Webhook secret tùy chọn (`X-Pet-Secret`, so sánh constant-time) | ✅ | 401 / 200 |
| **Không bao giờ mở cổng này ra Internet**: realtime từ bên ngoài đi qua Gateway, desktop chủ động kết nối ra | ✅ theo thiết kế | — |

## 2. Integration Gateway (`gateway/server.js`)
| Biện pháp | Trạng thái |
|---|---|
| HMAC-SHA256 cho Composio (Standard Webhooks), Slack (v0) và webhook generic | ✅ có test |
| Cửa sổ timestamp ±300 s (chống replay) | ✅ có test |
| Idempotency lưu bền (`webhook-id`, Slack `event_id`, `X-Event-Id`) | ✅ có test qua restart |
| Ghi bền rồi mới trả 200 (append JSONL, file mode 0600) | ✅ |
| `/events` cần `Authorization: Bearer DESKTOP_TOKEN` (≥ 24 ký tự, so sánh constant-time) | ✅ có test |
| Không log nội dung payload, chỉ log event ID và kết quả | ✅ |
| Dead-letter cho payload không parse được | ✅ |
| Secret chỉ qua biến môi trường, không có trong repo và bộ cài | ✅ |
| Yêu cầu HTTPS | ⚠️ Gateway nói HTTP; phải đặt sau TLS (README). Desktop **từ chối URL `http://` không phải localhost** |

## 3. Lưu trữ token trên desktop
- **Mã hóa:** Electron `safeStorage` (macOS Keychain / Windows DPAPI), file `secrets.bin.json` mode 0600.
- **Không lộ ra UI:** UI chỉ nhận cờ `isSet`, không bao giờ nhận lại giá trị token.
- **Xóa:** nút "Xóa token" xóa khỏi kho mã hóa.

## 4. Dữ liệu thông báo (untrusted input)
- **Lọc input:** bỏ ký tự điều khiển và ký tự bidi, giới hạn độ dài (tiêu đề 140, nội dung 600), chỉ chấp nhận URL `http(s)`. Timestamp bất hợp lý bị loại.
- **Overlay:** escape HTML, chạy `sandbox` + `contextIsolation`, có CSP, chặn điều hướng và `window.open`.
- **Log của main process:** chỉ ghi `id`, delivery mode, cảm xúc, mức ưu tiên và lý do. **Không ghi tiêu đề hay nội dung.** Đây là thay đổi trong bản cập nhật này; bản trước có log tiêu đề.

## 5. Quyền riêng tư & minh bạch xử lý dữ liệu (nguyên tắc 14)
| Nguồn | Xử lý ở đâu |
|---|---|
| Webhook nội bộ, Hệ thống, GitHub, Calendar ICS, Slack Socket Mode | **Local**: máy bạn gọi trực tiếp API nhà cung cấp |
| Cloud Gateway (Composio, Slack Events, HMAC) | **Cloud-mediated**: qua gateway **do bạn tự vận hành**, lưu tối đa `RETENTION` sự kiện |

Mỗi thẻ adapter trong Control Center ghi rõ "💻 Xử lý cục bộ" hoặc "☁️ Qua Gateway đám mây của bạn".

- **Lịch sử:** chỉ giữ trong RAM, có giới hạn, có nút xóa.
- **Inbox:** ghi xuống `userData/inbox.json` (mode 0600) khi bật "Lưu Inbox". Tắt tùy chọn này sẽ xóa file.

## 5b. Đọc Notification Center của macOS (lựa chọn của người dùng)
- **Chỉ đọc, chỉ lấy tin mới:** dùng `sqlite3 -readonly` với `mode=ro` URI, không bao giờ ghi vào DB của hệ thống. Chỉ lấy bản ghi **mới hơn** thời điểm bật adapter, không quét lịch sử cũ.
- **Dữ liệu ở lại trên máy:** nội dung đi vào pipeline cục bộ và theo đúng quy tắc Inbox/lịch sử. Không gửi lên mạng, không log nội dung.
- **Tắt được:** người dùng tắt bất cứ lúc nào bằng nút "Ngắt kết nối" trong Control Center.
- **Đi ngược nguyên tắc 1.2 (#2 cũ "chỉ API sanctioned"):** đây là quyết định có chủ đích của chủ sản phẩm, được ghi rõ trong KNOWN_LIMITATIONS.

## 6. Nguyên tắc không gây áp lực (nguyên tắc 11)
Không có streak, không phạt khi không tương tác, không ép vuốt ve. Lời thoại khi từ chối và khi bị nhấc bổng chỉ mang tính hài hước. Chế độ thủ công (Hidden / Focus) luôn thắng tự động.

## 7. Rủi ro còn lại
- **Token phiên:** `X-Pet-Token` được nhúng vào trang Control Center. Mọi tiến trình cục bộ cùng user đều đọc được, đây là giả định tin cậy của mô hình local-first.
- **Gateway một người dùng:** nếu lộ `DESKTOP_TOKEN` thì bên kia đọc được luồng sự kiện. Cách xử lý: đổi token và khởi động lại gateway.
