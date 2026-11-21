# 🎨 CUTE PET COMPANION V2.0 — MASTER CONTROL CENTER UI/UX SPECIFICATION
## Bản Đặc Tả Thiết Kế & Quy Chuẩn Triển Khai Chuẩn 100% Theo Concept Render Board
*Tài liệu tham chiếu chuẩn xác: `docs/design/uiux-v2/03_Full_Concept_Board.png` / `Concept Board v2.0`*
*Mục tiêu: Đảm bảo giao diện Control Center và Thẻ Thông Báo thực tế trùng khớp 100% với bản vẽ Concept Render.*

---

## 🌟 1. TỔNG QUAN HỆ THỐNG THẨM MỸ (DESIGN SYSTEM & TOKENS)

Giao diện áp dụng phong cách **Pastel Glassmorphism kết hợp 3D Art-Toy mềm mại**, mang lại cảm giác thân thiện, ấm áp, tinh tế và không gây mệt mỏi thị giác khi mở trên desktop.

### 1.1 Bảng Màu Nhận Diện Chuẩn (Color Palette)
* **Màu Thương Hiệu Chủ Đạo (Brand Primary):** `#8B5CF6` (Tím Oải Hương rực rỡ / Lavender Violet).
* **Màu Phụ Trợ (Brand Secondary):** `#60A5FA` (Xanh da trời mềm / Soft Sky Blue).
* **Màu Nhấn (Accents):**
  - Đào hồng (Peach/Coral): `#FF8E9C` / `#FDBA74`
  - Bạc hà (Mint Green): `#4CC9A0` / `#6EE7B7`
  - Vàng ấm (Warm Sun): `#F59E0B` / `#FDE047`
* **Màu Nền & Bề Mặt Kính (Surfaces & Glass):**
  - Nền cửa sổ chính: Gradient pastel dịu nhẹ (`radial-gradient` kết hợp các blob phát sáng mờ tím `#EDE9FE`, xanh `#E0F2FE` và đào `#FFE4E6`).
  - Lớp kính bề mặt (`--surface-glass`): `rgba(255, 255, 255, 0.78)` với `backdrop-filter: blur(18px)`.
  - Viền thẻ (`--border-glass`): `1px solid rgba(255, 255, 255, 0.65)` và viền ngoài `rgba(223, 217, 255, 0.5)`.
  - Đổ bóng mềm (`--card-shadow`): `0 8px 24px -6px rgba(139, 92, 246, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)`.
* **Màu Văn Bản (Typography Colors):**
  - Chữ chính (`--text-primary`): `#242044` (Tím than đậm, độ tương phản cao 15:1).
  - Chữ phụ (`--text-secondary`): `#777493` (Tím xám trung tính).
  - Chữ làm mờ (`--text-muted`): `#9D9AA6`.

### 1.2 Độ Bo Góc (Border Radius) & Quy Cách Lưới (Layout)
* Cửa sổ Control Center: `border-radius: 24px` – `28px`.
* Thẻ card nội dung (`.v5-card`): `border-radius: 20px`.
* Nút bấm & Ô chức năng (`.v5-tile`): `border-radius: 16px`.
* Nút con nhộng (Pill button / Badge): `border-radius: 999px`.
* Kích thước cửa sổ chuẩn: **Rộng 1120px × Cao 740px** (Tối thiểu: 1080px × 700px).
* Độ rộng Sidebar cố định: **244px**.

---

## 🖥️ 2. KHUNG CỬA SỔ & THANH ĐIỀU HƯỚNG SIDEBAR

### 2.1 Khung Cửa Sổ Chuẩn Desktop
* Nút điều khiển góc phải trên: Thu nhỏ (`-`), Phóng to (`▢`), Đóng (`✕`) bo tròn tinh tế.
* Nền kính mờ nhìn xuyên thấu nhẹ vào wallpaper máy tính.

### 2.2 Thanh Điều Hướng Bên Trái (Sidebar Navigation — 6 Tabs Chuẩn)
1. **Brand Header:**
   - Icon: Hộp vuông bo góc màu tím gradient mang biểu tượng chân mèo trắng (Paw).
   - Tên thương hiệu: **Cute Pet** (dòng trên, bold), **Companion** (dòng dưới), đi kèm badge tím nhạt `v2.0`.
