# 🐾 Cute Pet Companion

**Một thú cưng 3D sống ở góc màn hình, thay thế các thông báo khô khan của máy tính.** Tin nhắn Teams/Zalo/Slack, email, PR cần review, việc Jira mới giao… đều được bé mang tới bằng một tấm thẻ dễ thương, kèm cảm xúc hợp với nội dung tin. Bé biết khi nào nên im lặng, và biết nhắc bạn nghỉ mắt.

*Phiên bản 3.5.5 · macOS (Apple Silicon & Intel — một file cài universal) · Windows 10/11 (chưa kiểm thử trên máy thật)*

---

## 1. Bé làm được gì cho bạn?

| | Tính năng | Bạn được gì |
|---|---|---|
| 🍎 | **Thay thông báo của máy Mac** | Banner góc phải của macOS được thay bằng thẻ của bé. Bấm thẻ là mở đúng app (với Teams/Slack thì mở đúng cuộc chat khi có thông tin). |
| 💬 | **Chỉ báo tin dành cho bạn** | Chọn "báo tất cả tin nhắn" hoặc "chỉ tin dành cho tôi": tin nhắn riêng 1-1, tin có tên bạn hoặc @all. Tin nhóm khác vẫn được giữ trong Hộp thư. |
| 🔍 | **Bitbucket** | PR chờ bạn review (nút **↗ Mở** và **✅ Approve** ngay trên thẻ), và hoạt động trên **PR của bạn**: ai approve, ai yêu cầu sửa, bình luận mới. |
| 🧩 | **Jira** | Việc mới giao cho bạn (kèm **người giao**), việc đổi trạng thái, **bình luận**, **@nhắc tên** và cập nhật của người khác trên việc bạn được giao / tạo / theo dõi. |
| 👥 | **Người quen** | Chọn **ứng dụng → cuộc chat → người** (không cần gõ tên), rồi chọn quan hệ (💕 người yêu, 💼 sếp, 👨‍💻 đồng nghiệp… 11 loại), cảm xúc và cách bé báo. Áp dụng cho một người hoặc **cả nhóm chat**. Bé gợi ý những ai **hay nhắn nhất**; chuột phải vào thẻ thông báo để **xếp nhóm nhanh**. Mỗi quan hệ có **giờ riêng** (vd. đồng nghiệp sau 18:00 vào Hộp thư). |
| ✉️ | **Gmail, Outlook, GitHub, Lịch…** | Kết nối hơn 1000 ứng dụng qua Composio, không cần lập trình. |
| 🎭 | **Bé đọc cảm xúc tin nhắn** | 😁 → bé vui, "gãy rồi 😭" → bé buồn, "gấp lên!!" → bé cáu. Xử lý ngay trên máy. |
| 🧠 | **Không làm phiền sai lúc** | 4 mức ưu tiên, 7 chế độ tập trung (Làm việc, Đang họp, Chơi game…), giờ yên tĩnh, tắt tiếng từng app. |
| 📥 | **Hộp thư** | Tin bị giữ lại khi bạn đang tập trung, nên không có tin nào bị mất. |
| 🙈 | **Ẩn nội dung khi chia sẻ màn hình** | 4 mức: đầy đủ / che bớt / chỉ tên app / ẩn hoàn toàn. Bật nhanh bằng chuột phải vào bé. |
| 💆 | **Nhắc nghỉ mắt** | Sau mỗi 60 phút dùng máy thật, bé nhắc và nói *"Bạn ơi, mình nghỉ mắt một chút nha!"*, rồi đếm giờ nghỉ giúp bạn. |
| 🗣️ | **Bé biết nói** | Giọng đọc tiếng Việt và tiếng Anh có sẵn trên máy: khi nhắc nghỉ, khi bị nhấc bổng, khi được thả xuống. Bé không bao giờ đọc nội dung thông báo. |
| 🧠 | **Bé quen dần với bạn** | Bé nhận ra ai hay gửi tin quan trọng để báo nhanh hơn, nhóm nào quá ồn để báo nhẹ nhàng — chỉ dựa vào số lượng tin, không đọc trộm nội dung; xem lại, tắt hoặc xóa được. |
| 🎨 | **Cá nhân hóa** | 4 nhân vật, 5 tính cách, 6 màu giao diện (thẻ thông báo đổi màu theo), 3 kiểu bé cầm thẻ, tiếng Việt và tiếng Anh. |

