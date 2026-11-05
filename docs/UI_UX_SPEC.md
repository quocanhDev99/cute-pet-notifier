# 🐾 Cute Pet Companion — Đặc tả UI/UX (bản vẽ thiết kế)

> **Dành cho ai:** designer, lập trình viên và **AI agent** cần hình dung chính xác giao diện hiện tại mà không cần mở app.
> **Nguồn sự thật:** mọi giá trị dưới đây được lấy trực tiếp từ mã nguồn tại thời điểm viết (05/11/2026, v3.5.5):
> `src/control/control.css` · `src/control/control.js` · `src/control/index.html` (Control Center) và
> `src/renderer/css/style.css` · `src/renderer/js/renderer.js` (lớp phủ trên desktop).
> Nếu tài liệu và code khác nhau → **code đúng**, hãy cập nhật tài liệu.
> **Cập nhật V4 polish (05/11/2026):** hệ thống chuyển động, chữ nhẹ hơn một bậc, bóng panel nhẹ hơn, sidebar 236px, thẻ trạng thái ở Trang chủ, bộ lọc Hộp thư, xác nhận Approve — xem `docs/reports/UI_REDESIGN_REPORT.md`.

---

## 0. Tóm tắt trong 30 giây

* App có **2 bề mặt**:
  1. **Lớp phủ desktop (Overlay)** — cửa sổ trong suốt toàn màn hình, ở góc có **thú cưng 3D** (Three.js) và **thẻ thông báo 3D kiểu acrylic** bật ra cạnh bé.
  2. **Control Center** — cửa sổ cài đặt 1220×820 (tối thiểu 980×660), cũng chạy trên trình duyệt ở `http://127.0.0.1:3721`; sidebar trái + nội dung phải.
* **Phong cách:** *soft 3D clay / art-toy* — màu pastel, góc bo rất tròn (14–28px), bóng "đất sét" nhiều lớp (viền dưới đặc + bóng mờ), chữ tròn đậm, emoji làm icon, chuyển động nảy (spring).
* **Giọng văn:** tiếng Việt thân mật, ngôi "bé" cho thú cưng và "bạn" cho người dùng; câu ngắn, không thuật ngữ kỹ thuật.
* **Màu thương hiệu mặc định:** hồng đào `#FF7A8A` → cam `#FFB36B`. Có 6 bộ màu giao diện; thẻ thông báo có 5 kiểu và 8 màu theo cảm xúc.

---

## 1. Nguyên tắc thiết kế

| Nguyên tắc | Thể hiện cụ thể |
|---|---|
| **Dễ thương nhưng gọn** | Emoji thay icon; mỗi khu chỉ giữ thứ dùng hằng ngày, phần ít dùng gom vào mục thu gọn ("⚙️ Tuỳ chọn thêm"). |
| **Vật liệu "đất sét"** | Bề mặt trắng/pastel, bóng 2 lớp: lớp viền đặc phía dưới (`0 2px 0` / `0 4px 0`) + bóng mờ rộng. Nút bấm lún xuống khi nhấn (`translateY(3px)`). |
| **Bo tròn mạnh** | Panel 22px, thẻ thông báo 24px, nút 12–14px, chip/pill 999px. Không có góc vuông. |
| **Chữ đậm, tròn** | Tiêu đề & nhãn 800, mô tả 500–600; 900 chỉ cho số lớn (thống kê). Không dùng chữ mảnh. |
| **Chuyển động có nảy** | `cubic-bezier(.2,1.3,.35,1)` / `(.3,1.5,.5,1)`; luôn tôn trọng "Giảm chuyển động". |
| **Trung thực** | Không ghi "realtime" cho kiểm tra định kỳ; trạng thái kết nối thật; không bao giờ giả lập dữ liệu. |
| **Riêng tư thấy được** | Câu "chỉ lưu tên, không lưu nội dung" đặt ngay cạnh công tắc liên quan. |

---

## 2. Typography

**Font stack (cả 2 bề mặt):**
```
ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif
```
macOS hiển thị **SF Pro Rounded**; Windows rơi về **Segoe UI**. Chữ đơn cách (mã Jira, nhánh git, `code`): `ui-monospace, "SF Mono", Menlo, Consolas, monospace`. Bật `-webkit-font-smoothing: antialiased`.

| Vai trò | Cỡ | Độ đậm | Ghi chú |
|---|---|---|---|
| Tiêu đề trang (`.page-head h1`) | 28px | 800 | letter-spacing −0.4px; mô tả dưới 500 |
| Tên thú cưng ở Trang chủ (`.hero-info h2`) | 34px | 800 | −0.6px |
| Số thống kê (`.stat b`) | 28px | 900 | |
| Tên thương hiệu sidebar | 18px | 800 | "Cute Pet" + phụ đề "Companion" 11.5px/700 màu muted |
| Tiêu đề panel (`.panel h3`) | 16.5px | 800 | thường có emoji đầu dòng |
| Tiêu đề thẻ thông báo | 16.5px (15 / 18 theo cỡ thẻ) | 900 | tối đa 3 dòng |
| Mục menu sidebar | 14px | 700 | |
| Nút thường | 14px (nhỏ 12.5px) | 800 | |
| Nhãn công tắc (`.toggle-row b`) | 14px | 800 | mô tả dưới 12.5px/500 muted |
| Nội dung/đoạn văn | 13.5px | 600 | line-height 1.6 |
| Nội dung thẻ thông báo | 13.5px | 600 | line-height 1.6, tối đa 5 dòng |
| Chip/pill | 11–12.5px | 800 | |
| Eyebrow (`.eyebrow`) | 12px | 900 | VIẾT HOA, letter-spacing 1.2px, màu brand-ink |
| Chú thích phụ (`small`, `.muted`) | 11.5–13px | 600 | màu `--muted` |

---

## 3. Hệ màu

