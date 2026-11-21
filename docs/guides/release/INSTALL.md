# 📦 Hướng dẫn cài đặt & Cơ chế thay thế thông báo (macOS & Windows)

*Phiên bản 3.4.2 · Cập nhật 04/11/2026*

## 0. Cơ chế thay thế thông báo hệ thống của Cute Pet Companion

| Tính năng | macOS (Apple Silicon / Intel) | Windows 10/11 (64-bit) |
|---|---|---|
| **Bắt thông báo của MỌI ứng dụng** (Zalo, Teams, Messenger, Outlook, Mail, Slack…) | ✅ **Hoàn toàn tự động** qua Native Accessibility Interceptor & Notification Center store | ✅ **Hoàn toàn tự động** qua WinRT `UserNotificationListener` |
| **Tự động đóng banner / toast gốc** (tránh hiện 2 lần) | ✅ **Tự động đóng ngay lập tức** khi cấp quyền Trợ năng (Accessibility) | ✅ **Tắt banner + âm thanh gốc** của mọi app (sao lưu & tự bật lại khi tắt tính năng / thoát app), rồi xóa toast khỏi Trung tâm thông báo |
| **Thời gian phản hồi** | ⚡ **Tức thì (< 50ms)** qua AXObserver | ⚡ **Tức thì (< 250ms)** qua WinRT Listener |
| **Quyền hệ thống cần cấp** | Cấp quyền **Trợ năng (Accessibility)** (có sẵn nút 1-click trong Control Center) | Cấp quyền **Truy cập Thông báo** (Notifications access) trong Windows Settings |
| **Dự phòng (Fallback)** | 🗄️ Tự động chuyển sang SQLite Database Watcher nếu chưa có quyền Accessibility | 🔄 Tự động tái kích hoạt và cảnh báo rõ ràng trong Control Center |
| **Bấm thẻ → Mở ứng dụng / Deep link** | ✅ Hỗ trợ deep link tới cuộc chat (Teams, Slack) hoặc kích hoạt ứng dụng gốc | ✅ Kích hoạt ứng dụng gốc |

---

## 1. Tệp cài đặt
Tạo bằng `npm run dist:mac` (macOS, đã ký) và `npx electron-builder --win nsis --x64` (Windows), nằm trong thư mục `dist/`. Cách build, kiểm tra và chia sẻ: [DISTRIBUTION.md](DISTRIBUTION.md).

| Hệ điều hành | Tệp |
|---|---|
| macOS chip Apple (M1/M2/M3/M4) | `Cute Pet Companion-3.4.2-arm64.dmg` |
| macOS chip Intel | `Cute Pet Companion-3.4.2-x64.dmg` |
| Windows 10/11 (64-bit) | `Cute Pet Companion Setup 3.5.5.exe` |

> **Không biết máy mình chip gì?** Bấm menu  → *Giới thiệu về máy Mac này*. Dòng *Chip* ghi "Apple M…" thì dùng file `-arm64`. Dòng *Bộ xử lý* ghi "Intel" thì dùng file `-x64`.
> Nếu cài **nhầm bản Intel trên máy chip Apple**, macOS phải dịch app qua Rosetta nên hoạt họa rất chậm, giật (đo được có lúc khựng 2–5 giây). App sẽ hiện cảnh báo khi mở; hãy cài lại đúng file `-arm64`.

Bản macOS được ký bằng **chứng chỉ tự ký cố định**, nên quyền Trợ năng giữ nguyên qua các bản cập nhật. Tuy vậy app **chưa được Apple notarize**, và bản Windows chưa có chứng chỉ ký code, nên lần mở đầu tiên hệ điều hành sẽ cảnh báo. Xem cách mở bên dưới. Bản Windows đã chạy thử trên Windows 11 (04/11/2026).

---

## 2. macOS

### 2.1 Cài đặt
1. Mở tệp `.dmg`, kéo **Cute Pet Companion** vào thư mục **Applications**.
2. **Mở app lần đầu.** macOS sẽ báo *"Apple could not verify… / Không thể mở"*, vì app chưa được Apple notarize. App không bị hỏng. Bấm **Done** (đừng bấm *Move to Trash*), rồi chọn **một** trong hai cách:
   - **Cách A, không cần gõ lệnh:** vào **Cài đặt hệ thống → Quyền riêng tư & Bảo mật**, kéo xuống phần *Bảo mật*, thấy dòng *"Cute Pet Companion" was blocked…* thì bấm **Open Anyway / Vẫn mở** và nhập mật khẩu máy. Mở lại app rồi bấm **Open**.
   - **Cách B, một lệnh trong Terminal:** `xattr -dr com.apple.quarantine "/Applications/Cute Pet Companion.app"`, sau đó mở app bình thường.
   - Trên macOS 14 trở về trước, cách **chuột phải vào app → Mở → Mở** vẫn dùng được. Từ macOS 15 (Sequoia), hộp thoại không còn nút *Mở*, nên phải dùng Cách A hoặc B.
   - Việc này chỉ cần làm **một lần**.
