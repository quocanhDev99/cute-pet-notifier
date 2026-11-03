# 🐾 Cute Pet Companion — 3D Desktop Pet & Smart Notification System

Ứng dụng desktop (macOS & Windows 10/11) biến thông báo khô khan thành tương tác có cảm xúc với thú cưng 3D phong cách art-toy sống ở góc màn hình. Thiết kế theo [docs/BLUEPRINT.md](docs/BLUEPRINT.md) **V3.2** và [docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md](docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md).

> 📊 Báo cáo nghiệm thu dựa trên số liệu đo thật: [docs/reports/](docs/reports/FINAL_IMPLEMENTATION_REPORT.md). Hạn chế đã biết: [KNOWN_LIMITATIONS](docs/reports/KNOWN_LIMITATIONS.md).

> 📦 **Cài đặt cho người dùng (macOS .dmg / Windows .exe):** [docs/INSTALL.md](docs/INSTALL.md)

## 🚀 Chạy nhanh

```bash
npm install
npm start          # build 2 bundle (overlay + control center) rồi mở Electron
npm test           # 41 test: engine, pipeline, attention, iCal, gateway, animation controller, bảo mật — cần Node ≥ 22
npm run gateway    # (tùy chọn) Integration Gateway cho Composio / Slack Events — xem gateway/README.md
npm run dist:mac   # đóng gói .dmg   |   npm run dist:win → .exe (NSIS 1-click)
```

Sau khi chạy: icon 🐾 trên menu bar / khay hệ thống → **Mở Control Center** (hoặc nhấp đúp vào thú cưng, hoặc mở `http://127.0.0.1:3721`).

## ✨ Tính năng

| Phân hệ | Đã có |
|---|---|
| **Nhân vật 3D** | Rig tham số dùng chung cho Mochi, Boba, Cloud, Pip (đúng tên bone theo blueprint). Ánh sáng studio + vật liệu matte vinyl, bóng tiếp xúc mềm. Tự nạp `model.glb` (Blender) nếu có: chuẩn hóa kích thước, chạy animation clip theo tên cảm xúc, blend morph target, bone `head` nhìn theo chuột. Nhập `.glb` ngay trong Control Center. |
| **8 cảm xúc** | Mắt (cười, nhắm, sao, tim, mở to, nheo), miệng, lông mày, má hồng, tai, đuôi, tư thế tay và hiệu ứng (tim, sao, 💢, hơi nóng, nước mắt, Zzz, ?, mồ hôi, !) chuyển đổi mượt mà. |
| **Xúc giác** | Xoa đầu (raycast + vận tốc chuột) → squash & stretch, bắn tim, tiếng purr. Thông báo gây phiền → né chuột, lắc đầu từ chối, nói câu theo tính cách. Nút "😒 Đá bay!" → thú cưng đá văng thẻ. |
| **Thẻ thông báo** | Thẻ acrylic 3D (độ dày, nghiêng theo chuột, ánh phản chiếu), 3 chế độ **Billboard Hugger / Peeker / Courier**, 3 theme (Pastel / Glass / Dark), 3 kích thước, 8 vị trí, đa màn hình. |
| **Emotion Engine** | 5 preset tính cách, phân loại 5 tầng (custom → app → keyword → metadata → default), regex có bảo vệ ReDoS, bộ thử phân loại trực tiếp. |
| **Pipeline** | Lọc dữ liệu không tin cậy, bỏ trùng, ưu tiên tin gấp, gộp tin dồn dập, giới hạn hàng đợi, Không làm phiền + giờ yên tĩnh. |
| **AnimationController (V3.2)** | Một bộ điều khiển duy nhất, chia 5 lớp (base, reaction, interaction, action, face). Cross-fade 0.18–0.35 s, biểu cảm mặt đổi sau một cú chớp mắt, chặn delta-time khi máy thức dậy, Reduced Motion. Với GLB: semantic mapping cấu hình trong `pet.json` và fallback khi thiếu clip. |
| **Sự chú ý (V3.2)** | 4 mức ưu tiên, cooldown 3 tin/10 s mỗi app, tắt tiếng từng app. Tin bị giữ lại vào **Inbox lưu bền + Digest**, không mất tin nào. |
| **Hiện diện & tập trung (V3.2)** | Full / Minimal / Hidden. Các chế độ Work · Deep Focus · Meeting · Gaming · Relax · Sleep, và giờ yên tĩnh. Tin khẩn cấp luôn được hiện. Có trong menu khay. |
| **Kéo thả** | Nhấc bổng thú cưng (giãn người, chân đung đưa, kêu cứu), thả xuống có cú nảy. Vị trí được lưu, thẻ tự mở về phía giữa màn hình. |
| **Hiệu năng** | 74.9 FPS (vsync 75 Hz), frame p95 14.3 ms. Vòng render **ngủ đông** khi rảnh (0 frame) và dừng hẳn ở chế độ Hidden/Gaming. |
| **Âm thanh** | Tiếng meo / gâu / chíp / píp, chuông vàng và nhạc theo cảm xúc, tổng hợp bằng Web Audio. |

## 🔌 Kết nối ứng dụng thật

Mỗi kênh được gắn **nhãn delivery mode trung thực**: `realtime_push`, `near_realtime_poll`, `scheduled_sync` hoặc `native_os`. App không bao giờ gọi polling là realtime. Độ trễ p50/p95 đo thật được hiển thị ngay trên Control Center.