---

## 2. Cài đặt trong 5 phút (macOS)

1. **Cài app:** mở `Cute Pet Companion-3.5.5-universal.dmg` (chạy được trên cả máy chip Apple lẫn Intel) rồi kéo app vào **Applications**. Nếu đang có bản cũ thì thoát bé trước (chuột phải → ⏻ Thoát), nếu không macOS sẽ báo *"item is in use"*. Lần đầu mở, macOS báo *"Apple could not verify…"*: bấm **Done** → **Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Open Anyway** (hoặc chạy `xattr -dr com.apple.quarantine "/Applications/Cute Pet Companion.app"`).
2. **Cho bé thay thông báo của máy:** vào Control Center → **🔌 Kết nối** → thẻ **🍎 Thay thế thông báo của máy Mac**:
   - **Bước 1:** bấm **Mở Cài đặt**, rồi bật **Cute Pet Companion** trong *Quyền riêng tư & Bảo mật → Trợ năng*.
   - **Bước 2 (tùy chọn):** bấm **🤫 Bật** để tắt hẳn banner gốc của macOS. Muốn trả lại thì bấm **↺ Hoàn tác**.
3. **Kết nối Gmail, Jira, Bitbucket… (tùy chọn):** cũng trong **🔌 Kết nối**:
   - Dán khóa **Composio**, lấy ở *dashboard.composio.dev → Connect → Sessions & API Key*. Khóa dạng `ck_…`, hoặc khóa dự án `ak_…`.
   - Tìm app → **＋ Kết nối** → đăng nhập trên trình duyệt → quay lại app.
4. **Chọn cách bé báo tin chat:** vào **🔔 Thông báo → 💬 Tin nhắn**.
5. **Chỉ cho bé ai là ai (tùy chọn):** **🐱 Thú cưng → 👥 Người quen**. Muốn thấy **đủ danh sách chat Teams**, bấm **Kết nối** ở đó và đăng nhập tài khoản công ty (Microsoft Graph, chỉ đọc tên chat). Zalo, Messenger, Telegram, iMessage không có API danh sách chat cho tài khoản cá nhân — bé tự nhớ tên từ thông báo, hoặc bạn tự nhập.

Hướng dẫn chi tiết, kể cả Windows: **[docs/INSTALL.md](docs/INSTALL.md)** · Build & chia sẻ file cài đặt: **[docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)**

---

## 3. Bản đồ Control Center

Mở bằng icon 🐾 trên thanh menu, nhấp đúp vào bé, hoặc chuột phải vào bé.

| Tab | Có gì |
|---|---|
| 🏠 **Trang chủ** | Bé đang làm gì, trạng thái thay thông báo, cách bé xuất hiện, tin gần đây, Hộp thư |
| 🐱 **Thú cưng** | Chọn nhân vật, tính cách, 👥 **Người quen** (ứng dụng → cuộc chat → quan hệ, Hay nhắn nhất, giờ theo quan hệ, bộ nhớ), 🎭 bé đọc cảm xúc (có ô **gõ thử**), âm thanh, 🗣️ bé nói chuyện |
| 🔔 **Thông báo** | 🎨 Hiển thị · 💬 Tin nhắn (báo tất cả / chỉ tin 1-1 & nhắc tên) · 🎯 Tập trung (chế độ, không làm phiền, 💆 nhắc nghỉ mắt) · ⭐ Ưu tiên |
| 📥 **Hộp thư** | Các tin bị giữ lại; nút **👥 Xếp nhóm** để chỉ cho bé người gửi là ai |
| 🔌 **Kết nối** | Thay thông báo của Mac, ứng dụng của tôi, thêm ứng dụng mới |
| ⚙️ **Cài đặt** | Màu giao diện, ngôn ngữ, 🙈 nội dung trên thẻ, quyền riêng tư, chế độ nâng cao |
| 📊 **Theo dõi** | *(bật trong Cài đặt → Nâng cao)* thống kê, độ trễ, thông số kỹ thuật, quy tắc cảm xúc, công cụ thử |

