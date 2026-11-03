/** Sample notifications for the 8 canonical emotions (tray, Control Center, CLI tests). */
const SAMPLE_NOTIFICATIONS = {
  happy: { title: '✅ Tác vụ hoàn thành', message: 'Deploy bản cập nhật Cute Pet Companion v2.0 lên Production thành công!', app: 'github', event: 'TASK_DONE' },
  excited: { title: '💬 Tin nhắn mới', message: 'Alo bạn ơi, bản thiết kế 3D Mèo Mochi nhìn xinh xỉu luôn!', app: 'slack', event: 'NEW_PING' },
  love: { title: '💰 LƯƠNG ĐÃ VỀ TÀI KHOẢN!', message: 'Tài khoản +30,000,000 VND (Lương & Thưởng tháng này). Đi ăn thôi sen!', app: 'default', event: 'KUDOS' },
  surprised: { title: '⚡ CẢNH BÁO HỆ THỐNG', message: 'Nhiệt độ CPU tăng cao đột ngột, kiểm tra các tiến trình nền ngay!', app: 'default', event: 'WARNING' },
  angry: { title: '🔥 SẾP GỌI: DEADLINE 17H', message: 'Báo cáo tuần chưa nộp, Mèo Mochi đang dậm chân bốc khói nè!', app: 'slack', event: 'OVERDUE' },
  sad: { title: '❌ BUILD THẤT BẠI (500)', message: 'Pipeline CI/CD gặp sự cố tại bước unit test, Mochi buồn rũ rượi...', app: 'github', event: 'ERROR' },
  thinking: { title: '⏳ Đang xử lý dữ liệu...', message: 'Đang kết xuất mô hình 3D Mèo Mochi, đợi xíu nhé sen!', app: 'default', event: 'LOADING' },
  sleeping: { title: '💤 Lịch họp triền miên', message: 'Họp Sprint Review 90 phút. Mochi ngáp ngủ cuộn tròn...', app: 'calendar', event: 'IDLE_DND' }
};
module.exports = { SAMPLE_NOTIFICATIONS };
