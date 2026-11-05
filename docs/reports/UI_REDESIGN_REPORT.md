# UI Redesign Report — V4 polish ("A Cozy Desktop Companion Studio")

_Ngày: 05/11/2026 · Áp dụng chọn lọc từ "MASTER UI/UX REDESIGN PROMPT V4.0" · Đặc tả đã cập nhật: `docs/UI_UX_SPEC.md`_

## 1. Phạm vi đã chọn

Prompt V4 rất rộng. Lượt này tập trung vào hai việc người dùng yêu cầu: **UI/UX tinh gọn hơn** và **chuyển động mượt, không giật**. Mọi thay đổi giữ nguyên nhận diện soft-3D-clay, chỉ dùng token sẵn có (cả 6 theme), và không bỏ tính năng nào.

| Mục trong prompt V4 | Trạng thái | Ghi chú |
|---|---|---|
| §14 Micro-interactions & motion timing | ✅ Làm | Token chuyển động, bỏ `transition: all`, chỉ animate transform/opacity. |
| §4.2 Clay dùng có chọn lọc | ✅ Làm | Panel dùng `--shadow-panel` nhẹ; `--clay` chỉ cho hero, thẻ nhân vật, nút chính. |
| §4.4 Bớt font-weight 900 | ✅ Làm | Tiêu đề/nhãn 800, mô tả 500–600, 900 chỉ cho số lớn. |
| §5.2 Sidebar 220–240px + chỉ báo bé đang dùng | ✅ Làm | 236px, icon menu nhẹ hơn, thêm "🐾 Bé Chó Boba". |
| §6 Dashboard: lời chào + thẻ trạng thái | ✅ Làm | "Chào bạn! Boba đang ở đây 🐾" + 4 thẻ trạng thái bấm được; bỏ khung Hộp thư/ứng dụng trùng lặp. |
| §10 Inbox: bộ lọc + thông tin ticket + Copy Key | ✅ Làm | Tất cả · Tin nhắn · Công việc · Quan trọng · Chưa đọc; mã ticket bấm để chép; trạng thái theo tông. |
| §10.2 Approve cần xác nhận | ✅ Làm | Bấm 2 lần (lần 1 đổi sang "Bấm lần nữa để approve", 4 giây). |
| §16 Focus bàn phím, Reduced Motion | ✅ Làm | `:focus-visible` toàn Control Center; cài đặt Giảm chuyển động áp dụng cả Control Center. |
| §8 Người quen tối giản | ✅ Đã có | Làm ở lượt trước (xem `FAMILIAR_CONTACTS_REPORT.md`). |
| §11 YouTube Pet Video Frame | ⛔ Không làm | Tính năng đã được **gỡ theo yêu cầu người dùng ngày 04/11/2026** (Blueprint Phase 11). Không tự thêm lại. |
| §4.1 Đổi bảng màu Peach | ⏸ Giữ nguyên | Màu đề xuất rất gần màu hiện tại; đổi sẽ lệch 5 theme còn lại. Token hiện tại đã đủ tương phản. |
| §12 Catalog kết nối (delivery mode, last event…) | ⏸ Để sau | Cần thêm dữ liệu từ backend; ngoài phạm vi "mượt + gọn". |
| §20 Bộ 6 tài liệu | ⏸ Gộp | Báo cáo này cùng `UI_UX_SPEC.md` (đặc tả + design system + component catalog). |

## 2. Nguyên nhân giật đã tìm và sửa

