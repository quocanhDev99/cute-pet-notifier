# 📦 Hướng dẫn cài đặt & Cơ chế thay thế thông báo (macOS & Windows)

*Phiên bản 3.2.0 · Cập nhật 03/11/2026*

## 0. Cơ chế thay thế thông báo hệ thống của Cute Pet Companion

| Tính năng | macOS (Apple Silicon / Intel) | Windows 10/11 (64-bit) |
|---|---|---|
| **Bắt thông báo của MỌI ứng dụng** (Zalo, Teams, Messenger, Outlook, Mail, Slack…) | ✅ **Hoàn toàn tự động** qua Native Accessibility Interceptor & Notification Center store | ✅ **Hoàn toàn tự động** qua WinRT `UserNotificationListener` |
| **Tự động đóng banner / toast gốc** (tránh hiện 2 lần) | ✅ **Tự động đóng ngay lập tức** khi cấp quyền Trợ năng (Accessibility) | ✅ **Tự động xóa toast gốc** bằng `RemoveNotification(id)` |
| **Thời gian phản hồi** | ⚡ **Tức thì (< 50ms)** qua AXObserver | ⚡ **Tức thì (< 250ms)** qua WinRT Listener |
| **Quyền hệ thống cần cấp** | Cấp quyền **Trợ năng (Accessibility)** (có sẵn nút 1-click trong Control Center) | Cấp quyền **Truy cập Thông báo** (Notifications access) trong Windows Settings |
| **Dự phòng (Fallback)** | 🗄️ Tự động chuyển sang SQLite Database Watcher nếu chưa có quyền Accessibility | 🔄 Tự động tái kích hoạt và cảnh báo rõ ràng trong Control Center |
| **Bấm thẻ → Mở ứng dụng / Deep link** | ✅ Hỗ trợ deep link tới cuộc chat (Teams, Slack) hoặc kích hoạt ứng dụng gốc | ✅ Kích hoạt ứng dụng gốc |

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

### 2.2 Kích hoạt chế độ Tức thì & Tự đóng banner gốc
1. Vào Control Center → **Kết nối ứng dụng** → thẻ **macOS Notification Center**.
2. Bấm nút **🔐 Mở Cài đặt Trợ năng (Accessibility)**.
3. Trong bảng cài đặt macOS vừa hiện ra, gạt công tắc cho phép **Cute Pet Companion** (hoặc Terminal/VS Code nếu bạn chạy `npm start`).
4. **Xong!** Từ lúc này:
   - Mọi thông báo từ Zalo, Teams, Slack, Messenger... đều được thú cưng đón lấy tức thì (<50ms).
   - Banner mặc định góc phải của macOS sẽ tự động được đóng lại ngay lập tức, không gây phiền phức hay trùng lặp.

*(Lưu ý: Nếu không cấp quyền Trợ năng, app vẫn hoạt động ở chế độ đọc nền SQLite, tuy nhiên sẽ có độ trễ khoảng 5 giây do macOS ghi file đệm chậm).*

### 2.3 macOS 15 Sequoia trở lên
macOS 15 bổ sung khóa kho thông báo SQLite. Nếu bạn muốn kích hoạt cả cơ chế dự phòng lịch sử SQLite:
- Vào **Cài đặt Hệ thống → Quyền riêng tư & Bảo mật → Truy cập toàn bộ ổ đĩa (Full Disk Access)** → Bật **Cute Pet Companion**. Có sẵn nút bấm nhanh trong Control Center.

---

## 3. Windows 10/11

### 3.1 Cài đặt
1. Chạy `Cute Pet Companion Setup 3.2.0.exe`. Đây là bản cài 1-click cho tài khoản hiện tại, không yêu cầu quyền Administrator.
2. Nếu Windows SmartScreen hiện cảnh báo màu xanh: bấm **More info** (Thông tin thêm) → **Run anyway** (Vẫn chạy).
3. Thú cưng xuất hiện ở góc màn hình. Icon 🐾 nằm ở khay hệ thống (System Tray, góc dưới bên phải màn hình).

### 3.2 Kích hoạt cơ chế thay thế Toast Windows
1. Vào Control Center → **Kết nối ứng dụng** → thẻ **Windows Toast Listener**.
2. Bấm **Lưu & kết nối**.
3. Nếu Windows yêu cầu quyền:
   - App sẽ tự động nhắc bạn cấp quyền truy cập thông báo.
   - Hoặc bạn có thể bấm nút **⚙️ Mở Cài đặt Thông báo của Windows** và **🔐 Mở Cài đặt Quyền riêng tư Thông báo** ngay trên thẻ kết nối.
4. Khi đã kết nối, thú cưng sẽ nhận diện toàn bộ Toast từ Windows, tự động đóng thông báo gốc bằng lệnh `RemoveNotification` và hiển thị thẻ 3D tương tác của thú cưng.

---

## 4. Kiểm thử nhanh
1. Mở Control Center (chuột phải vào thú cưng → Cài đặt, hoặc icon khay hệ thống).
2. Chuyển sang mục **Sự chú ý & Inbox** hoặc **Kết nối ứng dụng**.
3. Thử gửi một tin nhắn Teams, Zalo, hoặc gửi webhook thử nghiệm:
```bash
curl -X POST http://127.0.0.1:3721/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"Đồng bộ thành công!","message":"Thú cưng đã sẵn sàng thay thế thông báo hệ thống.","app":"teams"}'
```
Thú cưng sẽ bay tới, mang theo thẻ tương tác với biểu cảm sinh động!
