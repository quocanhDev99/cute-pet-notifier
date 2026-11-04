# IMPLEMENTATION_STATUS — Trạng thái từng tính năng

*Cập nhật: 04/11/2026 · Phiên bản 3.4.0 · Quy ước: ✅ Hoàn thành · 🟡 Một phần · ⏳ Chưa làm · ⛔ Không hỗ trợ · 🧪 Chưa kiểm thử thật*

## Lõi
| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Thú cưng 3D (4 nhân vật, rig tham số, AnimationController 5 lớp) | ✅ | Chưa có `model.glb` production (xem KNOWN_LIMITATIONS) |
| Emotion Engine 5 tầng + 5 tính cách | ✅ | |
| 🎭 Bé đọc cảm xúc từ nội dung (emoji, VI có/không dấu, EN, phủ định, cường độ) | ✅ | Ngay trên máy; có 3 mức nhạy và ô gõ thử |
| Pipeline: lọc, bỏ trùng, ưu tiên, gộp, hàng đợi | ✅ | |
| Attention: 4 mức ưu tiên, cooldown, tắt tiếng app, 7 chế độ tập trung, giờ yên tĩnh, Hộp thư | ✅ | |
| 💬 Chat: báo tất cả / chỉ khi nhắc tên hoặc @all, tin nhắn riêng 1-1 vẫn báo | ✅ | Với thông báo của máy, việc nhận ra tin 1-1 là đoán theo dạng tin |
| 🙈 Privacy Display Mode (4 mức, ẩn theo app, bật nhanh từ menu) | ✅ | Không tự phát hiện chia sẻ màn hình ⏳ |
| 💆 Nhắc nghỉ mắt (tính theo thời gian dùng máy thật, hoãn khi đang họp hoặc tập trung) | ✅ | |
| 🗣️ Giọng nói (nhắc nghỉ, nhấc bổng, thả xuống) | ✅ | Giọng của hệ thống; chỉ nói câu cố định |
| Control Center: 6 tab + Theo dõi, 6 màu giao diện (thẻ thông báo đổi theo), VI/EN | ✅ | |
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
| Windows Toast Listener | 🧪 | Chưa chạy thử trên Windows thật |
| Teams Graph / Zalo cá nhân | ⛔ | Thông báo của Teams/Zalo vẫn được bé mang tới qua Notification Center của macOS |

## Đã gỡ bỏ
- **YouTube Pet Video Frame (khung video thu nhỏ):** gỡ theo yêu cầu người dùng ngày 04/11/2026.