3. Thú cưng xuất hiện ở góc màn hình và **Control Center** tự mở trong lần chạy đầu.

### 2.2 Thay thế thông báo của máy (2 bước)
Control Center → **🔌 Kết nối** → thẻ **🍎 Thay thế thông báo của máy Mac** (công tắc đầu thẻ phải ở **Đang bật**):

1. **Cho phép thú cưng đọc thông báo** → bấm **Mở Cài đặt**, bật *Cute Pet Companion* trong *Quyền riêng tư & Bảo mật → Trợ năng*. Nếu thẻ báo *"bật thêm trợ lý nc-bridge"*: bấm **📂 Mở Cài đặt + chỉ file**, kéo file `nc-bridge` (Finder vừa mở) vào danh sách Trợ năng rồi bật công tắc của nó. Lý do: macOS cấp quyền riêng cho tiến trình phụ đọc và ẩn banner. Xong bước này thông báo tới gần như tức thì và banner gốc bị ẩn ngay khi vừa xuất hiện; bấm thẻ sẽ mở đúng cuộc trò chuyện.
2. *(Tùy chọn)* **Không bao giờ thấy banner gốc** → bấm **🤫 Bật**. Banner của macOS bị tắt cho mọi app (cài đặt gốc được sao lưu, bấm **↺ Hoàn tác** để trả lại). Một số app đang mở (Chrome, Brave, Tin nhắn) có thể tự bật lại — khi đó tắt thủ công trong *Cài đặt → Thông báo*.

Lưu ý: khi đang bật **Focus / Không làm phiền** của macOS, macOS không hiện banner nên app chuyển sang đọc kho thông báo (trễ khoảng 5 giây).

### 2.2b Thêm ứng dụng khác (Gmail, Notion, Jira, Teams… — tùy chọn)
Control Center → **🔌 Kết nối → ➕ Thêm ứng dụng**:
- GitHub, Lịch (iCal), Slack, Pin & hệ thống: bấm **＋ Thêm**, làm theo 1–2 bước trong hộp thoại.
- Hơn 1000 ứng dụng khác qua **Composio**: tạo tài khoản miễn phí tại composio.dev, lấy *API key*, dán vào ô **Dán khóa vào đây**. Sau đó tìm ứng dụng → **＋ Kết nối** → đăng nhập trên trình duyệt → quay lại bấm **🔔 Chọn sự kiện**. Khóa được mã hóa bằng Keychain của máy.
- Để sự kiện từ Composio tới máy, cần một **Gateway** HTTPS (thư mục `gateway/`, xem `gateway/README.md`) và đặt URL webhook của project Composio trỏ tới `https://<gateway>/webhooks/composio`. Cấu hình Gateway nằm ở **⚙️ Cài đặt → Nâng cao → Hiện tab "Theo dõi"** → **📊 Theo dõi → Kết nối (kỹ thuật)**.

### 2.3 macOS 15 Sequoia trở lên
macOS 15 bổ sung khóa kho thông báo SQLite. Nếu bạn muốn kích hoạt cả cơ chế dự phòng lịch sử SQLite:
- Vào **Cài đặt Hệ thống → Quyền riêng tư & Bảo mật → Truy cập toàn bộ ổ đĩa (Full Disk Access)** → Bật **Cute Pet Companion**. Có sẵn nút bấm nhanh trong Control Center.

---

## 3. Windows 10/11

### 3.1 Cài đặt
1. Chạy `Cute Pet Companion Setup 3.5.5.exe`. Bản cài 1-click cho tài khoản hiện tại, **không cần quyền Administrator**.
2. Windows SmartScreen hiện cảnh báo màu xanh (app chưa có chứng chỉ ký code): bấm **More info / Thông tin thêm** → **Run anyway / Vẫn chạy**. Chỉ một lần.
3. Thú cưng xuất hiện ở góc màn hình, icon 🐾 nằm ở khay hệ thống (góc dưới bên phải). Control Center tự mở lần đầu.

