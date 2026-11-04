# TEST_RESULTS — Nhật ký kiểm thử

## v3.4.0 — 04/11/2026 · Apple M2, macOS 14.6.1 · Node v22.11.0 · Electron 33.4.11
`npm test` → **73/73 pass** (≈ 2.5 s), 17 file:

| File | Phạm vi |
|---|---|
| animation-controller.test.mjs | profile chuyển cảnh, không giật pose, đổi mặt sau cú chớp, dt guard, grab, reduced motion, semantic map |
| attention.test.js | ưu tiên, Inbox, cooldown, chế độ tập trung, hidden/gaming, tắt tiếng |
| pipeline.test.js | lọc input, hàng đợi, dedupe, gộp, DND, idempotency, rows/actions allowlist, chế độ chat "mentions" |
| privacy.test.js | **chuỗi bí mật** không có trong event, history, Inbox và file trên đĩa; masked/anonymous; quy tắc "chặt hơn thắng" |
| chat-filter.test.js | nhắc tên (không dấu, @tên 1 chữ, không nhầm "mai" thường ngày / email), @all, câu báo của app, tin 1-1 |
| mood-reader.test.js | emoji, VI có/không dấu, EN, phủ định, "!!!"/CHỮ HOA, câu trung tính, độ nhạy |
| break-reminder.test.js | 60 phút dùng máy, rời máy thì đếm lại, chờ hết họp, hẹn 10 phút, nghỉ, tắt |
| bitbucket-review.test.js | thẻ gộp nhiều PR, approve từng dòng, từ chối id giả |
| composio-connect.test.js / composio.test.js | khóa `ck_`/`ak_`, connect → active → chỉ báo tin MỚI, triggers, remove |
| macos-nc.test.js / ncprefs.test.js | đọc kho thông báo, AX + DB không trùng thẻ, deep link, tắt/khôi phục banner trên BẢN SAO prefs |
| gateway.test.js / ics.test.js / emotion-engine.test.js / settings-and-server.test.js / windows-nc.test.js | như các bản trước |

### Kiểm thử thật (tài khoản người dùng, chỉ đếm số lượng, không in nội dung)
| Mục | Kết quả |
|---|---|
| Bitbucket: PR chờ review | 3 → 0 (người dùng đã approve; chưa xác định approve từ thẻ hay trên web) |
| Jira: việc đang mở được giao | 20, đủ key, tên, trạng thái, link; "giao bởi" tìm thấy ở 1/5 việc |
| Gmail: thư chưa đọc trong 24 giờ | 8, đủ tiêu đề |
| Màu thẻ theo giao diện | đã chụp màn hình với Đại dương và Đêm |
| Giọng nói | overlay thấy giọng "Linh" (vi) và "Samantha" (en) |
| Chữ ký app | `codesign --verify --deep --strict` pass; DR = identifier + certificate leaf |

---

## Lịch sử (bản trước)

*Ngày chạy: 03/11/2026 · Máy: Apple M2, macOS 14.6.1 · Node v22.11.0 · Electron 33.4.11 · three 0.187*

## 1. Kiểm thử tự động — `npm test`

Lệnh: `node --test --test-reporter=spec test/*.test.js test/*.test.mjs`

**Kết quả: 41 / 41 pass, 0 fail (≈0.84 s).**

| File | Phạm vi |
|---|---|
| `test/emotion-engine.test.js` | Phân loại 5 tầng, preset tính cách, regex có bảo vệ ReDoS |
| `test/pipeline.test.js` | Lọc input, hàng đợi, dedupe, **idempotency theo sourceEventId**, đo latency, event contract, DND → Inbox |
| `test/attention.test.js` | 4 mức ưu tiên, cooldown 3 tin/10 s, Focus Modes, Hidden/Gaming, tắt tiếng app, Inbox bền + Digest |
| `test/ics.test.js` | iCal: TZID, RRULE, EXDATE, lịch dời, bỏ sự kiện cả ngày/đã hủy |
| `test/gateway.test.js` | Chữ ký Composio (đúng/sai/bị sửa/hết hạn), idempotency, SSE + `Last-Event-ID`, Slack Events, hàng đợi bền qua restart, **E2E gateway → adapter desktop** |
| `test/animation-controller.test.mjs` | Profile 0.18–0.35 s, không pose pop, đổi mặt sau cú chớp mắt, chặn dt khi resume, nhấc bổng, ưu tiên tương tác, Reduced Motion, semantic map |
| `test/settings-and-server.test.js` | Validate settings, Host header, token API, không có CORS trên `/api`, webhook secret, path traversal |

<details><summary>Output đầy đủ</summary>