**Menu chuột phải vào bé:** mở Control Center, Hộp thư, 🌙 Không làm phiền, 🙈 Ẩn nội dung thông báo, ẩn bé, ⏻ Thoát.

**Menu chuột phải vào thẻ tin nhắn:** 🐾 Xếp nhóm nhanh — "👤 *người gửi* là…" / "👥 Cả nhóm *tên nhóm* là…".

---

## 4. Thông báo tới nhanh cỡ nào?

| Nguồn | Cách nhận | Độ trễ |
|---|---|---|
| Thông báo của máy Mac (đã cấp quyền Trợ năng) | Bắt banner ngay khi xuất hiện | gần như tức thì |
| Thông báo của máy Mac (chưa cấp quyền, hoặc đang bật Focus của macOS) | Đọc kho thông báo của macOS | khoảng 5 giây |
| Slack (kết nối trực tiếp) | Socket Mode của Slack | tức thì |
| Gmail / Jira / Bitbucket / Outlook / GitHub qua Composio Connect | Kiểm tra định kỳ (nhớ "đã thấy" qua các lần khởi động lại) | 1–15 phút, mặc định **2 phút** |
| Webhook / script của bạn | `POST http://127.0.0.1:3721/notify` | tức thì |

App luôn ghi đúng cách nhận tin: kiểm tra định kỳ thì gọi là kiểm tra định kỳ, không bao giờ gọi là "realtime".

---

## 5. Riêng tư & bảo mật

- **Xử lý trên máy:** cảm xúc, bộ lọc chat và giọng đọc đều chạy ngay trên máy. Nội dung thông báo không được gửi đi đâu thêm.
- **Ẩn nội dung thật sự:** khi bật 🙈, nội dung bị cắt **trước khi** tới thẻ, Hộp thư, lịch sử hay log. Thẻ đã ẩn nội dung thì không có nút Approve.
- **Khóa và token:** được mã hóa bằng **Keychain** (macOS) hoặc **DPAPI** (Windows), và không bao giờ gửi ngược về giao diện.
- **Không mở cổng ra Internet:** máy chủ nội bộ chỉ nghe ở `127.0.0.1`, và mỗi lần khởi động dùng một token ngẫu nhiên.
- **Người quen:** bé chỉ lưu **tên** người gửi / tên nhóm và số lượng tin trên máy này — không lưu nội dung, không học khi nội dung đang bị ẩn, không bao giờ tự gán quan hệ. Danh sách chat Teams chỉ đọc tên chat và thành viên (Microsoft Graph). Tắt hoặc xóa trong 👥 Người quen.
- **Lưu ý về Composio:** khi dùng Composio, dữ liệu của app bạn kết nối (Gmail, Jira…) đi qua máy chủ của Composio.

---