| Kênh | Cách kết nối | Trạng thái |
|---|---|---|
| Webhook nội bộ | `POST http://127.0.0.1:3721/notify` (+ header `X-Pet-Secret` nếu bật) | ✅ |
| Hệ thống | Pin yếu / sạc, mở khóa màn hình, máy quá nhiệt, thức dậy (Electron `powerMonitor`) | ✅ |
| GitHub | Notifications REST API + Personal Access Token (classic, scope `notifications`) — bấm vào thẻ sẽ đánh dấu đã đọc | ✅ |
| Google / Outlook / iCloud Calendar | Link iCal bí mật → nhắc trước giờ họp (hỗ trợ TZID, RRULE, EXDATE, lịch dời) | ✅ |
| Slack | Socket Mode (WebSocket chính thức): DM & @mention | ✅ |
| Composio · Slack Events · webhook HMAC | **Integration Gateway** HTTPS của riêng bạn. Desktop kết nối ra qua SSE, không mở cổng; secret chỉ nằm trên gateway | ✅ (kiểm chứng E2E trên localhost) |
| Gmail / Outlook / Notion | Qua Composio trên Gateway (Gmail được gắn nhãn **polling**) | ⚠️ chưa test với tài khoản thật |
| **macOS Notification Center: thay thế thông báo của MỌI app** (bấm thẻ → mở đúng chat Teams/Slack khi app có gửi kèm thông tin) | Đọc chỉ-đọc DB Notification Center cục bộ (không phải API công khai của Apple; có thể hỏng khi nâng cấp macOS) | ✅ đã thử với thông báo thật · trễ ≈ 5.4 s do macOS |
| Windows Toast Listener | Cần đóng gói MSIX với capability `userNotificationListener` | ⛔ báo rõ lý do |
| Teams / Zalo | Graph cần endpoint HTTPS công khai; Zalo không có API cho tài khoản cá nhân | ⛔ báo rõ lý do |

Token được mã hóa bằng **macOS Keychain / Windows DPAPI** (`safeStorage`), không bao giờ gửi ngược về giao diện.

### Ví dụ webhook
```bash
curl -X POST http://127.0.0.1:3721/notify -H "Content-Type: application/json" \
  -d '{"title":"Build xong!","message":"CI passed","app":"github"}'
```
Các trường: `title`, `message`, `app`, `url` (http/https), `mood`, `priority` (`high`/`urgent`/`low`), `event` (`TASK_DONE`…`IDLE_DND`), `presentationMode`, `duration`, `forceEmotion`.

```bash
npm run test:notify                       # cảm xúc ngẫu nhiên
node scripts/send-test-notify.js angry peeker
```

## 🛡️ Bảo mật
- Server chỉ lắng nghe `127.0.0.1`, kiểm tra Host header (chống DNS rebinding).
- API `/api/*` của Control Center cần token ngẫu nhiên mỗi lần khởi động, không gửi CORS header.
- Overlay chạy `sandbox` + `contextIsolation` + CSP; chỉ mở link `http(s)`.

## 🗂️ Cấu trúc
```
src/
├── main/        index.js (Electron, tray, cửa sổ) · server.js (webhook + API + SSE)
├── core/        emotion-engine · attention-engine · inbox-store · latency · notification-pipeline · settings-store · secret-store
├── adapters/    webhook/system · github · calendar (+ ics-parser) · slack · gateway (SSE client) · hub
├── renderer/    overlay: renderer.js · sound.js · pet/ (animation-controller, pet-stage, semantic-map, character-builder, species, emotion-poses, fx)
├── control/     Control Center 10 phân hệ (index.html, control.js, control.css)
└── shared/      emotion-constants · sample-notifications
assets/          pet-manifest.json · pets/{id}/pet.json (+ model.glb khi có)
test/            node --test
```

## 📋 Tiến độ theo Blueprint V3.2
Xem [docs/reports/IMPLEMENTATION_STATUS.md](docs/reports/IMPLEMENTATION_STATUS.md).

Tóm tắt: P0 đã triển khai Attention Management, Adaptive Presence, AnimationController, kéo thả và đo latency. **MVP Gate còn thiếu 2 mục:**
1. `model.glb` production cho Mèo Mochi.
2. Một luồng realtime push từ ứng dụng bên ngoài thật (cần tài khoản Composio/Slack và gateway HTTPS công khai).

## 🍎 Để thú cưng thay thế hoàn toàn thông báo của macOS
1. Control Center → **Kết nối ứng dụng** → **macOS Notification Center** → **Lưu & kết nối**.
2. Bấm **⚙️ Mở Cài đặt Thông báo của macOS**. Với từng app (Zalo, Messenger, Mail, Slack…), đặt **Kiểu thông báo = Không có** và vẫn **bật "Hiển thị trong Trung tâm thông báo"**. Banner gốc sẽ biến mất, chỉ còn thú cưng mang tin tới.
3. Trên macOS 15 (Sequoia) trở lên: cấp **Full Disk Access** cho Cute Pet Companion (hoặc cho Terminal nếu chạy bằng `npm start`).

## ⏻ Tắt ứng dụng
- **Chuột phải vào thú cưng** → ⏻ Thoát Cute Pet Companion.
- Hoặc trong Control Center: nút **⏻ Thoát ứng dụng** ở góc dưới thanh bên, hoặc **Cmd+Q** khi đang mở cửa sổ Control Center.
- Hoặc icon 🐾 trên thanh menu. Trên MacBook có notch, icon này có thể bị giấu khi thanh menu nhiều icon.
