# KNOWN_LIMITATIONS — Hạn chế còn tồn tại

*Cập nhật: 03/11/2026. Danh sách công khai để người dùng và đội ngũ nắm rõ.*

## Nhân vật & hoạt họa
1. **Chưa có `model.glb` production cho nhân vật nào**, kể cả Mèo Mochi (Phase 1 yêu cầu model thật). Cả 4 nhân vật đang chạy bằng **rig procedural tham số**. Đường nạp GLB (semantic map, alias clip, morph, fallback) mới có unit test cho phần logic, **chưa chạy với một file GLB thật**.
2. **Chưa có ảnh tham chiếu 2D** (`assets/references`, `assets/sprites`).
3. **Cú giơ tay biên độ lớn** đạt tốc độ đỉnh 0.41–0.46 rad/frame ở 60 Hz (vẫn liên tục, có easing). Nếu thấy nhanh, có thể tăng profile `default`.
4. **Thỏ Cloud:** tai đã đổi thành ngắn và tròn theo BLUEPRINT V3.2 §2.3, trong khi BLENDER_GUIDE §1.2 vẫn ghi "tai dài dựng đứng". Hai tài liệu đang mâu thuẫn, cần chốt lại.

## Tích hợp
5. **Chưa có luồng realtime từ ứng dụng bên ngoài thật** (MVP Gate #9): chưa có tài khoản Composio/Slack thật và chưa có gateway HTTPS công khai. Gateway mới được kiểm chứng trên localhost với payload V3 tự ký.
6. **Gmail push (Pub/Sub), Google Calendar watch channel, Microsoft Graph (Outlook/Teams), Discord:** chưa triển khai.
7. **macOS Notification Center** dùng cơ sở dữ liệu nội bộ (không phải API công khai), theo lựa chọn của người dùng:
   - Có thể **ngừng hoạt động khi nâng cấp macOS**. Trên macOS 15+ cần cấp *Full Disk Access*.
   - Thú cưng hiện thông báo **trễ khoảng 5.4 s** so với banner gốc, vì macOS (`usernoted`) chỉ ghi DB sau khoảng 5.25 s.
   - **Banner gốc của macOS vẫn hiện**, trừ khi người dùng đặt kiểu thông báo của từng app là "Không có" trong Cài đặt Hệ thống. App không có quyền tắt banner của app khác.
   - **Windows Toast Listener** vẫn cần bản đóng gói MSIX.
8. **GitHub** là polling (≥ 60 s). **Calendar ICS** là scheduled sync (5–240 phút). UI ghi nhãn đúng như vậy.
9. **Gateway một người dùng:** chưa multi-tenant, chưa có UI OAuth/Connect Link cho Composio.

## Sự chú ý & hiện diện
10. **Gaming Mode chưa tự phát hiện ứng dụng toàn màn hình:** Electron không có API công khai cho việc này, người dùng phải bật thủ công.
11. **Calendar-aware Focus (Phase 10):** chưa có tự động chuyển sang Meeting khi đang có lịch họp.
12. **Phân loại `category`** (social/entertainment/promotion…) dựa trên tên app và từ khóa, có thể sai với app lạ. Người dùng có thể tắt tiếng từng app.

## Giao diện
13. **Song ngữ VI/EN:** chỉ áp dụng cho overlay (nút trên thẻ, nhãn cảm xúc, lời thoại thú cưng). **Control Center vẫn chỉ có Tiếng Việt.**
14. **5 theme thẻ** đã có. Riêng Glassmorphism/Acrylic dùng `backdrop-filter` nhưng **không làm mờ được cửa sổ bên dưới**: cửa sổ Electron trong suốt chỉ làm mờ nội dung trong chính trang của nó.

## Hiệu năng & nền tảng
15. **CPU lúc rảnh ≈ 1.8 % một lõi** (≈ 0.23 % toàn máy M2), chủ yếu là chi phí nền của Electron. Vòng render bằng 0 khi rảnh.
16. **Chưa chạy hồi quy trên Windows 10/11.** Bản đóng gói chưa có icon app, chưa ký số và notarize.
17. **Lần render đầu tiên sau khởi động** có thể trễ 0.4–1.9 s (khởi tạo WebGL/shader).