### 3.2 Thay thế thông báo của Windows và các ứng dụng
Tính năng **bật sẵn**. Mở Control Center → **🔌 Kết nối** → thẻ **🪟 Thay thế thông báo của Windows** và xem dòng trạng thái:

| Thẻ hiện | Nghĩa là | Cần làm |
|---|---|---|
| ✓ *Đã xong — bé đang đọc thông báo* | Đang hoạt động | Không cần làm gì |
| *Windows chưa cho phép đọc thông báo…* | Chưa có quyền | Bấm **Mở Cài đặt quyền** → bật **Truy cập thông báo** (*Notification access*). Bé tự nhận ra sau vài giây, không cần mở lại app |
| *Trình đọc thông báo đã dừng / không phản hồi* | PowerShell bị chặn (chính sách công ty, phần mềm diệt virus) | Cho phép `powershell.exe` chạy, hoặc gửi file log (nút **📄 Mở thư mục log**) cho người hỗ trợ |

Kiểm tra thêm trong **Cài đặt → Hệ thống → Thông báo**:
- **Thông báo** đang bật, và mỗi ứng dụng muốn bé báo (Zalo, Teams, Outlook…) đang **bật thông báo**.
- Ứng dụng đó **được hiện trong trung tâm thông báo** (*Show notifications in notification center*). Bé đọc thông báo từ đây; tắt mục này thì bé không thấy.

Khi đang hoạt động, app tự tắt **banner** và **âm thanh** thông báo gốc của Windows cho mọi ứng dụng, chỉ còn thẻ và tiếng của thú cưng. Thông báo vẫn vào Trung tâm thông báo để bé đọc, rồi được gỡ khỏi đó để không trùng.
- Giá trị gốc được sao lưu (`%APPDATA%\Cute Pet Companion\windows-banners.json`) và **tự bật lại** khi bạn tắt công tắc của thẻ hoặc thoát app.
- **Trước khi gỡ cài đặt app**, hãy tắt công tắc của thẻ (hoặc thoát app) để banner và âm thanh của Windows được trả lại.
- Ứng dụng gửi thông báo **lần đầu tiên** có thể hiện banner gốc một lần; từ lần sau thì không.
- Bấm **Mở app** trên thẻ đưa đúng ứng dụng lên trên cùng, nhưng không mở được đúng cuộc chat (Windows không cho phép).

### 3.3 Bé không hiện thông báo nào? (nhất là Windows 10)
Thẻ 🪟 có mục **🩺 Kiểm tra nhanh**. Bấm **🧪 Gửi thông báo thử của Windows** rồi xem:

| Kết quả | Nguyên nhân | Cách sửa |
|---|---|---|
| Bé hiện thẻ "Cute Pet - test" | Bé đọc được thông báo Windows | Nếu riêng **Zalo** không hiện: xem dòng dưới |
| Thông báo thử hiện, nhưng Zalo không | Zalo đang dùng **cửa sổ thông báo riêng**, không qua Windows | Sau khi có tin Zalo, mở Trung tâm thông báo (**Win + A** trên Windows 10, **Win + N** trên Windows 11). Không thấy tin Zalo ở đó → bật thông báo của Windows trong Zalo và trong **Cài đặt → Hệ thống → Thông báo → Zalo** (bật cả *Hiện trong trung tâm thông báo*) |
| "Quyền đọc thông báo" ≠ ✅ | Windows chưa cho phép | **Windows 10:** Cài đặt → **Quyền riêng tư** → **Thông báo** → bật *Cho phép truy cập thông báo trên thiết bị này* và *Cho phép ứng dụng truy cập thông báo*. **Windows 11:** Cài đặt → Quyền riêng tư & bảo mật → Thông báo → *Truy cập thông báo* |
| Quyền ✅ nhưng "Trung tâm thông báo đang giữ" luôn là 0 và thông báo thử không hiện | Windows trả về danh sách rỗng (quyền bị thu hồi, hoặc Trung tâm thông báo bị tắt bằng chính sách) | Tắt rồi bật lại quyền ở trên; kiểm tra **Cài đặt → Hệ thống → Thông báo** đang bật |
| "Trình đọc thông báo đã dừng / không phản hồi" | PowerShell bị chính sách công ty hoặc phần mềm diệt virus chặn | Cho phép `powershell.exe`, hoặc gửi file `main.log` (nút **📄 Mở thư mục log**) cho người hỗ trợ |

---