| # | Ở đâu | Nguyên nhân | Sửa |
|---|---|---|---|
| 1 | Thẻ thông báo (Ôm bảng) | Nhịp "thở" đổi `--breath` ~30 lần/giây nằm **trong** `transform`, mà `.card` có `transition: transform .25s` → mỗi lần đổi lại khởi động transition mới, thẻ "đuổi theo" chính nó. | Nhịp thở chuyển sang thuộc tính `translate` riêng (không có transition); `transform` chỉ còn cho xuất hiện/biến mất. |
| 2 | Thẻ thông báo | Ánh sáng theo chuột đổi vị trí `radial-gradient` + `mix-blend-mode: soft-light` mỗi sự kiện chuột → vẽ lại cả thẻ. | Quầng sáng là phần tử 240px di chuyển bằng `translate3d`, cập nhật tối đa 1 lần/khung hình (rAF), bỏ blend mode; chỉ hiện khi rê chuột. |
| 3 | Thẻ thông báo | Lớp compositor tạo trễ ở khung hình đầu khi bật ra. | `will-change: transform, opacity` + `backface-visibility: hidden`; easing xuất hiện/biến mất êm hơn, ngắn hơn. |
| 4 | Sidebar | Chấm "Đang chạy" animate `box-shadow` vô hạn → vẽ lại liên tục. | Vòng lan toả là pseudo-element animate `transform` + `opacity`. |
| 5 | Trang Thông báo → Hiển thị | Minh hoạ "Ló đầu"/"Đưa thư" animate `bottom` / `right` vô hạn → tính lại bố cục mỗi khung hình. | Đổi sang `transform`. |
| 6 | Toàn Control Center | `transition: .2s` (= mọi thuộc tính) trên segmented, tab, choice, theme… | Chỉ transform, opacity, màu nền, bóng, màu chữ, filter; 120ms. |
| 7 | Nền | Ba đốm blur 70px kích thước lớn. | Đặt trên layer riêng (`translateZ(0)` + `contain: strict`). |
| 8 | Đổi trang / modal | 0.35s hơi chậm; modal chỉ fade cả lớp. | Trang 260ms; modal: nền mờ dần + thẻ trượt 8px, scale .98→1 trong 200ms. |

## 3. Token mới

```css
--ease-out: cubic-bezier(.2,.8,.2,1);   --ease-spring: cubic-bezier(.3,1.35,.5,1);
--dur-1: 120ms;  --dur-2: 200ms;  --dur-3: 260ms;
--shadow-panel: 0 1px 0 rgba(255,255,255,.85) inset, 0 2px 0 var(--edge), 0 14px 30px -20px rgba(140,70,90,.28);
/* midnight: 0 1px 0 rgba(255,255,255,.05) inset, 0 2px 0 #110F17, 0 14px 30px -18px rgba(0,0,0,.6) */
```

## 4. File thay đổi

* `src/renderer/css/style.css`, `src/renderer/js/renderer.js` — thẻ: `translate` cho nhịp thở, quầng sáng rAF, easing mới, xác nhận Approve (`approveConfirm` VI/EN), Reduced Motion tắt nhịp thở + quầng sáng.
* `src/control/control.css` — khối "V4 polish pass" ở cuối file (token, bóng, chữ, sidebar, transition, live-dot, minh hoạ, modal, focus, thẻ trạng thái, bộ lọc Hộp thư, Reduced Motion).
* `src/control/control.js` — `statusCardsHtml()`, lời chào Trang chủ, bộ lọc Hộp thư (`INBOX_FILTERS`, deep link `#inbox/<filter>`), dòng ticket + Copy Key, chỉ báo bé, class Reduced Motion.
* `src/control/index.html` — thêm `#pet-pill` ở chân sidebar.
* `docs/UI_UX_SPEC.md` — cập nhật §1, §2, §3.1, §4, §6.1, §6.2, §6.5, §8.2, §9, §10.

## 5. Kiểm tra

* `npm test`: **108/109** đạt — lỗi còn lại là test trạng thái Windows listener có từ trước, không liên quan.
* App đóng gói, cài lại và mở Control Center trên Chrome: Trang chủ (lời chào, 4 thẻ trạng thái, chỉ báo bé), Hộp thư (bộ lọc), Thông báo → Hiển thị (minh hoạ chạy bằng transform) — hiển thị đúng. Một lỗi `Unauthorized` trong console đến từ tab mở trước khi app khởi động lại (token mới mỗi lần khởi động), không phải lỗi mới.
* **Chưa đo được bằng mắt trên desktop:** thẻ thông báo nằm trên cửa sổ trong suốt mà Terminal không có quyền ghi màn hình; độ mượt của nhịp thở / quầng sáng / xác nhận Approve cần người dùng xem trực tiếp. FPS chưa được đo lại bằng công cụ.

## 6. Giới hạn đã biết

* Chưa có bản dịch tiếng Anh cho chữ mới (lời chào, thẻ trạng thái, bộ lọc Hộp thư, Người quen).
* Bộ lọc "Tin nhắn" dựa trên loại/app của tin; tin chat từ app chưa được phân loại có thể nằm ở "Tất cả".
* Thẻ "việc Jira / PR cần xem" đếm tin **chưa đọc trong Hộp thư** từ Jira/Bitbucket/GitHub, không phải toàn bộ việc trên Jira.