### 3.1 Token Control Center (theme mặc định **"Đào hồng" — peach**)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#FFF7F2` | nền cửa sổ |
| `--panel` | `#FFFFFF` | panel, thẻ, nút ghost |
| `--ink` | `#3A2E39` | chữ chính (nâu tím rất đậm, **không dùng đen thuần**) |
| `--ink-2` | `#6E5C69` | chữ phụ |
| `--muted` | `#9A8794` | chú thích, placeholder |
| `--line` | `#F2E4DD` | viền mảnh, đường kẻ đứt |
| `--brand` / `--brand-2` | `#FF7A8A` / `#FFB36B` | gradient thương hiệu, công tắc bật, số thứ tự bước |
| `--brand-ink` | `#C2405A` | chữ nhấn trên nền nhạt |
| `--p1` / `--p2` / `--p-sh` | `#FF8E9C` / `#FF6F80` / `#D9475B` | nút chính: gradient p1→p2, bóng đặc p-sh |
| `--p-ring` | `#FF9AAA` | viền "đang chọn" |
| `--t1…t5`, `--t-sh` | `#FFF0F3 #FFE6EB #FFE7EC #FFF1E2 #EDE9FF`, `#F3B3BE` | nền mục được chọn, nền khung xem trước 3D |
| `--soft`, `--soft-2`, `--soft-3` | `#FFFAF7 #FFF4EE #FFF0EA` | nền ô nhập, chip-btn, segmented |
| `--edge`, `--edge-2` | `#F2DED4 #EBD5CB` | bóng đặc dưới chân "đất sét" |
| `--r1`, `--r2` | `#FFD0D7 #FFE2C9` | rãnh thanh trượt |
| `--blob1/2/3` | `#FFD3DC #FFE3BF #DCD6FF` | 3 đốm màu mờ (blur 70px) trôi trên nền |
| `--ok` / `--warn` / `--err` / `--off` | `#22A06B` / `#E08A00` / `#D93F4C` / `#9A8794` | trạng thái |

**Bóng "đất sét"** (chỉ dùng cho khối quan trọng: hero Trang chủ, thẻ nhân vật, nút chính). Panel thường dùng bóng nhẹ hơn:
```
--shadow-panel: 0 1px 0 rgba(255,255,255,.85) inset, 0 2px 0 var(--edge), 0 14px 30px -20px rgba(140,70,90,.28);
```

```
--clay:    0 1px 0 rgba(255,255,255,.9) inset, 0 -3px 0 rgba(120,70,90,.05) inset,
           0 2px 0 var(--edge), 0 4px 0 var(--edge-2), 0 18px 36px -16px rgba(140,70,90,.22);
--clay-sm: 0 1px 0 rgba(255,255,255,.9) inset, 0 2px 0 var(--edge), 0 8px 18px -10px rgba(140,70,90,.25);
```

### 3.2 Sáu bộ màu giao diện (Cài đặt → 🎨 Màu giao diện, đặt qua `<html data-theme="…">`)

| id | Tên | Gradient mẫu | `--bg` | `--brand` → `--brand-2` | `--brand-ink` | `--ink` |
|---|---|---|---|---|---|---|
| `peach` | Đào hồng | `#FF8E9C → #FFB36B` | `#FFF7F2` | `#FF7A8A → #FFB36B` | `#C2405A` | `#3A2E39` |
| `mint` | Bạc hà | `#4CC9A0 → #7FD6B0` | `#F3FBF7` | `#2BB58A → #7FD6B0` | `#16795A` | `#253B33` |
| `lavender` | Oải hương | `#A28BF6 → #C49BFA` | `#F8F5FF` | `#8B6CF0 → #C49BFA` | `#5B3FC4` | `#342E45` |
| `ocean` | Đại dương | `#5B9BF8 → #5EC8F2` | `#F3F8FF` | `#3B82F6 → #5EC8F2` | `#1D5FC2` | `#26334A` |
| `sunset` | Hoàng hôn | `#F7A04B → #F7C548` | `#FFF8EF` | `#F08A24 → #F7C548` | `#B45C0C` | `#3F3122` |
| `midnight` | Đêm (tối) | `#24212F → #FF8E9C` | `#17151F`, panel `#24212F` | `#FF8EA0 → #FFB37A` | `#FFA3B2` | `#F2EEF8` |

Mỗi theme thay **toàn bộ** nhóm token `--p*`, `--t*`, `--soft*`, `--edge*`, `--blob*`, `--ink*`. Theme tối còn đổi `--clay` sang bóng đen, sidebar `rgba(30,27,40,.75)`, đốm nền mờ hơn (opacity .35). **Mọi thành phần mới phải chỉ dùng token**, không mã màu cứng (ngoại lệ: màu trạng thái chuẩn ở 3.4).

### 3.3 Màu theo cảm xúc (8 cảm xúc chuẩn)

| id | Nhãn | Emoji | `--c` (chính) | `--c2` (phụ) | Ý nghĩa mặc định |
|---|---|---|---|---|---|
| `happy` | Vui vẻ | 😸 | `#FFAA1D` | `#FFD66B` | Hoàn thành tác vụ |
| `excited` | Hào hứng | 🤩 | `#FF7A45` | `#FFB37A` | Tin nhắn mới |
| `love` | Yêu thương | 💖 | `#FF4F8B` | `#FF9EC1` | Khen ngợi / lương về |
| `surprised` | Bất ngờ | 😲 | `#8B5CF6` | `#C4B5FD` | Cảnh báo gấp |
| `angry` | Cáu kỉnh | 😾 | `#EF4444` | `#FB923C` | Deadline sát nút |
| `sad` | Buồn bã | 😿 | `#3B82F6` | `#93C5FD` | Lỗi hệ thống |
| `thinking` | Suy tư | 🤔 | `#14B8A6` | `#5EEAD4` | Đang xử lý |
| `sleeping` | Ngủ say | 😴 | `#6366F1` | `#A5B4FC` | Họp / Không làm phiền |

