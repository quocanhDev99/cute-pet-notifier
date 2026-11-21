# IMPLEMENTATION_STATUS — Trạng thái từng tính năng

*Cập nhật: 21/11/2026 · Phiên bản 3.11.2 · Quy ước: ✅ Hoàn thành · 🟡 Một phần · ⏳ Chưa làm · ⛔ Không hỗ trợ · 🧪 Chưa kiểm thử thật*

*Tương ứng nhãn của Blueprint V4.1 §5 Phase 0: ✅ = `Implemented` (kèm `Verified` khi ghi chú nêu bằng chứng trên máy thật) · 🟡 = `Partial` · 🧪 = `Not tested` · ⛔ = `Unsupported` · ⏳ = `Planned`. Các mục chưa ghi bằng chứng thiết bị thật là `Implemented`, chưa phải `Verified`.*

## Lõi
| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Thú cưng 3D (4 nhân vật, rig tham số, AnimationController 5 lớp) | ✅ | Chưa có `model.glb` production (xem KNOWN_LIMITATIONS) |
| Emotion Engine 5 tầng + 5 thái độ (Ngọt ngào, Cà khịa, Cáu kỉnh, Điềm đạm, Hào hứng) | ✅ | Mỗi thái độ có dáng lúc rảnh + cảm xúc khi có thông báo |
| 🎭 Thái độ quyết định phản ứng (`mood.followAttitude`, mặc định bật) | ✅ | Chỉ quy tắc tùy chỉnh, người quen, `forceEmotion` ghi đè. Ưu tiên tính theo nội dung (`contentEmotion`) |
| 👥 Người quen: 7 nhóm quan hệ do người dùng gán (Phase 6) | ✅ | Khớp tên không dấu; manager/important → Quan trọng; important bỏ qua cooldown; ignored → Inbox |
| 🔴 Số thông báo chưa xem trên bé + 🕒 ngày giờ trên thẻ | ✅ | Bấm chấm đỏ mở Hộp thư |
| Tin mới thay thẻ cũ sau 2,5 s (không chờ hết 9 s), thẻ bị thay vào Inbox | ✅ | Tin kém ưu tiên không chen tin quan trọng; thẻ đã ghim không bị chen |
| 🎭 Bé đọc cảm xúc từ nội dung (emoji, VI có/không dấu, EN, phủ định, cường độ) | ✅ | Ngay trên máy; có 3 mức nhạy và ô gõ thử |
| Pipeline: lọc, bỏ trùng, ưu tiên, gộp, hàng đợi | ✅ | |
| 🤝 Mode B — Giữ thông báo hệ thống + thú cưng (`notifications.bannerMode = companion`, mặc định cho bản cài mới) | ✅ / 🧪 | v3.6.0. Không đổi registry/ncprefs, không đóng banner gốc; bé im lặng với tin có banner hệ thống (tùy chọn `companionSound`); dock tránh vùng banner ước lượng. Unit test + e2e overlay đã qua; chưa kiểm trên máy thật |
| 🎨 Control Center theo `MASTER_UIUX_SPEC_V2.md` (6 tab; trang chủ 3 khu vực; Thông báo 3 kiểu tương tác + 3 công tắc; Hộp thư 4 bộ lọc; Kết nối công tắc từng app; Cài đặt 4 nút theme tròn) + CP-13 nhìn theo chuột + CP-14 đèn viền ấm | ✅ | v3.9.0 — đối chiếu: `docs/design/uiux-v2/IMPLEMENTATION_AUDIT.md` §7 |
| 🔔 Tab Thông báo theo Concept v2 (6 khối: preview Windows/macOS, 2 chế độ + nút bắn thử, 4 kiểu bám, chuỗi 6 bước, 4 biến thể, tùy chỉnh nhanh) · Mode 1 bật lại (`COMPANION_MODE_AVAILABLE = true`) · kiểu bám mặc định Cling (cài mới) · sửa theme Đêm trang chủ | ✅ | v3.10.0 |
| ⚡ v3.11.2: Mượt hoá pet + khung thông báo — khởi động nóng lúc rảnh: biên dịch sẵn 19 shader (gồm biến thể transmission của nước mắt), tạo sẵn AudioContext, cho GPU vẽ thử khung thông báo ở 1 % độ mờ (shader bóng đổ/gradient/3D); phần cắt thân pet khi bám banner/thẻ trượt mượt (transition clip-path) thay vì giật 1 khung | ✅ | Đo khung hình thật (75 Hz): lần đầu bé chạy tới banner 61 ms → 0, khung thông báo đầu 93–106 ms → ≤ 27 ms; với cài đặt người dùng (2560×1392, pastel, gọn, bám nằm) 0 khung hụt |
| 🐾 v3.11.1: Toast thử của Mode 1 bị bộ đọc thông báo Windows bắt lại thành sự kiện thứ hai (Windows không trả tên app/AUMID cho toast của app) → bé ở lại sau khi banner tắt và badge tăng. Nhận diện toast của chính app bằng nội dung; giữ tham chiếu Notification để sự kiện đóng/bấm luôn tới | ✅ | Đối chiếu nội dung toast thật trong Trung tâm thông báo |
| 👥 v3.11.0: Người quen thành tab riêng (Concept v2: mặc định chung · app pills · 2 cột Cuộc trò chuyện / Thiết lập phản ứng · bảng người quen đã thiết lập · tùy chọn nâng cao) · Mode 1 chỉ một kiểu hiển thị (bám mép banner) · bé rời đi cùng lúc banner tắt (thời lượng banner của Windows `MessageDuration`, đóng/bấm banner thử thì bé đi ngay) | ✅ / 🧪 | Kiểm bằng script trên Control Center thật (chọn, lưu, lọc, tìm, sửa, bật/tắt); thời lượng banner chưa kiểm trên máy khi rê chuột giữ toast |
| 🐾 v3.10.1: Mode 1 + Giảm chuyển động — bé đứng dưới vùng toast thì lên thẳng mép trên toast (không bị toast che); minh họa 4 kiểu bám rõ hơn; 2 thẻ so sánh chế độ; Control Center tự mở sau mỗi lần cài (marker `.just-installed` từ NSIS `customInstall`) | ✅ | e2e companion: ca Reduced Motion dưới banner (đã xác nhận fail khi bỏ sửa) |
| 🖱️ Sửa: sau khi Windows đổi thông số màn hình / resume, thẻ có thể không nhận click (renderer và main lệch trạng thái chuột) | ✅ | v3.9.1 — renderer quên trạng thái khi main reset + gửi lại mỗi giây khi chuột ở trên thẻ; e2e `after main resets click-through…` (đã xác nhận fail khi bỏ sửa); `main.log` ghi `[mouse]`, `[overlay] card action`, `[overlay] recover` (không nội dung) |
| ⏸️ **Mode 1 tạm tắt — "Sắp ra mắt"** (`COMPANION_MODE_AVAILABLE = false` trong `src/shared/emotion-constants.js`) | ⏳ | v3.8.2. Chỉ dùng Mode 2; settings `companion` được lưu/áp dụng thành `replace`. Code và test của Mode 1 giữ nguyên (test chạy với cờ bật) |
| 📏 Thẻ luôn cách taskbar ≥ 16 px ở mọi kiểu gắn / vị trí (kể cả bé đỗ sát đáy, lề 0) | ✅ | v3.8.3, e2e `card never sits flush on the taskbar` (đã xác nhận test fail khi bỏ sửa) |
| 🤝 Mode 1 "chỉ có bé": tin có banner hệ thống → bé chạy tới cạnh vùng banner, phản ứng, về chỗ (không thẻ trùng); tin không có banner → thẻ | ✅ / 🧪 | v3.7.0, `notifications.companionCard` để hiện cả thẻ. e2e overlay đã qua (không thẻ, ngoài vùng banner, về đúng chỗ, Reduced Motion tại chỗ); chưa kiểm cùng banner thật trên máy |
| ▶ Xem thử chế độ 1 bằng một thông báo hệ thống thật của app + bé | 🧪 | v3.7.0, Electron `Notification`; chưa kiểm trên máy |
| 🍅 Pomodoro / 📚 Học tập (50/10): pha tập trung = chỉ tin khẩn cấp, thẻ khi hết pha, chip đếm ngược trên bé, điều khiển ở Control Center + khay | ✅ | v3.7.0, test Node (pha, nghỉ dài, tạm dừng, bỏ qua, chế độ chú ý) |
| 💧 Độ trong suốt của bé · 🖱️ Click xuyên qua bé · ✓ Đã đọc trên thẻ | ✅ | v3.7.0, e2e cho độ trong suốt / click xuyên |
| 🎨 Control Center thiết kế lại theo UI/UX JSON v2 (pastel kính mờ, theme Oải hương mặc định cho bản cài mới, trang chủ dashboard, mục **Chế độ** mới, lưới danh mục Cài đặt, chip danh mục Kết nối, ✓ Đã đọc từng dòng Hộp thư) | ✅ | v3.8.0 — đối chiếu từng mục: `docs/design/uiux-v2/IMPLEMENTATION_AUDIT.md` |
| 🗂️ Thẻ thông báo gọn ≈340 px (1 dòng tiêu đề, 2 dòng nội dung, ≤ 2 nút, ✕/🦶 trên header) + kiểu gắn **Bám góc** (mặc định mới) và **Tựa cằm** | ✅ | v3.8.0, e2e: bé ở góc thẻ, phía sau thẻ, không bị dời ở sát mép |
| 🎨 Tab Thông báo → Hiển thị thiết kế lại theo Concept v2 (`docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md`) | ✅ | Ảnh minh họa dùng ảnh render thật của bé đang chọn |
| 🐾 Mode A — Thú cưng thay thông báo (`bannerMode = replace`) | ✅ | Người dùng cũ giữ nguyên chế độ đang dùng khi cập nhật (migration theo cờ suppress của nền tảng) |
| Attention: 4 mức ưu tiên, cooldown, tắt tiếng app, 7 chế độ tập trung, giờ yên tĩnh, Hộp thư | ✅ | |
| 💬 Chat: báo tất cả / chỉ tin dành cho tôi (nhắn riêng 1-1, nhắc tên, @all) | ✅ | Với thông báo của máy, tin 1-1 được nhận ra theo dạng tin (tiêu đề nhóm/#kênh, "Người gửi: …"); Slack biết chính xác |
| 🙈 Privacy Display Mode (4 mức, ẩn theo app, bật nhanh từ menu) | ✅ | Không tự phát hiện chia sẻ màn hình ⏳ |
| 💆 Nhắc nghỉ mắt (tính theo thời gian dùng máy thật, hoãn khi đang họp hoặc tập trung) | ✅ | |
| 🗣️ Giọng nói (nhắc nghỉ, nhấc bổng, thả xuống) | ✅ | Giọng của hệ thống; chỉ nói câu cố định. Từ v3.6.0 **tắt mặc định** cho bản cài mới (Blueprint §8.5, opt-in); người dùng cũ giữ lựa chọn |
| 🎙️ Tiếng thật của 4 bé (25 file CC0 từ Freesound) qua AudioController: cooldown, không lặp liền, 3 kênh âm lượng, dự phòng âm tổng hợp | ✅ / 🧪 | v3.6.0. Test Node + e2e giải mã trong Chromium; **chưa nghe duyệt bằng tai**. Bật/tắt và âm lượng từng kênh: *Cảm xúc & Tính cách → Âm thanh & chuyển động* |
| 🐾 Hành vi lúc rảnh: nhìn quanh, nghiêng đầu, đổi trọng tâm, chớp mắt chậm / chớp đôi | ✅ | v3.6.0. Tắt khi có thẻ, đang bế, Focus-ngủ, Hidden; Reduced Motion chỉ giữ chớp mắt. Tần suất theo "Độ sinh động" |
| ✨ Hình ảnh: lông như nhung + mắt có mống mắt/con ngươi | ✅ | v3.6.0, rig procedural (chưa có GLB) |
| 🎬 GLB production: nhận tên clip theo spec nhân vật (`idle_breathing`, `emotion_*`, `interaction_*`, `sleep_loop`) | ✅ | v3.6.0, có test. Chưa có GLB production nào |
| Control Center: 6 tab + Theo dõi, 6 màu giao diện (thẻ thông báo đổi theo), VI/EN | ✅ | Chọn Mode A/B ở *Thông báo → 🎨 Hiển thị* |
| Click-through overlay (main process đọc vị trí con trỏ và so với vùng thẻ) | ✅ | |
| Ký app bằng chứng chỉ cục bộ cố định | ✅ | Chưa có chứng chỉ Apple Developer, nên chưa notarize ⏳ |

## Nguồn thông báo
| Nguồn | Trạng thái | Cách nhận |
|---|---|---|
| macOS Notification Center: đọc kho thông báo | ✅ | native_os, trễ khoảng 5 giây |
| macOS: bắt banner tức thì + bấm thẻ mở đúng chat (nc-bridge, Accessibility) | 🟡 | Chạy ở bản dev. Bản đã ký đang chờ người dùng cấp lại quyền để xác nhận |
| macOS: tắt banner gốc / khôi phục | ✅ | |
| Composio Connect (`ck_`, MCP): Gmail, Outlook, Lịch Google, GitHub | ✅ / 🧪 | Gmail đã kiểm với tài khoản thật; Outlook, Lịch, GitHub chưa |
| Jira: việc mới giao (kèm "giao bởi" từ changelog) / đổi trạng thái | ✅ | Kiểm tra định kỳ 2 phút |
| Bitbucket: PR chờ review + Approve trên thẻ | ✅ / 🧪 | Đã kiểm việc đọc với tài khoản thật; approve thật từ thẻ chưa được xác nhận |
| Composio REST (`ak_`) + trigger qua Gateway | 🧪 | Đã có unit test, chưa chạy với tài khoản thật |
| Slack Socket Mode, GitHub PAT, Lịch iCal, Pin/hệ thống, Webhook | ✅ | |
| Windows Toast Listener (WinRT, đọc ~150–350 ms sau khi Windows nhận) | ✅ | Kiểm trên Windows 11 thật 04/11/2026; chữ tiếng Việt đúng (stdout UTF-8) |
| Windows: bấm "Mở app" đưa đúng ứng dụng lên trên cùng (theo AUMID) | ✅ | Không mở được đúng cuộc chat (giới hạn của Windows) |
| Windows: thay thế hoàn toàn — tắt banner (`ShowBanner=0`) + âm thanh (`SoundFile=''`, công tắc âm thanh chung) | ✅ / 🧪 | Sao lưu & khôi phục đúng 71/71 giá trị đã kiểm; banner không còn hiện đã kiểm bằng ảnh chụp; **âm thanh chưa nghe thử bằng tai** |
| Windows: khôi phục banner/âm thanh khi gỡ cài đặt (hook NSIS `customUnInit`) | ✅ / 🧪 | v3.6.0. Lệnh khôi phục đã kiểm trên khóa registry thử; hook có trong installer 3.6.0; chưa chạy gỡ cài đặt thật |
| Teams Graph / Zalo cá nhân | ⛔ | Thông báo của Teams/Zalo vẫn được bé mang tới qua Notification Center của macOS |

## Đã gỡ bỏ
- **Thao tác nhanh trên thẻ (Hoãn 10 phút, Ghim, Tắt app, Sửa cảm xúc):** gỡ theo yêu cầu người dùng ngày 04/11/2026.
- **YouTube Pet Video Frame (khung video thu nhỏ):** gỡ theo yêu cầu người dùng ngày 04/11/2026.
