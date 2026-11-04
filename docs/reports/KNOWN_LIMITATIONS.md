# KNOWN_LIMITATIONS — Hạn chế còn tồn tại

*Cập nhật: 04/11/2026 · v3.4.0. Danh sách công khai để người dùng và đội ngũ nắm rõ.*

## Nhân vật & hoạt họa
1. **Chưa có `model.glb` production cho nhân vật nào.** Cả 4 nhân vật đang chạy bằng rig procedural. Đường nạp GLB đã có, nhưng chưa thử với một file GLB thật.

## Thay thông báo của macOS
2. **Dùng giao diện không công khai của Apple.** App đọc kho thông báo và dùng Accessibility cho banner. Một bản nâng cấp macOS có thể làm hỏng tính năng này.
3. **Khi bật Focus của macOS:** macOS không hiện banner, nên app chỉ đọc được kho thông báo (trễ khoảng 5 giây).
4. **Một số app tự bật lại banner gốc** sau khi đã tắt (Chrome, Brave, Tin nhắn). Cần tắt tay trong *Cài đặt → Thông báo*.
5. **Bấm thẻ mở đúng cuộc chat** chỉ chắc chắn ở chế độ bắt banner tức thì (đã cấp quyền Trợ năng). Ở chế độ đọc kho thông báo, chỉ Teams và Slack có thông tin để mở đúng chat.
6. **App chưa có chứng chỉ Apple Developer.** App được ký bằng chứng chỉ tự ký nên quyền giữ được qua các bản cập nhật trên máy này. Khi cài trên máy khác, Gatekeeper vẫn cảnh báo (chuột phải → Mở).

## Chat & cảm xúc
7. **Tin nhắn riêng 1-1 với thông báo của máy là đoán** (dạng "Người gửi: nội dung" thường là tin nhóm). Slack thì biết chính xác.
8. **Đọc cảm xúc dựa trên từ điển và emoji, không phải AI.** Câu mỉa mai hay câu mơ hồ có thể bị đoán sai. Không đủ chắc thì bé giữ cảm xúc mặc định.
9. **Giọng nói dùng giọng của hệ thống.** Chất lượng tùy máy, tiếng Việt là giọng "Linh". Bé không bao giờ đọc nội dung thông báo.

## Kết nối
10. **Composio Connect (`ck_`) không có trigger**, nên Gmail, Jira, Bitbucket… là **kiểm tra định kỳ** (mặc định 2 phút) chứ không tức thì. Mỗi lần kiểm tra là một lượt gọi công cụ của Composio, có thể tính phí theo gói của bạn.
11. **Bitbucket:** chỉ quét 25 repo cập nhật gần nhất. Nếu có 2 tài khoản Bitbucket trong Composio thì dùng tài khoản mặc định. Approve thật từ thẻ chưa được xác nhận trên tài khoản thật.
12. **Jira:** "giao bởi" chỉ có khi Jira ghi lại lần giao việc. Việc được tạo ra đã gán sẵn cho bạn thì hiện "không có thông tin". Chưa báo khi bạn bị gỡ khỏi một việc.
13. **Outlook, Lịch Google, GitHub qua Composio** chưa được kiểm tra với tài khoản thật.

## Riêng tư
14. **Không tự phát hiện chia sẻ màn hình** (Electron không có API công khai), nên dùng lối tắt "🙈 Ẩn nội dung thông báo".
15. **Nội dung vẫn tới máy trước khi bị ẩn.** Nội dung đi qua macOS Notification Center, Composio (đám mây) hoặc Gateway rồi mới bị ẩn trên máy. Cảm xúc của bé vẫn được suy ra từ nội dung.

## Windows
16. **Chưa chạy thử trên máy Windows thật** (Toast Listener, khay hệ thống, đóng gói).