## 6. Xử lý sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Vẫn thấy *"Còn 1 bước"* dù đã bật Trợ năng | Trong *Trợ năng*: chọn **Cute Pet Companion** (và **nc-bridge** nếu có) → bấm **–** → quay lại app bấm **Mở Cài đặt** → bật lại. Bé tự nhận ra trong vài giây. |
| Banner gốc vẫn hiện | Bật bước 2 *"Không bao giờ thấy banner gốc"*. Một vài app đang mở (Chrome, Tin nhắn) có thể cần tắt tay trong *Cài đặt → Thông báo*. |
| *"Khóa Composio không hợp lệ"* | Dùng khóa `ck_…` (mục Connect) hoặc khóa dự án `ak_…`. Khóa người dùng `uak_…` không dùng được. |
| Không thấy thông báo Jira/Bitbucket | Đợi tối đa 2 phút, hoặc bấm **🔔 Kiểm tra ngay** trong 🔌 Kết nối. Lỗi gần nhất (nếu có) hiện ở đầu trang Kết nối. Bé báo: việc mới giao / đổi trạng thái / bình luận / @nhắc tên (Jira), PR chờ review và hoạt động trên PR của bạn (Bitbucket). Chuông trên web Atlassian là trung tâm thông báo chung không có API công khai, nên không phải mục nào trên đó cũng có thẻ. |
| 👥 Người quen chỉ có vài chat | Với Teams, bấm **Kết nối** trong 👥 Người quen (lần đầu tải 1–2 phút). Các app khác: danh sách đầy dần khi có tin nhắn mới, hoặc dùng ✏️ Tự nhập tên. |
| *"Bạn đang dùng bản cho Mac Intel trên máy chip Apple"* | Thoát bé, xóa app trong Applications, cài lại từ file `-universal.dmg`. |
| Bé im lặng | Kiểm tra 🌙 Không làm phiền, chế độ tập trung, và 🐱 Thú cưng → âm thanh / 🗣️ Bé nói chuyện. |
| Muốn tắt app | Chuột phải vào bé → **⏻ Thoát**, hoặc bấm ⌘Q khi đang mở Control Center. |

Danh sách đầy đủ các hạn chế: **[docs/reports/KNOWN_LIMITATIONS.md](docs/reports/KNOWN_LIMITATIONS.md)**

---

## 7. Dành cho lập trình viên

```bash
npm install
npm start            # build overlay + control center bundle rồi mở Electron
npm test             # 119 test (Node ≥ 20): engine, pipeline, privacy, chat, người quen, mood, Composio, gateway, adapters,
                     # + khung hình 3D thật (test/pet-stage-frame) + overlay thật trong Electron (test/overlay.e2e) — ~1,5 phút
npm run pack:mac     # app đã ký (arm64) trong dist/mac-arm64
npm run dist:mac     # DMG arm64 + x64, ký bằng chứng chỉ cục bộ cố định
# DMG universal (một file cho mọi Mac) — cần Node ≥ 20:
npx electron-builder --mac dir --universal -c.mac.x64ArchFiles="Contents/Resources/nc-bridge" \
  && sh scripts/sign-mac.sh "dist/mac-universal/Cute Pet Companion.app" \
  && npx electron-builder --mac dmg --universal --prepackaged "dist/mac-universal/Cute Pet Companion.app"
npx electron-builder --win nsis --x64   # file .exe cho Windows (build được trên máy Mac)
npm run gateway      # (tùy chọn) Integration Gateway HTTPS cho webhook Composio/Slack — xem gateway/README.md
```

**Chống lỗi tái diễn (bắt buộc trước mọi bản cài):** `npm run dist`, `dist:mac`, `dist:win`, `pack:mac` đều chạy `npm test` trước — **còn một test đỏ là không build được bản cài.** Đừng gọi thẳng `electron-builder` để phát hành.
- `test/overlay.e2e.test.js` mở overlay thật (renderer + preload) trong cửa sổ Electron ẩn và kiểm: pet nằm đúng chỗ đã lưu với mọi chế độ thẻ (Billboard/Peeker/Courier), hai phía màn hình, size nhỏ/lớn, kể cả khi thẻ mới thay thẻ cũ giữa hoạt ảnh; thẻ sát thân pet; kéo thả (chậm, nhanh, rất nhanh, lắc) lưu đúng điểm thả; badge nằm cạnh đầu chứ không đè lên; bấm nút trên thẻ không mở Control Center còn chạm đôi vào pet thì có; không có lỗi script.
- `test/pet-stage-frame.test.mjs` chạy khung hình 3D thật cho mọi pet / cảm xúc / hành động / kéo thả — lỗi trong `update()` (pet tàng hình) sẽ làm test đỏ.
- Mỗi lỗi giao diện mới: **viết thêm một kiểm tra vào harness (`test/fixtures/overlay-harness.js`) tái hiện lỗi trước, thấy nó đỏ, rồi mới sửa.**
- Muốn xem bằng mắt: `SNAP_DIR=/tmp/snaps npm test` lưu ảnh chụp overlay của từng trường hợp.