```text
✔ transition profiles stay within 0.18–0.35 s (1.562417ms)
✔ no pose pop: every numeric param moves continuously between frames (1.690791ms)
✔ face swaps happen behind a blink (never at full open eyes) (0.265166ms)
✔ delta-time guard: resume after sleep does not jump (0.091375ms)
✔ grab weight ramps smoothly in 0.18 s and out in 0.25 s, then lands (0.268666ms)
✔ user interaction outranks notification-driven actions (0.0775ms)
✔ reduced motion: longer transitions, damped oscillations, no jolt (0.188542ms)
✔ semantic map: clip aliases, morph fallback, name normalization (0.783959ms)
✔ priority derivation (0.76175ms)
✔ low priority → Inbox; normal → show (0.922125ms)
✔ per-app cooldown: 3 per 10s, critical bypasses (1.22325ms)
✔ focus modes gate by minimum priority and category; manual mode wins (0.629666ms)
✔ hidden presence & gaming keep events in Inbox but critical still shows (0.319875ms)
✔ muted apps (0.083083ms)
✔ inbox persists, digests and respects persistInbox=false (8.12675ms)
✔ keyword rules map Vietnamese + English text (1.067416ms)
✔ short numeric keywords match whole words only (0.53775ms)
✔ hierarchy: custom > app > keyword > metadata > default (0.778583ms)
✔ personality remaps and annoyance (0.628458ms)
✔ custom rule is never remapped by personality; forceEmotion bypasses all (0.191459ms)
✔ regex rules are guarded (0.189292ms)
✔ 5 presets exist (0.200708ms)
✔ Composio: valid signature accepted, invalid / replayed / old rejected, duplicates idempotent (44.893333ms)
✔ SSE: auth required, replay since Last-Event-ID, live push (50.076583ms)
✔ Slack Events API: url_verification + signature (6.978833ms)
✔ Durable queue survives a gateway restart (resume after crash) (33.752584ms)
✔ Desktop GatewayAdapter end-to-end: webhook → gateway → SSE → adapter publish, cursor persisted (113.400042ms)
✔ Gateway URL policy: https only (http only for localhost dev) (0.337125ms)
✔ parses events, unescapes text, extracts meet link (52.7805ms)
✔ TZID conversion, weekly BYDAY, EXDATE, overrides, all-day & cancelled skipped (9.940917ms)
✔ normalize sanitizes untrusted input (1.208417ms)
✔ displays one at a time and advances on finished() (302.748667ms)
✔ dedupes identical notifications (0.569875ms)
✔ higher priority jumps the queue; bursts are grouped (1.147791ms)
✔ queue overflow drops oldest non-urgent (0.422375ms)
✔ DND sends normal notifications to the Inbox (nothing lost) (0.169417ms)
✔ idempotency: same provider event ID never shows twice; latency measured on render (0.306417ms)
✔ event contract fields are normalized (0.135333ms)
✔ quiet hours across midnight (0.912ms)
[Server] Listening on http://127.0.0.1:37448
✔ settings validate types, enums and ranges; persist to disk (47.475958ms)
✔ server: host check, token auth, no CORS on api, webhook secret (323.968625ms)
ℹ tests 41
ℹ suites 0
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 839.251
```
</details>

## 2. Kiểm thử thủ công / tích hợp trên app thật

Tất cả chạy trên app Electron đang chạy (`npm start`), quan sát qua Chrome DevTools Protocol.

| # | Kịch bản | Kết quả quan sát |
|---|---|---|
| M1 | Webhook `POST /notify` × 30 (Billboard) | 30/30 hiển thị. Nguồn→render p50 22 ms, p95 31 ms (xem PERFORMANCE_REPORT) |
| M2 | Gateway cục bộ + webhook Composio có chữ ký × 30 | 30/30 tới desktop qua SSE. Gateway→desktop p50 5 ms. Nguồn→render p50 30 ms, p95 76 ms |
| M3 | Gateway × 20 cùng app `slack`, cooldown bật | 20/20 tới desktop; 11 hiện thẻ, **10 vào Inbox với lý do `cooldown`** — đúng chính sách |
| M4 | Meeting Mode | Tin thường → Inbox (`mode_meeting_min_important`); lịch họp (important) → hiện, không âm thanh |
| M5 | Presence = Hidden | Dock ẩn; tin thường → Inbox (`presence_hidden`); tin **critical vẫn hiện** rồi ẩn lại; vòng render **0 frame / 3 s** |
| M6 | Kéo thú cưng tới góc phải dưới (1740, 875) rồi nhận thẻ | Trước khi sửa: dock tràn khỏi màn hình. Sau khi sửa: thẻ mở về phía giữa, dock nằm gọn trong viewport |
| M7 | GitHub token giả / Slack `xapp-` giả (gọi API thật) | `Requires Authorization` / `invalid_auth` — trạng thái hiển thị đúng sự thật |
| M8 | Google Calendar ICS công khai (tải thật) | `Connected · 317 sự kiện` |
| M9 | Đo FPS khi chạy 8 cảm xúc × 3 chế độ cầm thẻ | 74.9 FPS (khóa theo vsync 75 Hz), p95 frame 14.3 ms |
| M10 | Đóng gói `electron-builder --mac --dir` (đã làm ở phiên trước) | App đóng gói chạy được, server phục vụ từ asar |

## 3. Chưa kiểm thử (Not Tested)
- **Composio thật:** chưa có tài khoản/project nên chưa nhận sự kiện từ Composio trên Internet. Gateway được kiểm thử bằng payload V3 do test tự ký đúng theo đặc tả.
- **Gateway trên HTTPS công khai:** chưa triển khai. Mọi phép đo gateway đều chạy trên localhost.
- **Slack Socket Mode / GitHub với token thật:** chưa có tài khoản thử nghiệm.
- **Windows 10/11:** chưa chạy hồi quy.
- **GLB production thật:** chưa có file `model.glb`. Đường GLB (semantic map, alias clip, morph) mới chỉ có unit test cho phần logic.
