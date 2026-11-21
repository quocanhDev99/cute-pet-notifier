# Implementation Guide — Control Center UI/UX v2.0 (100% Concept Match)

> **Bản đặc tả chi tiết 100% Concept Render:** Xem tại [MASTER_UIUX_SPEC_V2.md](MASTER_UIUX_SPEC_V2.md) và ảnh gốc [03_Full_Concept_Board.png](03_Full_Concept_Board.png).

## 1. Design Direction & Core Aesthetics
Phong cách **Pastel Glassmorphism kết hợp 3D Art-Toy mềm mại**. Thú cưng là tâm điểm cảm xúc. Toàn bộ các thẻ, ô lựa chọn, nút bấm và màu sắc tuân thủ nghiêm ngặt theo bản Concept Render Board:
- **Tone màu chủ đạo:** Tím Oải hương `#8B5CF6`, xanh da trời `#60A5FA`, đào hồng `#FF8E9C`, bạc hà `#4CC9A0`.
- **Hiệu ứng kính mờ:** `rgba(255, 255, 255, 0.78)` + `backdrop-filter: blur(18px)` + viền bán trong suốt `1px solid rgba(255, 255, 255, 0.65)`.
- **Bo góc mềm:** Cửa sổ 28px, Card 20px, Tile 16px, Pill 999px.

## 2. Ánh Xạ File Mã Nguồn (Code Mapping)
Toàn bộ mã nguồn giao diện Control Center được tập trung và quản lý tại:
- **HTML:** `src/control/index.html` (Khung vỏ sidebar 6 tabs, container `#main`, preview stage, modal/toast).
- **CSS:** `src/control/control.css` (Design tokens, glassmorphism layout, v5-card, 6 companion mode tiles, compact notification demo).
- **JavaScript:** `src/control/control.js` (State management, logic điều hướng 6 tabs, render các màn hình Trang chủ, Thú cưng, Thông báo, Hộp thư, Kết nối, Cài đặt).
- **Overlay Notification Card:** `src/renderer/js/renderer.js` & `src/renderer/css/style.css` (Thẻ compact 340px, bé bám góc trên).

## 3. Thứ Tự Triển Khai Chuẩn Xác (Recommended Step-by-Step Order)
1. **Sidebar & Khung Cửa Sổ:** Đảm bảo đúng 6 tabs (Trang chủ, Thú cưng, Thông báo, Hộp thư, Kết nối, Cài đặt), badge số `2` trên Hộp thư, và chấm xanh `🟢 Đang chạy`.
2. **Trang Chủ (Dashboard Grid):** Lời chào + thẻ giờ `12:29 ☀️`, Khung 3D Showcase có bục đệm tròn + nút `< Boba >`, Lưới 3×2 Chế độ đồng hành, Khối chọn chế độ thông báo (2 cards), Khối thống kê hôm nay (8 thông báo, 5 tác vụ, 2h 30m).
3. **Màn 1 — Thú cưng:** 4 card chọn thú cưng (Mochi, Boba, Cloud, Pip), 3D Stage trung tâm, panel tùy chỉnh bên phải (Thái độ, Kích thước 100%, Độ sinh động 1.0x, Âm thanh toggle).
4. **Màn 2 — Thông báo:** 2 card chọn nguồn, 3 card minh họa kiểu tương tác (Ôm bảng, Ló đầu, Đưa thư), 3 toggle switch.
5. **Màn 3 — Hộp thư:** 4 tab filter (Tất cả, Tin nhắn, Công việc, Quan trọng), danh sách notification rows, nút `✓ Đánh dấu đã đọc tất cả`.
6. **Màn 4 — Kết nối:** Danh sách ứng dụng GitHub, Gmail, Teams, Notion có toggle bật/tắt trực tiếp, nút `+ Thêm ứng dụng khác`.
7. **Màn 5 — Cài đặt:** 4 nút tròn chọn theme (Oải hương, Xanh biển, Bạc hà, Đêm), ngôn ngữ Tiếng Việt, toggle Khởi động & Giảm chuyển động, slider âm lượng 70%.
8. **Thẻ Overlay Compact & Chuỗi Hoạt Ảnh:** Thẻ rộng 340px, bé bám mép trên không che chữ/nút, chuỗi 6 bước: *Tiếp cận ➔ Bám vào ➔ Ló đầu ➔ Phản ứng ➔ Giữ bảng ➔ Rời đi*.

## 4. Nguyên Tắc An Toàn (Guardrails)
- Không tạo thêm controller song song; giữ nguyên trạng thái kết nối backend, attention engine và audio controller hiện hữu.
- Giữ vững tính năng: Giao diện tối giản hóa việc hiển thị nhưng vẫn đảm bảo toàn bộ dữ liệu nghiệp vụ hoạt động ổn định.
- Đảm bảo kiểm thử nghiệm thu đạt đầy đủ checklist trong [MASTER_UIUX_SPEC_V2.md](MASTER_UIUX_SPEC_V2.md).