2. **Menu 6 Tabs Duy Nhất (Không dư thừa):**
   - 🏠 **Trang chủ** (Home) — Mặc định active.
   - 🐱 **Thú cưng** (Pets) — Quản lý 4 bé, xem trước 3D và chỉnh tính cách.
   - 🔔 **Thông báo** (Notifications) — Chế độ hiển thị và kiểu tương tác.
   - 📥 **Hộp thư** (Mailbox) — Đi kèm **badge số `2`** tròn màu tím nhạt.
   - 🔌 **Kết nối** (Connections) — Quản lý ứng dụng tích hợp.
   - ⚙️ **Cài đặt** (Settings) — Giao diện, âm thanh, hệ thống.
3. **Sidebar Footer:**
   - Trạng thái vận hành: Chấm xanh ngọc phát sáng nhẹ `🟢 Đang chạy`.

---

## 🏠 3. MÀN HÌNH DASHBOARD TRANG CHỦ (HOME SCREEN — 100% CONCEPT MATCH)

Bố cục Trang chủ gồm **3 khu vực chính** được sắp xếp khoa học:

### 3.1 Phần Đầu Trang (Header Greeting & Clock)
* **Lời chào cá nhân hóa:**
  - Tiêu đề lớn H1: `Chào bạn! 👋`
  - Dòng phụ: `{Tên bé} đang đồng hành cùng bạn hôm nay!` (Ví dụ: *"Boba đang đồng hành cùng bạn hôm nay!"*).
* **Thẻ Ngày & Giờ (Date/Time Glass Pill):**
  - Đặt ở góc phải đối xứng với lời chào.
  - Hiển thị: `Thứ 7, 21/11  |  12:29` đi kèm icon mặt trời ấm áp ☀️.

### 3.2 Khối Trung Tâm (Top Content Grid — 2 Cột)
* **Cột Trái (3D Pet Showcase Card):**
  - Khung kính vuông mềm mại, bên trong là bục đệm tròn 3D mịn màng.
  - Hiển thị mô hình 3D tương tác của nhân vật đang chọn (Boba / Mochi / Cloud / Pip).
  - Mũi tên chuyển nhanh nhân vật: Nút `<` bên trái và `>` bên phải.
  - Phía dưới là tên bé: `Boba` (H2 đậm).
  - Phụ đề cá tính: `Năng động - Vui vẻ - Đồng hành`.
  - Hàng chấm phân trang (Pagination dots): 4 chấm tròn (chấm bé đang chọn sáng tím).
* **Cột Phải Trên (Chế độ đồng hành — 6 Tiles Grid 3×2):**
  - Tiêu đề: `🗂️ Chế độ đồng hành`.
  - Lưới 6 nút chức năng bo góc, mỗi nút gồm icon tròn + tên chế độ + mô tả ngắn:
    1. 🎯 **Focus** (Tập trung)
    2. 🍅 **Pomodoro** (25–5 phút)
    3. 🍵 **Break** (Nghỉ ngơi)
    4. 📖 **Study** (Học tập)
    5. 💻 **Work** (Làm việc)
    6. 💤 **Sleep** (Thư giãn)

### 3.3 Khối Dưới (Bottom Row — 2 Cards Song Song)
* **Card Bên Trái: 🔔 Thông báo (Notification Mode Selector):**
  - Gồm 2 card lựa chọn lớn đặt cạnh nhau (Radio Card):
    1. **Hệ thống + Thú cưng** (Logo Windows / Apple): *Giữ thông báo gốc, thêm thú cưng bám vào* (Active có viền tím nổi bật).
    2. **Thông báo của Cute Pet** (Icon Paw): *Thông báo riêng, sinh động, tùy biến*.