**Ký app:** `scripts/sign-mac.sh` ký app và trợ lý `nc-bridge` bằng chứng chỉ tự ký nằm trong `build/signing/` (không đưa lên git). Nhờ đó macOS giữ quyền Trợ năng qua các lần cập nhật. Nếu chưa có chứng chỉ thì app được build nhưng không ký.

**Gửi thử một thông báo:**
```bash
curl -X POST http://127.0.0.1:3721/notify -H "Content-Type: application/json" \
  -d '{"title":"Build xong!","message":"CI passed 🎉","app":"github","priority":"important"}'
```
Các trường: `title`, `message`, `app`, `url` (https), `priority` (`critical`/`important`/`normal`/`low`), `mood`, `event`, `presentationMode`, `duration`, `forceEmotion`, `sourceEventId`.

**Cấu trúc thư mục**
```
src/
├── main/          Electron: cửa sổ, khay, IPC, bắt chuột cho overlay · server.js (webhook + API + SSE) ·
│                  messaging-apps (app nhắn tin đã cài / đang chạy)
├── core/          notification-pipeline · emotion-engine · mood-reader · chat-filter · privacy ·
│                  attention-engine · contact-rules (người > nhóm > quan hệ) · contact-directory (danh bạ tự học) ·
│                  break-reminder · inbox-store · settings-store · secret-store · latency
├── adapters/      macOS Notification Center (+ nc-bridge, ncprefs) · Windows · Slack · GitHub · Calendar · Gateway · system/webhook
├── integrations/  Composio Connect (MCP, ck_) · Composio REST (ak_) · bộ chọn provider ·
│                  chat-sources (danh sách chat Teams qua Graph, Slack Web API)
├── renderer/      overlay: thú cưng 3D (Three.js, AnimationController), thẻ thông báo, giọng nói, âm thanh
├── control/       Control Center (HTML/CSS/JS, i18n VI/EN)
└── shared/        emotion-constants
native/macos/      nc-bridge.swift (Accessibility helper)   gateway/   Integration Gateway (tùy chọn)
scripts/           build-native · sign-mac · dist-mac         test/      node --test
```

**Tài liệu:** [Cài đặt](docs/INSTALL.md) · [Phát hành & chia sẻ](docs/DISTRIBUTION.md) · [Blueprint](docs/BLUEPRINT.md) · [Đặc tả UI/UX](docs/UI_UX_SPEC.md) · [Hướng dẫn animation & realtime](docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md) · [Blender](docs/BLENDER_GUIDE.md) · [Trạng thái tính năng](docs/reports/IMPLEMENTATION_STATUS.md) · [Kết quả kiểm thử](docs/reports/TEST_RESULTS.md) · [Bảo mật & riêng tư](docs/reports/SECURITY_AND_PRIVACY_REPORT.md) · [Jira](docs/reports/JIRA_INTEGRATION_REPORT.md) · [Bitbucket](docs/reports/BITBUCKET_PR_WORKFLOW_REPORT.md) · [Privacy mode](docs/reports/NOTIFICATION_PRIVACY_REPORT.md) · [Composio](docs/reports/COMPOSIO_INTEGRATION_REPORT.md) · [Người quen](docs/reports/FAMILIAR_CONTACTS_REPORT.md)