`--c/--c2` tô: dải màu 5px trên đầu thẻ, nút chính trên thẻ, thanh tiến trình, quầng sáng góc phải trên, chip cảm xúc. Khi bật **"Thẻ thông báo dùng màu giao diện"**, `--c/--c2` lấy theo theme giao diện thay vì cảm xúc.

### 3.4 Màu trạng thái chuẩn (dùng chung, không đổi theo theme)

| Ý nghĩa | Nền | Chữ |
|---|---|---|
| Thành công / Đã kết nối / Done | `#E6F6EE` (thẻ: `#DFF5E8`) | `#22A06B` (thẻ: `#187A47`) |
| Cảnh báo | `#FFF4E0` | `#E08A00` / `#8A5300` |
| Lỗi / Cần sửa / Khẩn cấp | `#FDECEC` (thẻ: `#FFE4E4`, `#FEE2E2`) | `#D93F4C` / `#B42318` |
| Tắt / Chưa làm | `#F5EFEC` (thẻ: `#EEF0F4`) | `#9A8794` / `#4D5B70` |
| Đang làm | `#E3EEFF` | `#1F5BC7` |
| Đang review | `#F1E8FF` | `#6B3FC4` |
| Ưu tiên "quan trọng" | `#FEF3C7` / `#FFF1DE` | `#92400E` / `#A35A00` |
| Mã ticket (WB-128, #342) | `#EEF3FF` | `#2453B8` (font đơn cách) |

---

## 4. Bố cục & khoảng cách

* **Lưới Control Center:** `grid-template-columns: 236px 1fr`, cao 100vh. Sidebar có vùng kéo cửa sổ (`-webkit-app-region: drag`).
* **Vùng nội dung:** padding `38px 40px 60px`, trang tối đa **1180px**, căn giữa, khoảng cách giữa các khối **22px**.
* **Panel:** nền `--panel`, bo 22px, padding 22px, bóng `--shadow-panel` (hero/thẻ nhân vật: `--clay`).
* **Lưới phụ:** `.grid-2` (1fr 1fr, gap 22px), `.grid-2.wide-left` (1.25fr 1fr), lưới thú cưng 4 cột (gap 18px), lưới màu giao diện 6 cột.
* **Thang khoảng cách hay dùng:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26 · 30px.
* **Bo góc:** chip 999px · nút 12–14px · ô nhập 12–13px · panel 22px · thẻ thông báo 24px (Trắng tối giản 18px) · khung xem trước 3D 28px · modal 26px.
* **Responsive:** dưới **860px** các hàng ngang (bước 3 Người quen, giờ theo quan hệ, ô nhập tay) xếp dọc; nút chính giãn 100%.

---

## 5. Thư viện thành phần (Control Center)

| Thành phần | Mô tả hình ảnh | Trạng thái |
|---|---|---|
| **Nút chính** `.btn.btn-primary` | Chữ trắng 900, gradient dọc `p1→p2`, bóng đặc `0 4px 0 p-sh` + quầng màu. Padding 11×18, bo 14. | hover sáng 4% & nhích lên 1px; nhấn lún 3px; disabled mờ 60% |
| **Nút phụ** `.btn-ghost` | Nền trắng, viền trong 1.5px `--line`, bóng `0 3px 0 edge`. | `.danger` chữ đỏ |
| **Nút đã xong** `.btn-done` | Nền `#E6F6EE`, chữ xanh lá, không nhấn được. | |
| **Chip-btn** | Nền `--soft-2`, bo 12, bóng `0 2px 0 edge`; bản `.primary` gradient thương hiệu. | |
| **Icon-btn** | Trong suốt, 16px, padding 6; hover nền `--soft-3`. | |
| **Pill** | Viên thuốc nền `--soft-2`, chữ 12.5/800; `.pill-ok` xanh lá, `.pill-night` tím than. | |
| **Công tắc** `.switch` | 44×26, rãnh `--edge`; khi bật gradient `brand→brand-2`; núm trắng 20px trượt 18px với nảy `cubic-bezier(.3,1.5,.5,1)`. | |
| **Hàng công tắc** `.toggle-row` | Trái: tiêu đề 14/900 + mô tả 12.5/600 muted (rộng tối đa 460px). Phải: công tắc. Ngăn cách bằng nét đứt `--line`. | |
| **Thanh trượt** | Rãnh 10px gradient `r1→r2`; núm trắng 24px có vòng `p1` dày 4px + bóng `p-sh`; nhãn giá trị dạng pill bên phải (`×1.00`, `55%`). | nhấn núm phóng 1.15 |
| **Segmented** `.seg` | Khay nền `--soft-2` bo 14, 3 nút đều nhau; nút chọn nền trắng + bóng. | |
| **Choice card** `.choice` | Thẻ nền `--soft`, viền trong `--line`, tiêu đề 14/900 + mô tả. Chọn: gradient `t1→t2` + viền trong 2.5px `p1`. | |
| **Sub-tabs** `.subtabs` | Khay `--soft-2` bo 16; tab 13.5/900; tab đang mở nền trắng + `--clay-sm`. | |
| **Ô nhập / select** | Nền `--soft`, viền trong 1.5px `--line`, bo 13, chữ 13.5/700. Focus: viền 2px `--p-ring` + quầng 4px màu thương hiệu 12%. | |
| **Toast** | Góc dưới, nền trắng bo 16, bóng `--clay`, viền trái 5px xanh (ok) / đỏ (error); bật lên bằng nảy. | tự tắt sau 3.2s |
| **Modal** | Lớp nền `rgba(30,20,30,.35)` + blur 6px; thẻ trắng rộng ≤560px bo 26. Đầu: icon 44px · tiêu đề 17/900 + phụ đề · nút ✕. Nút hành động căn phải. | Esc / bấm ra ngoài để đóng |
| **Badge Hộp thư** (sidebar) | Viên 22×20, gradient thương hiệu, chữ trắng 11/900. | |
| **Chấm trạng thái** `.live-dot` | Chấm 9px; xanh lá có vòng nhịp đập 2s khi đang chạy. | |
| **Trống** `.empty` | Nền `--soft`, viền đứt 2px `--line`, chữ muted căn giữa. | |
| **Avatar chữ cái** `.ct-ava` | Tròn 32–40px, 2 chữ cái đầu viết hoa 800; màu theo hash tên: chữ `hsl(h 45% 34%)` trên nền `hsl(h 75% 90%)` (tối: `hsl(h 70% 82%)` / `hsl(h 30% 28%)`); nhóm có huy hiệu 👥 nhỏ góc dưới phải. | |
| **Chip app** `.ct-app` | Viên thuốc: icon app thật 22px (lấy từ máy) + tên 13/700; chấm xanh 6px nếu đang chạy. Chọn: nền thương hiệu 10% + viền 2px `--brand`, chữ `--brand-ink`. | |
| **Chip quan hệ** `.ct-rel` | Viên thuốc: emoji 15px + nhãn 12.5/700. Chọn: nền thương hiệu 14% + viền 2px `--brand`. | |

---

## 6. Control Center — từng màn hình

### 6.1 Khung chung

```
┌──────────────────────┬─────────────────────────────────────────────────────────┐
│ [🐾 logo] Cute Pet   │  Tiêu đề trang (30/900)              [✓ Đã lưu]          │
│           Companion  │  Mô tả 1 dòng (ink-2)                                     │
│                      │                                                           │
│  🏠 Trang chủ        │  ┌── panel ────────────────────────────────────────────┐  │
│ ▣🐱 Thú cưng ◀active │  │                                                     │  │
│  🔔 Thông báo        │  └─────────────────────────────────────────────────────┘  │
│  📥 Hộp thư     (3)  │  ┌── panel ──────────────┐ ┌── panel ─────────────────┐  │
│  🔌 Kết nối          │  │                       │ │                          │  │
│  ⚙️ Cài đặt          │  └───────────────────────┘ └──────────────────────────┘  │
│  (📊 Theo dõi)       │                                                           │
│                      │   (nền: 3 đốm màu mờ trôi phía sau)                       │
│ ● Đang chạy          │                                                           │
│ [🐾 Bình thường]     │                                                           │
│ [◯ 🌙 Không làm phiền]│                                                          │
└──────────────────────┴─────────────────────────────────────────────────────────┘
```

* **Sidebar** (236px): nền trắng 55% + blur 20px, viền phải mảnh. Logo 46×46 bo 15 gradient thương hiệu. Mỗi mục menu: emoji 16px trong ô 28×28 trong suốt + chữ 14/700; mục đang mở nền trắng + `--clay-sm`, ô emoji nền thương hiệu 12%; hover nhích phải 2px. "📊 Theo dõi" chỉ hiện khi bật Chế độ nâng cao.
* **Chân sidebar:** chấm "● Đang chạy" (vòng lan toả bằng transform, hoặc "Mất kết nối với app…"), **chỉ báo bé đang dùng** ("🐾 Bé Chó Boba", bấm để sang 🐱 Thú cưng), pill chế độ hiện tại, thẻ công tắc "🌙 Không làm phiền".
* **Huy hiệu "✓ Đã lưu"**: pill xanh lá hiện 1.2s mỗi khi cài đặt được lưu (lưu tự động, không có nút Save).
* Trang mới hiện bằng hiệu ứng trượt lên 6px + mờ dần (260ms, `--ease-out`).

### 6.2 🏠 Trang chủ

```
Chào bạn! Boba đang ở đây 🐾 — Bạn tập trung làm việc nhé, để bé trông thông báo giúp.
┌─ hero (400px | 1fr) ─────────────────────────────────────────────────────────┐
│ ┌ khung 3D ┐   BẠN ĐỒNG HÀNH CỦA BẠN (eyebrow)                                │
│ │  (bé)    │   Chó Boba (34/800)                                             │
│ │  bong    │   [🍵 Điềm đạm] [📣 Chat: chỉ khi nhắc tới bạn] [☀️ Sẵn sàng]    │
│ └──────────┘   ┌ banner ✅ Thú cưng đang thay thế thông báo của máy ┐         │
│ [👋 Vẫy][💕 Vuốt][🦶 Đá]  Thú cưng xuất hiện thế nào? · Kích thước          │
│                [🚀 Gửi thử 1 thông báo] [🐱 Đổi thú cưng]                     │
└──────────────────────────────────────────────────────────────────────────────┘
┌📥 0 tin đang chờ┐┌🧩 0 việc Jira/PR cần xem┐┌🔌 7/7 ứng dụng hoạt động┐┌🐾 Bình thường┐   ← 4 thẻ trạng thái, bấm để tới nơi xử lý
┌ 🕘 Thông báo gần đây                                          Mở Hộp thư ┐
│ (emo) Tiêu đề / nội dung                                       app · giờ │
└──────────────────────────────────────────────────────────────────────────┘
```
Thẻ trạng thái (`.status-card`): nền `--panel`, bo 18, `--shadow-panel`, icon trong ô 40px nền thương hiệu 10%, số 22/900 hoặc chữ 15/800, nhãn 12px muted; hover nhô 2px. Lần lượt dẫn tới `#inbox`, `#inbox/work`, `#connect`, `#notify/focus`. Dưới 1100px xếp 2×2.
Khung 3D: tỷ lệ 1:1.02, tối đa 380px, bo 28, nền gradient `t3→t4→t5` + quầng trắng giữa, "sàn" elip trắng mờ dưới chân bé; bong bóng thoại trắng bật lên phía trên.

### 6.3 🐱 Thú cưng

1. **Lưới 4 nhân vật** (Mèo Mochi, Chó Boba, Thỏ Cloud, Chim cánh cụt Pip): thẻ bo 24, ảnh vuông nền gradient `t3→t4→t5`, dưới là tên 900 + nút "Chọn" (chính) hoặc "✓ Đang dùng" (xanh lá). Thẻ đang dùng có vòng 3px `--p-ring`; hover nghiêng nhẹ và nhô 4px.
2. **Hai cột:** trái khung 3D + nút thử động tác; phải **💖 Thái độ** — danh sách 5 thái độ dạng thẻ hàng (emoji 30px · tên + tên tiếng Anh mờ · mô tả · "Lúc rảnh: …" · "Khi có thông báo: …"), chọn = gradient `t1→t2` + viền `p1`. Dưới cùng công tắc "Bé luôn phản ứng theo thái độ đã chọn".
3. **👥 Người quen** — xem §7.
4. **🎭 Bé đọc cảm xúc tin nhắn** — nếu đang theo thái độ: **một dòng** `🎭 Bé đọc cảm xúc tin nhắn · Đang tắt — bé phản ứng theo thái độ đã chọn ở trên.  [Bật]`. Nếu bật: 2 cột (công tắc + segmented Ít/Vừa/Nhạy | ô "Gõ thử một tin nhắn" + chip ví dụ + vùng kết quả).
5. **🎵 Âm thanh & chuyển động** — 2 cột: công tắc Tiếng kêu, Bé nói chuyện, thanh Âm lượng (%), nút "🔊 Nghe thử" "🗣️ Nghe bé nói" | thanh Độ sinh động (×), select Giảm chuyển động.

### 6.4 🔔 Thông báo (4 sub-tab)

* **🎨 Hiển thị:** 3 thẻ "Cách bé mang thông báo tới" (🪧 Ôm bảng · 👀 Ló đầu · ✉️ Đưa thư, có minh hoạ) → "🎨 Kiểu thẻ" 5 ô mẫu (Pastel · Trắng tối giản · Tối · Kính mờ · Trong suốt) + segmented Nhỏ/Vừa/Lớn + thanh 📐 Kích thước khung (0.8–1.5×) + ⏱️ Thời gian hiện (3–30s) → "📍 Vị trí của bé": lưới 3×3 nút chấm quanh biểu tượng 🖥️, thanh 🔍 Kích thước bé, công tắc kéo thả, công tắc số chưa đọc.
* **💬 Tin nhắn:** 2 thẻ lựa chọn lớn — "🔔 Báo tất cả tin nhắn" / "📣 Chỉ tin dành cho tôi". Khi chọn cái sau hiện: ô "Tên của bạn trong chat" (hướng dẫn tên 2 chữ / @tên 1 chữ), cảnh báo ⚠️ vàng nếu trống, nút "＋ Dùng "Anh Nguyen"" (tự điền khi chọn chế độ), công tắc "💬 Báo khi có người nhắn riêng (1-1)".
* **🎯 Tập trung:** chế độ tập trung, giờ yên tĩnh, nhắc nghỉ mắt.
* **⭐ Ưu tiên:** quy tắc ưu tiên / ứng dụng.

### 6.5 📥 Hộp thư
Hàng bộ lọc dạng viên thuốc có số đếm: **Tất cả · 💬 Tin nhắn · 🧩 Công việc (Jira/Bitbucket/GitHub) · ⭐ Quan trọng · Chưa đọc** (mở thẳng bằng `#inbox/work`…). Tin Jira/Bitbucket hiện thêm dòng ticket: mã (bấm để chép) · trạng thái theo tông màu · sự kiện. Danh sách hàng `.h-row` (lưới `42px 1fr auto`, nền `--soft`, bo 16): ô emoji cảm xúc tròn · tiêu đề đậm + nội dung muted · bên phải "app · giờ · lý do" + nút **👥 Xếp nhóm** (với tin chat), "Mở ↗", ✕. Tin đã đọc mờ 55%. Đầu trang: "Đánh dấu đã đọc tất cả", "Xoá hết".

### 6.6 🔌 Kết nối
* Thẻ **🍎 Thay thế thông báo của máy Mac**: 2 bước có vòng tích xanh lá to (Cho phép thú cưng đọc thông báo · Không bao giờ thấy banner gốc), nút "↺ Hoàn tác".
* **📱 Ứng dụng của tôi**: lưới 2 cột thẻ app (logo 44px bo 14 · tên · pill trạng thái "● Đang hoạt động" xanh · dòng "🔔 Kiểm tra mỗi 2 phút" · nút "🔔 Chọn sự kiện" · ✕). Đầu panel: select chu kỳ, "🔔 Kiểm tra ngay", "↻ Cập nhật".
* **➕ Thêm ứng dụng**: ô tìm + danh mục ứng dụng phổ biến.

### 6.7 ⚙️ Cài đặt
🎨 Màu giao diện (6 vòng tròn gradient 46px, chọn = viền `p1` + nền `t1`) + công tắc "Thẻ thông báo dùng màu giao diện" · 🙈 Nội dung trên thẻ (4 thẻ lựa chọn: Đầy đủ / Che bớt / Chỉ tên app / Ẩn hoàn toàn, mỗi thẻ có ví dụ in nghiêng trong khung trắng) · 🌐 Chung (ngôn ngữ, mở cùng máy) · 🔒 Quyền riêng tư · 🧰 Nâng cao · 🐾 Giới thiệu.

### 6.8 📊 Theo dõi (chỉ chế độ nâng cao)
Sub-tab: 📈 Thống kê (ô số 28/900, thanh ngang theo cảm xúc) · 🔧 Kết nối kỹ thuật · 🎭 Quy tắc cảm xúc · 🧪 Công cụ.

---

## 7. Panel "👥 Người quen" (đã tối giản)

```
👥 Người quen  Chỉ cho bé ai là ai để bé phản ứng đúng
✨ Hay nhắn  (SK SBM - EBT…) (DA Dat) (MV Magnolia VN) (TU Tuyen) (PH Phuong)

① Ứng dụng
 (▣ Microsoft Teams ●) (Zalo ●) (Telegram ●) (Tin nhắn) (✏️ Nhập tên)

② Chọn cuộc chat   [Chat][Cuộc họp]                     [🔍 Tìm…      ] ↻
 💡 Zalo chưa cho bé xem danh sách chat — … Nhập tên để đặt thái độ cho họ.   (chỉ với app không có danh sách)
┌──────────────────────────────────────────────────────────────────────────┐
│ (MV👥) Magnolia VN            Nhóm · 16 tin bé đã gặp · 11:58   [8 người ▾]│
│ (BB👥) Badi Châu Báu          Nhóm · 10 tin · 11:57 [👨‍💻 Đồng nghiệp][5 người ▾]│
│ (MT)   Minh Tran              Chat riêng · 11:56                       ✓  │  ← dòng đang chọn: nền thương hiệu 10%
│        └ (khi mở nhóm) chip thành viên: (Chinh Nguyen)(✓ Hao Phan)(…)      │
└──────────────────────────────────────────────── cuộn, tải thêm khi kéo ─┘

③ Bé đối xử thế nào?                                   (Minh Tran · một người)
 (💕 Người yêu / Vợ chồng)(👨‍👩‍👧 Gia đình)(👨‍👩‍👦 Người thân)(👫 Bạn thân)(🤝 Bạn bè)
 (💼 Sếp / Quản lý)(👨‍💻 Đồng nghiệp)(🎓 Thầy cô)(⭐ Quan trọng)(✏️ Khác)(🔕 Bỏ qua)
 [✨ Cảm xúc theo quan hệ ▾] [Theo mối quan hệ ▾]                 [＋ Thêm]

Người quen (3)
 👨‍💻 Badi Châu Báu     ▣ Đồng nghiệp · cả nhóm · 💖 Yêu thương        ◉ ✎ ✕
 👨‍💻 Dat Le            ▣ Đồng nghiệp · 😴 Ngủ say                    ◉ ✎ ✕
────────────────────────────────────────────────────────────────────────────
▸ ⚙️ Tuỳ chọn thêm  giờ theo mối quan hệ · bé ghi nhớ        (thu gọn mặc định)
   ⏰ Giờ theo mối quan hệ — mỗi quan hệ 1 dòng: [◯ Giờ riêng] (hiện ô giờ khi bật) [◯ Báo cả giờ yên tĩnh] [◯ Luôn vào Hộp thư]
   🧠 Bé ghi nhớ — [Nhớ tên người gửi & tên nhóm ◉] [Quen dần với thói quen nhắn tin ◉] · 🧹 Quên danh sách đã gặp (link, có hộp xác nhận)
```

Quy tắc hiển thị:
* Số thứ tự bước: vòng 22px gradient thương hiệu, chữ trắng 12/800.
* Danh sách chat cao tối đa 300px, nền trắng, viền trong 1.5px `--line`, bo 14; hàng hover nền thương hiệu 6%; khi tìm kiếm phần khớp được **tô vàng** (`<mark>` màu `brand-2` 45%), dòng điều khiển bằng phím có viền 2px.
* Với nhóm: nút viên thuốc "N người ▾" (hoặc "Thành viên ▾"); khi đang tìm chỉ hiện thành viên khớp + link "+ N người khác".
* Không có ai được chọn → nút "＋ Thêm" mờ (disabled); không có ô "Chưa chọn ai".
* Người quen: mỗi người 1 dòng (emoji quan hệ trong vòng 30px · tên 13.5/800 · dòng phụ 11.5px), nút ✎ ✕ mờ 45% và rõ khi rê chuột; quy tắc tắt mờ 55%.
* Trống hoàn toàn → không hiện tiêu đề "Người quen" và không hiện danh sách.

---

## 8. Lớp phủ desktop

### 8.1 Dock (thú cưng + thẻ)

* Cửa sổ trong suốt phủ vùng làm việc; chuột xuyên qua trừ khi đang ở trên bé/thẻ.
* **Kích thước bé** `--pet`: 210px (nhỏ 170 · lớn 250; chế độ "minimal" 120) × hệ số "Kích thước bé". Đổ bóng `drop-shadow(0 10px 18px rgba(120,60,90,.18))`.
* **Vị trí:** 8 điểm neo (4 góc + giữa 4 cạnh; ô giữa lưới 3×3 là biểu tượng màn hình), lề 24px, hoặc vị trí kéo thả tự do. Ở cạnh phải thì thẻ nằm bên trái bé (và ngược lại).
* **3 kiểu mang thẻ:**
  * 🪧 **Ôm bảng (billboard)** — bé chồm 28% lên mép thẻ như đang giữ; thẻ nghiêng 9° về phía bé, "thở" theo nhịp của bé.
  * 👀 **Ló đầu (peeker)** — bé ló lên từ sau mép trên thẻ (xếp dọc), mắt dõi theo chuột.
  * ✉️ **Đưa thư (courier)** — bé chạy vào từ mép màn hình (0.45s), thẻ "mở ra" từ phong bì.
* **Bong bóng thoại** trên đầu bé: trắng, bo 16, chữ 13/800 `#4B3B47`, đuôi nhọn xoay 45°, tối đa 230px; tự dịch ngang để không tràn mép màn hình (đuôi vẫn chỉ vào bé). Biến thể giận `#FFE4E4/#B42318`, yêu `#FFE9F2/#C2185B`.
* **Số chưa đọc** trên bé: viên đỏ gradient `#FF5A5F→#E53945`, viền trắng 2px, chữ trắng 13/800, nảy khi tăng; bấm mở Hộp thư.

### 8.2 Thẻ thông báo 3D "acrylic"

```
╭──────────────────────────────────────────────╮  ← dải màu 5px gradient --c → --c2
│ [🧩 Jira] [🤔 Suy tư] [Quan trọng]       ✕   │  ← chip app · chip cảm xúc · chip ưu tiên
│ 🕒 12:05 · 05/11/2026                         │
│ Tiêu đề thẻ (16.5/900, ≤3 dòng)               │
│ Nội dung (13.5/600 muted, ≤5 dòng)            │
│ ──────────────────────────────────────────── │
│ [↗ Mở chat]  [Đá bay 🦶]                      │  ← nút chính màu --c · nút đá đỏ nhạt
│ Vuốt ve bé để bé vui hơn nha                  │  ← gợi ý 11.5px mờ
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░                         │  ← thanh thời gian 3.5px
╰──────────────────────────────────────────────╯
```
* Rộng theo nội dung: tối thiểu 82% của 320px (nhỏ 270 · lớn 380), tối đa 460px; thu phóng theo "Kích thước khung" (0.8–1.5×).
* Vỏ: bo 24, padding 18×20, nền gradient trắng → kem `rgba(255,236,228,.94)`, bóng đất sét 4 tầng (`edge1 #F6E1D8`, `edge2 #EBCDC1`) + bóng rơi `0 24px 44px -12px rgba(110,50,80,.42)`; quầng màu `--c` 22% góc phải trên; ánh sáng phản chiếu chạy theo chuột (soft-light).
* Chữ: `--text #3A2E39`, `--muted #7A6873`.
* Nút trên thẻ: padding 9×16, bo 13, chữ 13/800; nút chính gradient `--c` + bóng đặc đậm hơn 30%; **không nhích khi rê/nhấn** (tránh lỡ click) — chỉ đổi độ sáng. Nút **✅ Approve** xanh lá `#34C98A→#1FA571`; **bấm lần 1** đổi sang cam "Bấm lần nữa để approve" (4s), **bấm lần 2** mới gọi API.
* Ánh sáng theo chuột: quầng trắng 240px di chuyển bằng `translate3d` (1 lần/khung hình, không vẽ lại), chỉ hiện khi rê chuột. Thẻ "thở" theo bé bằng thuộc tính `translate` riêng (không dính transition).
* Ưu tiên: chip "Khẩn cấp" đỏ nhịp đập + viền đỏ quanh thẻ; "Quan trọng" vàng; "Thấp" xám.
* Nhiều mục (vd. nhiều PR): danh sách hàng trắng 75% bo 12, mỗi hàng có ↗ và Approve riêng, cuộn tối đa 300px, "+N mục nữa".
* **Thẻ "bực"** (cảm xúc khó chịu): rung nhẹ 3.2s/lần.

**Hiệu ứng:** xuất hiện xoay từ −24° X + trượt 28px + phóng 0.86→1 (0.5s, `cubic-bezier(.22,1.18,.36,1)`) · biến mất lật 55° X (0.3s) · thu phóng biến mất 1.06 (0.26s) · **đá bay**: xoay 560° văng chéo lên mép màn hình 0.8s.

### 8.3 Năm kiểu thẻ

| id | Tên | Nền | Đặc trưng |
|---|---|---|---|
| `pastel` | Pastel (mặc định) | gradient trắng→kem/hồng nhạt | bóng đất sét; khi theo màu giao diện, nền nhuộm theo theme |
| `minimal` | Trắng tối giản | `#FFFFFF` | viền `#E2E8F0`, bo 18, chữ `#1E293B`/`#64748B`, chip xám xanh |
| `dark` | Tối | `rgba(38,34,64,.96)→rgba(24,22,44,.95)` | chữ `#F5F0FF`/`#B8B0D6`, chip trong suốt 8% |
| `glass` | Kính mờ | trắng 72%→45% | viền trắng 85%, `backdrop-filter: blur(18px) saturate(1.6)` |
| `acrylic` | Trong suốt | trắng 32% | viền trắng 65%, `blur(28px) saturate(1.8)` |

### 8.4 Thẻ Jira / Bitbucket (bố cục ticket)

```
[🧩 Jira] [🤔 Suy tư]
🕒 12:05 · 05/11/2026
📣 Lan Nguyen nhắc bạn                        ← dòng sự kiện 12.5/800, màu --c pha tối
[WB-128] Bug                                   ← mã ticket đơn cách nền #EEF3FF · loại muted
Sửa lỗi đăng nhập SSO trên Safari              ← tiêu đề (đã bỏ mã ở đầu)
(◑ In Review) (🔺 High) (#frontend) (#sso)      ← trạng thái theo tông · ưu tiên · nhãn
┃ @Anh xem giúp mình case redirect loop nhé     ← bình luận dạng trích dẫn, viền trái --c 45%
Giao bởi Lan Nguyen   Người tạo Minh Tran       ← người liên quan 11.5px, tên đậm
⎇ bugfix/sso-loop → main                       ← nhánh (Bitbucket), đơn cách
```
Tông trạng thái: `todo ○` xám · `progress ◐` xanh dương · `review ◑` tím · `done ●` xanh lá · `danger ■` đỏ (xem §3.4). Bitbucket thay "Bug" bằng "📦 tên-repo"; sự kiện mẫu: "🔍 Cần bạn review", "✅ X đã approve PR của bạn", "⛔ X yêu cầu sửa PR của bạn", "💬 X bình luận PR của bạn". Khi bật chế độ ẩn nội dung, toàn bộ phần ticket bị bỏ.

### 8.5 Menu chuột phải
* **Trên bé:** 🐾 Mở Control Center · 📥 Inbox (N chưa đọc) · 🌙 Không làm phiền ☑ · 🙈 Ẩn nội dung thông báo ☑ · 🙈 Ẩn thú cưng · ⏻ Thoát.
* **Trên thẻ tin nhắn:** "🐾 Xếp nhóm nhanh" → "👤 *Tên* là… ▸" / "👥 Cả nhóm *Tên nhóm* là… ▸" (11 quan hệ dạng radio + "✕ Không phải người quen") · "⚙️ Chỉnh chi tiết trong Người quen…". Menu hệ thống gốc của macOS/Windows.

---

## 9. Chuyển động

**Token (Control Center):** `--ease-out: cubic-bezier(.2,.8,.2,1)` (mặc định) · `--ease-spring: cubic-bezier(.3,1.35,.5,1)` (nảy nhẹ cho núm công tắc, toast, chọn) · `--dur-1: 120ms` (hover/nhấn; nhấn 60ms) · `--dur-2: 200ms` (đổi trạng thái nhỏ, modal) · `--dur-3: 260ms` (đổi trang, toast).

**Quy tắc mượt:** chỉ animate `transform` và `opacity` (đổi màu/bóng chỉ khi hover); **không bao giờ** `transition: all`; không animate `top/left/bottom/right/width/height`; animation lặp vô hạn chỉ dùng transform/opacity; lớp tĩnh nặng (đốm nền blur 70px) đặt trên compositor layer riêng (`translateZ(0)` + `contain: strict`).

| Hiệu ứng | Thời lượng | Easing |
|---|---|---|
| Đổi trang Control Center | 260ms (trượt 6px + mờ) | `--ease-out` |
| Hover / nhấn nút, chip | 120ms / 60ms | `--ease-out` |
| Công tắc | núm 260ms · rãnh 200ms | `--ease-spring` / `--ease-out` |
| Modal | nền 200ms + thẻ trượt 8px, scale .98→1 | `--ease-out` |
| Toast, "✓ Đã lưu", bong bóng xem trước | 260ms | `--ease-spring` |
| Chấm "Đang chạy" | vòng lan toả 2.2s (scale + opacity) | `--ease-out` |
| Minh hoạ Ló đầu / Đưa thư | 2.4s lặp (transform) | ease-in-out / `--ease-out` |
| Thẻ thông báo bật ra | 0.5s | `cubic-bezier(.22,1.18,.36,1)` |
| Thẻ thông báo biến mất | 0.26–0.3s | `cubic-bezier(.4,0,.9,.5)` |
| Bé "đưa thư" chạy vào | 0.45s | `cubic-bezier(.25,.8,.35,1)` |
| Bong bóng thoại của bé | 0.28s | `cubic-bezier(.22,1.25,.36,1)` |
| Đá thẻ bay | 0.8s | `cubic-bezier(.3,.1,.6,1)` |
| Hoạt họa 3D của bé | chuyển cảm xúc 0.18–0.35s, 60 FPS | AnimationController (riêng) |

**Giảm chuyển động:** Control Center theo cài đặt "🐢 Giảm chuyển động" (Theo máy / Luôn giảm / Không giảm → class `reduce-motion` / `allow-motion` trên `<html>`, mặc định theo `prefers-reduced-motion`): mọi animation/transition ≈ 0. Lớp phủ: thẻ không nghiêng, không "thở", không có ánh sáng theo chuột, tắt rung/nhịp đập, đá bay → mờ dần.

---

## 10. Trợ năng & tương tác

* Có viền focus rõ (`outline 2.5px var(--brand)`, cách 2px) trên **mọi** nút, link, ô nhập, `summary` khi điều khiển bằng bàn phím (`:focus-visible`).
* Vai trò ARIA: chip app `role=tab`, chip quan hệ `role=radio`, danh sách chat `role=listbox` + `aria-selected`, số kết quả `aria-live=polite`.
* Bàn phím trong ô tìm: **↑ ↓** di chuyển · **Enter** chọn · **Esc** xoá tìm kiếm / huỷ sửa; Enter trong ô nhập tên = Thêm.
* Không dựa vào màu đơn thuần: trạng thái ticket có ký hiệu ○ ◐ ◑ ● ■, quan hệ có emoji, mục chọn có dấu ✓.
* Chữ tối thiểu 11px; nội dung chính 13.5px trở lên.

---

## 11. Giọng văn & nội dung

* Xưng hô: **"bé"** (thú cưng) — **"bạn"** (người dùng). Ví dụ: *"Bé ghi nhớ tên người gửi"*, *"Bạn vẫn có thể tự nhập tên."*
* Nhãn ngắn, động từ trước: *"＋ Thêm"*, *"Kết nối"*, *"Thử lại"*, *"Quên danh sách đã gặp"*.
* **Không** dùng chữ kỹ thuật trên UI người dùng (API, Graph, HTTP, token, OAuth…). Lỗi viết thành hành động: *"Teams chưa trả về danh sách — thử lại sau ít phút."*
* Gợi ý/mẹo đi kèm 💡; cảnh báo ⚠️; riêng tư luôn nói rõ *"chỉ lưu tên, không lưu nội dung tin nhắn"*.
* Emoji đầu tiêu đề panel: 💖 Thái độ · 👥 Người quen · 🎭 Cảm xúc · 🎵 Âm thanh · 🪧 Cách mang thẻ · 🎨 Kiểu/Màu · 📍 Vị trí · 💬 Tin nhắn · 🙈 Nội dung trên thẻ · 🔒 Riêng tư · 📱 Ứng dụng · ➕ Thêm.
* Song ngữ VI/EN: UI viết bằng tiếng Việt, tiếng Anh được dịch tự động qua từ điển (`src/control/i18n.js`); phần Người quen mới chưa có bản dịch.

---

## 12. Quy tắc khi thêm UI mới

1. **Chỉ dùng token** (`--panel`, `--ink*`, `--brand*`, `--p*`, `--t*`, `--soft*`, `--edge*`, `--line`, `--ok/--warn/--err`) để tự đổi theo 6 theme, kể cả theme tối.
2. Một ý chính mỗi panel; thứ ít dùng → `<details>` thu gọn.
3. Nút chính tối đa **một** trên mỗi khu vực; còn lại dùng ghost/link.
4. Không thêm dòng mô tả nếu tiêu đề đã đủ hiểu; mô tả ≤ 1 câu.
5. Mọi thao tác lưu tự động + huy hiệu "✓ Đã lưu"; thao tác xoá dữ liệu phải có modal xác nhận.
6. Kiểm tra: theme sáng + Đêm, cửa sổ hẹp (< 860px), Giảm chuyển động, chế độ ẩn nội dung.
7. **Tránh trùng tên class** (từng có lỗi: `.ct-more` dùng cho cả nút "N người" và khối tuỳ chọn) — đặt tiền tố theo khu vực (`ct-` = Người quen, `tk-` = ticket trên thẻ).