## 5. Cài đặt nhanh sau khi cài app (5 phút)
| Việc | Ở đâu | Ghi chú |
|---|---|---|
| Thay thông báo của Mac | 🔌 Kết nối → 🍎 Thay thế thông báo | Bật *Cute Pet Companion* trong Trợ năng (thẻ sẽ chỉ thêm trợ lý *nc-bridge* nếu macOS yêu cầu) |
| Gmail, Jira, Bitbucket, Outlook, GitHub… | 🔌 Kết nối → Dán khóa Composio (`ck_…` từ Connect, hoặc `ak_…` của Project) → ＋ Kết nối | Kiểm tra mỗi 2 phút (đổi được: 1/2/5/15 phút) |
| Thẻ thông báo to / nhỏ hơn | 🔔 Thông báo → 🎨 Hiển thị → *📐 Kích thước khung thông báo* | Kéo từ ×0.80 tới ×1.50 |
| Chỉ báo chat khi nhắn riêng 1-1 hoặc nhắc tên | 🔔 Thông báo → 💬 Tin nhắn → *Chỉ tin dành cho tôi* | Điền tên của bạn (tên 1 chữ cần @, vd `@Mai`). Tin 1-1 tự được báo |
| Bé đọc cảm xúc tin nhắn | 🐱 Thú cưng → 🎭 Bé đọc cảm xúc | Có ô "Gõ thử một tin nhắn" |
| Ẩn nội dung khi chia sẻ màn hình | ⚙️ Cài đặt → 🙈 Nội dung trên thẻ, hoặc chuột phải vào bé | 4 mức: đầy đủ / che bớt / chỉ tên app / ẩn hoàn toàn |
| Nhắc nghỉ mắt | 🔔 Thông báo → 🎯 Tập trung → 💆 Nhắc nghỉ mắt | Mặc định 60 phút dùng máy thật; bé nói lời nhắc |
| Bé nói chuyện | 🐱 Thú cưng → 🎵 Âm thanh → 🗣️ Bé nói chuyện | Giọng hệ thống (vi: Linh, en: Samantha); không đọc nội dung thông báo |
| Màu giao diện (thẻ đổi theo) | ⚙️ Cài đặt → 🎨 Màu giao diện | 6 màu, có Đêm (tối) |

### Về chữ ký của app và quyền Trợ năng
Từ bản 3.4.0, app và trợ lý `nc-bridge` được ký bằng **một chứng chỉ cục bộ cố định**. Vì vậy quyền Trợ năng **giữ nguyên qua các lần cập nhật**. Lần đầu chuyển từ bản cũ (chưa ký) sang bản đã ký, bạn cần cấp quyền lại **một lần cuối**: trong *Trợ năng*, xóa (**–**) các mục *Cute Pet Companion* và *nc-bridge* cũ, rồi bấm **Mở Cài đặt** trong app và bật lại.

### Jira & Bitbucket hoạt động thế nào
- **Bitbucket:** PR **đang mở mà bạn là reviewer và chưa approve** (25 repo cập nhật gần nhất). Khi mở app: 1 thẻ liệt kê các PR đang chờ, mỗi PR có **↗ Mở** và **✅ Approve** (bấm là approve, chỉ hiện "Đã approve" sau khi Bitbucket xác nhận). PR mới gửi tới bạn → 1 thẻ riêng.
- **Jira:** việc **mới giao cho bạn** (ghi "Giao bởi" từ lịch sử thay đổi của Jira; nếu Jira không ghi lại thì ghi "không có thông tin", không suy đoán từ người tạo) và việc **đổi trạng thái**. Sửa nhỏ không báo.
- Cả hai là **kiểm tra định kỳ** qua Composio Connect (không phải tức thì). Lỗi gần nhất (nếu có) hiện ở 🔌 Kết nối.

## 4. Kiểm thử nhanh
1. Mở Control Center (chuột phải vào thú cưng → Cài đặt, hoặc icon khay hệ thống).
2. Ở **🏠 Trang chủ** bấm **🚀 Gửi thử 1 thông báo**, hoặc xem tin được giữ lại ở **📥 Hộp thư**.
3. Thử gửi một tin nhắn Teams, Zalo, hoặc gửi webhook thử nghiệm:
```bash
curl -X POST http://127.0.0.1:3721/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"Đồng bộ thành công!","message":"Thú cưng đã sẵn sàng thay thế thông báo hệ thống.","app":"teams"}'
```
Thú cưng sẽ bay tới, mang theo thẻ tương tác với biểu cảm sinh động!
