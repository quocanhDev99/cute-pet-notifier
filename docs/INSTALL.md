# 📦 Hướng dẫn cài đặt Cute Pet Companion (macOS & Windows)

*Phiên bản 3.2.0 · Cập nhật 03/11/2026*

## 0. Thú cưng có thay thế được thông báo mặc định không?

| | macOS 14 (Sonoma) trở xuống | macOS 15+ (Sequoia) | Windows 10/11 |
|---|---|---|---|
| Thú cưng mang thông báo của **mọi app** (Zalo, Teams, Messenger, Mail, Slack…) | ✅ Tự động sau khi cài | ⚠️ Cần cấp quyền *Full Disk Access* (mục 2.3) | ❌ Chưa hỗ trợ (mục 3.3) |
| Banner gốc của hệ thống biến mất | ⚠️ Bạn tự tắt từng app (mục 2.2). Hệ điều hành không cho app khác làm việc này | ⚠️ Như bên trái | ❌ |
| Bấm thẻ → mở đúng cuộc chat | ✅ Teams. Slack khi app gửi kèm thông tin kênh. Link mà app đính kèm. Các app còn lại → mở app | ✅ như bên trái | — |
| Độ trễ so với banner gốc | khoảng 5–9 giây (macOS ghi kho thông báo chậm khoảng 5 giây) | như bên trái | — |
| Webhook, sự kiện hệ thống, GitHub, Lịch iCal, Slack, Gateway | ✅ | ✅ | ✅ |

> Cách thay thế trên macOS là đọc (chỉ đọc) kho thông báo mà macOS lưu sẵn trên máy bạn, và **không phải API công khai của Apple**. Vì vậy tính năng có thể ngừng hoạt động sau khi nâng cấp macOS. Khi đó, adapter sẽ báo lỗi trong Control Center thay vì im lặng.

---

## 1. Tệp cài đặt
Tạo bằng `npm run dist:mac` / `npm run dist:win`, nằm trong thư mục `dist/`:

| Hệ điều hành | Tệp |
|---|---|
| macOS chip Apple (M1/M2/M3…) | `Cute Pet Companion-3.2.0-arm64.dmg` |
| macOS chip Intel | `Cute Pet Companion-3.2.0.dmg` |
| Windows 10/11 (64-bit) | `Cute Pet Companion Setup 3.2.0.exe` |

Các bản cài **chưa được ký số** (chưa có chứng chỉ Apple Developer / Windows code signing), nên lần mở đầu tiên hệ điều hành sẽ cảnh báo. Xem cách mở bên dưới.

---

## 2. macOS

### 2.1 Cài đặt
1. Mở tệp `.dmg`, kéo **Cute Pet Companion** vào thư mục **Applications**.
2. Mở app lần đầu: vào Applications, **chuột phải** vào app → **Mở** → **Mở**.
   - Nếu macOS báo *"không thể mở vì không xác minh được nhà phát triển"*: vào **Cài đặt Hệ thống → Quyền riêng tư & Bảo mật**, kéo xuống, bấm **Vẫn mở**.
   - Nếu báo *"app bị hỏng"* (do tệp tải từ Internet): chạy `xattr -dr com.apple.quarantine "/Applications/Cute Pet Companion.app"`.
3. Thú cưng xuất hiện ở góc màn hình và **Control Center** tự mở trong lần chạy đầu.

### 2.2 Để thú cưng THAY THẾ banner của macOS
1. Control Center → **Kết nối ứng dụng** → thẻ **macOS Notification Center** phải hiện **Đã kết nối**. Nếu chưa, bấm **Lưu & kết nối**.
2. Bấm **⚙️ Mở Cài đặt Thông báo của macOS**, rồi với **từng app** bạn muốn thú cưng thay thế (Zalo, Microsoft Teams, Messenger, Mail, Slack, Lịch…):
   - **Kiểu thông báo → Không có**: banner gốc sẽ không bật lên nữa.
   - **Vẫn BẬT "Hiển thị trong Trung tâm thông báo"**: bắt buộc. Nếu tắt mục này, macOS không lưu thông báo và thú cưng không thấy được.
3. Gửi thử cho chính bạn một tin trên Zalo/Teams. Sau vài giây, thú cưng sẽ mang thẻ tới.

### 2.3 macOS 15 Sequoia trở lên
macOS 15 khóa kho thông báo. Để cấp quyền: **Cài đặt Hệ thống → Quyền riêng tư & Bảo mật → Truy cập toàn bộ ổ đĩa** → bật **Cute Pet Companion**. Trong app có sẵn nút **🔐 Mở cài đặt Full Disk Access**. Cấp xong thì bấm **Lưu & kết nối** lại.

### 2.4 Tự khởi động & tắt app
- **Tự khởi động:** Control Center → Quyền riêng tư & Cài đặt → **Tự khởi động cùng hệ thống**.
- **Tắt app:** **chuột phải vào thú cưng → ⏻ Thoát**, hoặc nút **⏻ Thoát ứng dụng** trong Control Center, hoặc **Cmd+Q** khi đang mở Control Center. Trên MacBook có notch, icon 🐾 trên thanh menu có thể bị che khi thanh menu nhiều icon.

### 2.5 Gỡ cài đặt
1. Thoát app, kéo `Cute Pet Companion.app` vào Thùng rác.
2. Xóa dữ liệu (tùy chọn): `~/Library/Application Support/Cute Pet Companion`. Các token đã lưu nằm trong Keychain dưới tên "Cute Pet Companion Safe Storage".
3. Nhớ bật lại **Kiểu thông báo** cho các app đã đặt "Không có" ở mục 2.2.

---

## 3. Windows 10/11

### 3.1 Cài đặt
1. Chạy `Cute Pet Companion Setup 3.2.0.exe`. Đây là bản cài 1-click, cài cho tài khoản hiện tại, không cần quyền Admin.
2. Nếu SmartScreen chặn: **Thông tin thêm → Vẫn chạy**.
3. Thú cưng xuất hiện ở góc màn hình. Icon 🐾 nằm ở khay hệ thống (góc phải thanh Taskbar, có thể nằm trong mũi tên ^).

### 3.2 Dùng được gì trên Windows
Thú cưng 3D, 8 cảm xúc, kéo thả, Control Center, Webhook nội bộ, sự kiện hệ thống (pin, sạc, mở khóa), GitHub, Lịch iCal, Slack (Socket Mode) và Cloud Gateway (Composio / Slack Events).

### 3.3 Chưa làm được: thay thế thông báo mặc định của Windows
Windows chỉ cho đọc thông báo của app khác qua API `UserNotificationListener`. API này yêu cầu app được **đóng gói MSIX** và người dùng cấp quyền "Truy cập thông báo". Bản `.exe` hiện tại chưa phải MSIX, nên **chưa thay thế được** thông báo Windows. Adapter "Windows Toast Listener" trong Control Center hiện trạng thái *Không hỗ trợ* kèm lý do.

### 3.4 Gỡ cài đặt
**Cài đặt → Ứng dụng → Cute Pet Companion → Gỡ cài đặt.** Dữ liệu nằm ở `%APPDATA%\Cute Pet Companion`.

---

## 4. Tự build từ mã nguồn
```bash
npm install
npm start               # chạy bản phát triển
npm run dist:mac        # → dist/*.dmg (arm64 + x64 nếu thêm --x64)
npm run dist:win        # → dist/*Setup*.exe (build trên macOS sẽ tự tải wine)
```
Lưu ý khi chạy bằng `npm start` trên macOS 15+: quyền *Full Disk Access* phải cấp cho **Terminal** (hoặc VS Code), không phải cho app.
