# IMPLEMENTATION_STATUS — Trạng thái từng tính năng (Blueprint V3.2)

*Cập nhật: 03/11/2026 · Quy ước: `Completed` · `Partially Completed` · `Not Implemented` · `Blocked` · `Not Tested` · `Unsupported`*

## P0 — MVP

| Phase | Hạng mục | Trạng thái | Ghi chú / bằng chứng |
|---|---|---|---|
| 0 | Khảo sát & khả thi tích hợp | Completed | Bảng năng lực tích hợp, mô hình gateway, báo cáo bảo mật |
| 1 | Mèo Mochi: model 3D thật + rig + clip | **Partially Completed** | Rig procedural đầy đủ 8 cảm xúc. **Chưa có `model.glb` production** |
| 1 | Nạp GLB, semantic mapping theo `pet.json` | Completed (code) / Not Tested (GLB thật) | `semantic-map.js` + unit test |
| 2 | AnimationController trung tâm + 5 lớp | Completed | `animation-controller.js`, 8 test |
| 2 | Cross-fade 0.18–0.35 s, không pose pop/jitter | Completed (procedural) | ANIMATION_QUALITY_REPORT §2 |
| 2 | Bảo vệ dt khi suspend/resume | Completed | Test + `powerMonitor.resume` |
| 2 | Fallback khi thiếu clip | Completed (code) / Not Tested (GLB) | |
| 2 | 60 FPS | Completed | 74.9 FPS avg, p95 14.3 ms trên M2 |
| 2 | Emotion Engine 5 preset + rule 5 tầng | Completed | Đã có từ trước, giữ nguyên |
| 3 | 4 mức ưu tiên, cooldown, dedupe, gom chùm, hàng đợi | Completed | `attention-engine.js`, test + E2E (M3) |
| 3 | Inbox bền + Digest | Completed | `inbox-store.js`, Control Center → Sự chú ý & Inbox |
| 3 | Idempotency theo event ID | Completed | Pipeline + gateway |
| 4 | Presence Full / Minimal / Hidden | Completed | E2E M5 (Hidden: 0 frame) |
| 4 | 6 Focus Modes (+ "Bình thường") | Completed | E2E M4 (Meeting) |
| 4 | Gaming Mode tự phát hiện app toàn màn hình | Not Implemented | Không có API công khai. Hiện bật thủ công |
| 4 | Quick controls (tray) | Completed | Menu khay: Hiện diện, Chế độ tập trung, Inbox, DND |
| 5 | Billboard / Peeker / Courier | Completed | Đã có, giữ nguyên |
| 5 | 5 theme thẻ | Completed | Pastel, Minimal White, Dark, Glass, Acrylic |
| 5 | Kéo thả tự do + lưu vị trí + đặt lại | Completed | Đã sửa lỗi tràn màn hình và lỗi `sound.pop` khiến vị trí không được lưu |
| 5 | Phản ứng nhấc bổng `isGrabbed` + tiếp đất | Completed | Đã chuyển sang controller (blend 0.18 s / 0.25 s, mặt được khôi phục) |
| 5 | Kick xoay 360° | Completed | |
| 6 | ≥ 1 kênh Native OS thật | Partially Completed | `powerMonitor` thật, chưa ghi được sự kiện pin/nhiệt thật trong phiên đo |
| 6 | ≥ 1 kênh realtime push từ ứng dụng ngoài | **Blocked** | Cần tài khoản Composio/Slack + gateway HTTPS. Toàn bộ đường đi đã E2E trên localhost |
| 6 | Đo latency p50/p95 | Completed | PERFORMANCE_REPORT §3 |

## P1

| Phase | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 7 | Control Center 10 phân hệ | Completed | Thêm "Sự chú ý & Inbox" và "Tập trung & Hiện diện" |
| 7 | Control Center song ngữ | Partially Completed | Overlay có VI/EN, Control Center chỉ có VI |
| 8 | Boba, Cloud, Pip | Partially Completed | Rig procedural cho cả 3, chưa có model production |
| 9 | Slack (Socket Mode trực tiếp) | Not Tested | Code có, chưa có tài khoản |
| 9 | Composio / Slack Events qua Gateway | Completed (code + test) / Blocked (tài khoản thật) | |
| 9 | Gmail push, Calendar push, Graph, Notion trực tiếp | Not Implemented | Dùng Composio qua gateway hoặc ICS |
| 9 | Teams, Discord, Zalo, macOS NC, Windows Toast | Unsupported | Có lý do hiển thị trong UI |
| 10 | Calendar-aware Focus, Digest nâng cao | Not Implemented / Partially (Digest cơ bản) | |
| 11 | Reduced Motion | Completed | Setting + theo OS + theo chế độ |
| 11 | Hồi quy đa nền tảng (Windows) | Not Tested | |
| — | Đóng gói `.dmg` / `.exe` | Partially Completed | `electron-builder --mac --dir` chạy được (phiên trước), chưa ký số, chưa có icon |