* **Card Bên Phải: ✨ Hoạt động hôm nay (Today's Summary Stats):**
  - Tiêu đề: `✨ Hoạt động hôm nay`.
  - 3 cột thống kê trực quan với icon nền tròn:
    - 🔔 **8** | Thông báo
    - 📋 **5** | Tác vụ
    - ⏱️ **2h 30m** | Tập trung

---

## 🖼️ 4. CHI TIẾT 5 MÀN HÌNH TÍNH NĂNG (THE 5 CORE SUB-SCREENS)

Theo đúng hàng 5 màn hình nhỏ ở giữa bản vẽ Concept:

### 4.1 Màn Hình 1: 🐱 Thú cưng – Tùy chỉnh & xem trước
* **Khu vực trên:** `Chọn thú cưng` với 4 thẻ bo tròn:
  - Mèo Mochi (Avatar Mochi)
  - Chó Boba (Avatar Boba — được viền tím chọn)
  - Thỏ Cloud (Avatar Cloud)
  - Chim cánh cụt Pip (Avatar Pip)
* **Khu vực trung tâm:** Sân khấu 3D Live Preview lớn hiển thị toàn thân thú cưng.
* **Khu vực bên phải:** Panel `Tùy chỉnh {Tên Bé}`:
  - *Thái độ:* Dropdown chọn tính cách/cảm xúc (Ví dụ: `Vui vẻ ▾`).
  - *Kích thước:* Slider phần trăm (Mặc định `100%`).
  - *Độ sinh động:* Slider tốc độ hoạt ảnh (Mặc định `1.0x`).
  - *Âm thanh:* Công tắc bật/tắt tiếng kêu (`[ON]`).

### 4.2 Màn Hình 2: 🔔 Thông báo – Cấu hình chế độ (System Notification Attachment — 100% Khớp Hình 1)
*Tài liệu tham chiếu chuẩn xác: `media_1795253646867_f578cb8b.jpg` (Hình 1 Concept v2.0) và `docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md`.*

Giao diện được thiết kế lại toàn diện, loại bỏ hoàn toàn giao diện tối màu và huy hiệu cũ, thay bằng bố cục kính mờ Pastel Glassmorphism với 5 khối cân đối:
1. **Khung Preview Đa Nền Tảng (Dual OS Live Mockups trên cùng):**
   - *Windows 11 (trái):* Wallpaper hoa xanh + Taskbar, Toast Teams *"Cuộc họp sắp bắt đầu"*, bé Mochi Chibi bám mép trên góc phải toast, nút `[ ▶ Thử thông báo Windows + Pet ]`.
   - *macOS (phải):* Wallpaper tím + Menu Bar, Banner GitHub *"Pull request đã được merge"*, bé Boba Chibi ló đầu vẫy tay trên banner, nút `[ ▶ Thử thông báo macOS + Pet ]`.
2. **Khối Hai Chế Độ Hiển Thị (Display Modes):**
   - Card 1: 🪟 **System Notification (Đồng hành cùng hệ thống)** [Checked ✓] — *Giữ nguyên banner của Windows/macOS, pet bám và tương tác ở cạnh.* Kèm nút `[ ▶ Bắn thử thông báo hệ thống ]`.
   - Card 2: 🐾 **Pet Notification (Thông báo của Cute Pet)** [Unchecked ○] — *Sử dụng khung thông báo riêng của app với hiệu ứng và phong cách tùy biến.* Kèm nút `[ ▶ Bắn thử thẻ Cute Pet ]`.
3. **Khối Các Kiểu Bám (4 Attachment Styles):**
   - 1. **Ôm bảng (Cling) — [Mặc định]:** Bé bám 2 tay vào mép trên thông báo.
   - 2. **Ló đầu (Peek):** Bé chỉ thò đầu và mắt lên quan sát.
   - 3. **Nghỉ ngơi (Rest):** Bé nằm dài duỗi chân ngủ thư giãn trên banner (Zzz).
   - 4. **Đưa thư (Deliver):** Thỏ Cloud cầm phong thư tím mang đến bạn.
4. **Khối Chuỗi Tương Tác 6 Bước (Animation Flow):**
   - `1. Thông báo xuất hiện ➔ 2. Pet tiếp cận (Approach) ➔ 3. Bám vào (Attach) ➔ 4. Phản ứng (React) ➔ 5. Giữ và tương tác (Idle) ➔ 6. Rời đi (Release)`.
5. **Khối Ví Dụ Biến Thể Thực Tế (4 Danh mục):**
   - *Email / Công việc:* Outlook (Bé tựa cằm quan sát).
   - *Tin nhắn / Trò chuyện:* Slack (Bé nằm ngủ Zzz).
   - *Lịch / Nhắc nhở:* Lịch 17 (Bé ôm bảng bắn tim ❤️).
   - *Hệ thống / Cập nhật:* Cập nhật v2.0 (Bé đội mũ tiệc 🥳).
6. **Khối Tùy Chỉnh Nhanh (Quick Controls):**
   - Bật bám thông báo: `[Toggle Switch ON]`
   - Kiểu hiển thị: Dropdown `[ Ôm bảng (Cling) ▾ ]`
   - Vị trí ưu tiên: Dropdown `[ Góc trên phải ▾ ]`
   - Kích thước pet: Slider `100%`
   - Độ mờ: Slider `90%`
   - Giảm chuyển động: `[Toggle Switch OFF]`

### 4.3 Màn Hình 3: 📥 Hộp thư – Lịch sử thông báo
* **Tiêu đề:** `Hộp thư`.
* **Thanh lọc phân loại (Filter Pills):** `[Tất cả]` (active tím) | `[Tin nhắn]` | `[Công việc]` | `[⭐ Quan trọng]`.
* **Danh sách thông báo (Notification List Rows):**
  - Dòng 1: Logo GitHub | **Tác vụ hoàn thành** | `Deploy bản cập nhật v2.0...` | `12:21`
  - Dòng 2: Logo Outlook | **Team Sync Reminder** | `Họp nhóm sau 15 phút.` | `10:15`
  - Dòng 3: Logo Notion | **Cập nhật tài liệu** | `Tài liệu dự án đã được chỉnh sửa.` | `09:30`
* **Nút hành động chân trang:** Nút con nhộng màu tím nhạt `✓ Đánh dấu đã đọc tất cả`.

### 4.4 Màn Hình 4: 🔌 Kết nối – Quản lý ứng dụng
* **Tiêu đề:** `Kết nối ứng dụng` đi kèm badge xám `Đã kết nối (4)` và nút `+ Thêm ứng dụng`.
* **Danh sách ứng dụng kết nối (App Cards kèm công tắc trực tiếp):**
  - **GitHub:** *Thông báo tác vụ, PR, Issue* `[Toggle ON]`
  - **Gmail:** *Thông báo email mới* `[Toggle ON]`
  - **Microsoft Teams:** *Tin nhắn, cuộc họp* `[Toggle ON]`
  - **Notion:** *Cập nhật trang, nhắc nhở* `[Toggle OFF]`
* **Chân trang:** Nút viền tím nét đứt/nhẹ `+ Thêm ứng dụng khác`.

### 4.5 Màn Hình 5: ⚙️ Cài đặt – Giao diện & trải nghiệm
* **Mục Giao diện (Theme Selector):**
  - 4 nút tròn màu pastel tinh tế:
    1. 🟣 **Oải hương** (Lavender - Mặc định, có dấu check ✓)
    2. 🔵 **Xanh biển** (Cyan / Ocean)
    3. 🟢 **Bạc hà** (Mint)
    4. ⚫ **Đêm** (Midnight Dark)
* **Mục Chung:**
  - *Ngôn ngữ:* Dropdown `[Tiếng Việt ▾]` (hỗ trợ English).
  - *Khởi động cùng máy:* `[Toggle ON]`
  - *Giảm chuyển động (Reduced Motion):* `[Toggle OFF]`
* **Mục Âm thanh:**
  - Slider âm lượng Master trực quan với nhãn `70%`.

---

## 💬 5. THẺ THÔNG BÁO GỌN & QUY TRÌNH HOẠT ẢNH (COMPACT CARD & ANIMATION FLOW)

### 5.1 Thẻ Thông Báo Gọn & Sinh Động (Compact Desktop Overlay Card)
Đúng theo hình mẫu minh họa góc phải trên:
* **Chiều rộng chuẩn:** `340px`.
* **Thú cưng bám cạnh trên:** Bé nhô đầu hoặc bám tay lên mép thẻ phía trên (`z-index` phù hợp, không che chữ hay nút bấm).
* **Cấu trúc thẻ:**
  - Header: Logo ứng dụng (GitHub / Outlook) + Tên App + Badge cảm xúc (`🐱 Vui vẻ` / `⭐ Nhắc nhở`) + Thời gian (`12:29` / `10:15`).
  - Tiêu đề (H3): In đậm rõ nét (Ví dụ: `✅ Tác vụ hoàn thành`).
  - Nội dung: Tối đa 2 dòng mô tả súc tích.
  - Hàng nút bấm hành động (Action Buttons):
    - Nút chính tím nổi bật: `[↗ Tham gia]`
    - Nút phụ viền mảnh: `[⏰ Nhắc lại]`

### 5.2 Chuỗi Tương Tác Hoạt Ảnh 6 Bước (Animation Flow — Bottom Banner)
Chuỗi chuyển động bất biến khi có thông báo:
```
[1. Tiếp cận] ➔ [2. Bám vào] ➔ [3. Ló đầu] ➔ [4. Phản ứng] ➔ [5. Giữ bảng] ➔ [6. Rời đi]
 (Approach)        (Attach)        (Peek)        (React)         (Hold)         (Leave)
```
1. **Tiếp cận:** Bé chạy hoặc nhảy lướt nhẹ từ ngoài màn hình tới vị trí xuất hiện thẻ.
2. **Bám vào:** Hai chân trước bám chắc chắn vào mép trên của khung thông báo.
3. **Ló đầu:** Đầu nhô lên tò mò quan sát người dùng.
4. **Phản ứng:** Biểu lộ cảm xúc tương ứng với nội dung (Vui mừng, Hào hứng, Suy nghĩ, Cau mày...).
5. **Giữ bảng:** Ôm giữ bảng thở nhịp nhàng trong suốt thời gian hiển thị (Cooldown 5s–10s).
6. **Rời đi:** Thả tay, nhảy lùi hoặc lặn êm dịu trở về dock góc màn hình khi thẻ đóng.

---

## 📋 6. CHECKLIST NGHIỆM THU CHUẨN GIAO DIỆN 100% (IMPLEMENTATION CHECKLIST)

Khi triển khai code vào `src/control/control.js`, `src/control/control.css` và `src/control/index.html`, phải đối chiếu từng tiêu chí:

- [ ] **Khung Cửa Sổ & Sidebar:**
  - [ ] Bo góc 26px, nền kính mờ `backdrop-filter: blur(18px)`.
  - [ ] Đúng 6 tabs: Trang chủ, Thú cưng, Thông báo, Hộp thư, Kết nối, Cài đặt.
  - [ ] Badge số `2` màu tím trên tab Hộp thư.
  - [ ] Chấm xanh `🟢 Đang chạy` ở chân sidebar.
- [ ] **Trang Chủ (Dashboard):**
  - [ ] Header có lời chào `Chào bạn! 👋` và thẻ giờ góc phải `Thứ 7, 21/11 | 12:29 ☀️`.
  - [ ] Card trái 3D Showcase có bục đệm tròn, nút `< >`, tên pet, subtitle và 4 chấm pagination.
  - [ ] Lưới 6 chế độ đồng hành (Focus, Pomodoro, Break, Study, Work, Sleep) chuẩn icon & màu.
  - [ ] Card Thông báo gồm 2 lựa chọn: *Hệ thống + Thú cưng* và *Thông báo của Cute Pet*.
  - [ ] Card Hoạt động hôm nay gồm 3 cột: Thông báo, Tác vụ, Tập trung.
- [ ] **Màn Thú Cưng:**
  - [ ] 4 card chọn thú cưng (Mochi, Boba, Cloud, Pip) với thumbnail bo tròn.
  - [ ] Khung 3D live trung tâm.
  - [ ] Panel tùy chỉnh bên phải: Thái độ, Kích thước (100%), Độ sinh động (1.0x), Âm thanh (Toggle).
- [ ] **Màn Thông Báo:**
  - [ ] 2 card chọn nguồn thông báo.
  - [ ] 3 card minh họa kiểu tương tác: Ôm bảng, Ló đầu, Đưa thư.
  - [ ] 3 công tắc: Hiệu ứng động, Âm thanh của bé, Click xuyên.
- [ ] **Màn Hộp Thư:**
  - [ ] 4 tab filter: Tất cả, Tin nhắn, Công việc, ⭐ Quan trọng.
  - [ ] Hàng thông báo có icon, tên app, nội dung tóm tắt, giờ đến.
  - [ ] Nút `✓ Đánh dấu đã đọc tất cả`.
- [ ] **Màn Kết Nối:**
  - [ ] Danh sách app: GitHub, Gmail, Teams, Notion kèm toggle trực tiếp.
  - [ ] Nút `+ Thêm ứng dụng khác`.
- [ ] **Màn Cài Đặt:**
  - [ ] 4 nút chọn theme màu tròn (Oải hương, Xanh biển, Bạc hà, Đêm).
  - [ ] Dropdown chọn ngôn ngữ Tiếng Việt / English.
  - [ ] Toggle Khởi động cùng máy & Giảm chuyển động.
  - [ ] Slider âm lượng 70%.
- [ ] **Overlay Card:**
  - [ ] Thẻ compact rộng 340px, bé bám mép trên không che chữ, chuỗi animation 6 bước mượt mà.
