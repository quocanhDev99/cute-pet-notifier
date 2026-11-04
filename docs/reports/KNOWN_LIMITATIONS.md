# KNOWN_LIMITATIONS — Hạn chế còn tồn tại

*Cập nhật: 04/11/2026 · v3.4.2. Danh sách công khai để người dùng và đội ngũ nắm rõ.*

## Nhân vật & hoạt họa
1. **Chưa có `model.glb` production cho nhân vật nào.** Cả 4 nhân vật đang chạy bằng rig procedural. Đường nạp GLB đã có, nhưng chưa thử với một file GLB thật.

## Thay thông báo của macOS
2. **Dùng giao diện không công khai của Apple.** App đọc kho thông báo và dùng Accessibility cho banner. Một bản nâng cấp macOS có thể làm hỏng tính năng này.
3. **Khi bật Focus của macOS:** macOS không hiện banner, nên app chỉ đọc được kho thông báo (trễ khoảng 5 giây).
4. **Một số app tự bật lại banner gốc** sau khi đã tắt (Chrome, Brave, Tin nhắn). Cần tắt tay trong *Cài đặt → Thông báo*.
5. **Bấm thẻ mở đúng cuộc chat** chỉ chắc chắn ở chế độ bắt banner tức thì (đã cấp quyền Trợ năng). Ở chế độ đọc kho thông báo, chỉ Teams và Slack có thông tin để mở đúng chat.
6. **App chưa có chứng chỉ Apple Developer.** App được ký bằng chứng chỉ tự ký nên quyền giữ được qua các bản cập nhật trên máy này. Khi cài trên máy khác, Gatekeeper vẫn cảnh báo (*Quyền riêng tư & Bảo mật → Open Anyway*, xem INSTALL.md).

## Hiệu năng
17. **Cài nhầm bản Intel (`-x64`) trên máy chip Apple** làm hoạt họa rất chậm, giật (Rosetta; đo được khựng 2–5 giây). App cảnh báo khi mở và trên Trang chủ. Trên Apple M2, bản `-arm64` chạy ổn định ~73 khung hình/giây (màn hình 75 Hz), không có khung khựng khi thẻ hiện.
18. **Thẻ hiện lần lượt từng cái.** Thẻ tới khi bé đang cầm thẻ khác sẽ chờ thẻ trước đóng, nên có thể trông như "trễ".
19. **Độ trễ theo nguồn:** chưa cấp quyền Trợ năng thì thông báo của máy trễ khoảng 5 giây; Gmail/Jira/Bitbucket qua Composio là kiểm tra định kỳ (mặc định 2 phút).

## Chat & cảm xúc
7. **Tin nhắn riêng 1-1 với thông báo của máy là đoán** theo dạng tin: tiêu đề là tên nhóm/#kênh, hoặc nội dung "Người gửi: …" thì là tin nhóm. Nhóm chỉ có tên thường (vd "Ban A, Ban B") mà app không ghi người gửi có thể bị coi là 1-1. Slack thì biết chính xác.
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
16. **Đã chạy trên Windows 11 thật (04/11/2026):** Toast Listener, tắt banner + âm thanh gốc, đóng gói NSIS. Khay hệ thống chưa kiểm kỹ.
17. **Thay thế thông báo Windows chỉnh registry của người dùng** (`HKCU…NotificationsSettings`: `ShowBanner`, `SoundFile`, `NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND`). Giá trị gốc được sao lưu vào `%APPDATA%Cute Pet Companionwindows-banners.json` và khôi phục khi tắt tính năng / thoát app / lần mở sau nếu app bị crash. **Gỡ app khi app đang chạy có thể để banner tắt** — hãy tắt "Thay thế thông báo của Windows" trước khi gỡ.
18. **Âm thanh gốc của Windows được tắt bằng giá trị registry giống Windows Settings, nhưng chưa nghe thử bằng tai** trên mọi bản Windows.
19. **Ứng dụng mới gửi thông báo lần đầu** có thể hiện banner gốc một lần (rất nhanh) trước khi app kịp tắt banner cho nó.

24. **Windows: "Mở app" mở đúng ứng dụng nhưng không mở đúng cuộc chat.** App lấy ID ứng dụng (AUMID) của thông báo rồi đưa app đó lên trên cùng, ví dụ Zalo hiện ở cuộc chat bạn đang mở dở. Windows không có API cho app khác kích hoạt thông báo của Zalo/Teams, nên không làm được như macOS (bấm hộ vào banner thật). Thông báo từ web (Chrome/Edge) không mở đúng trang.

## Người quen
20. **Người quen khớp theo tên chính xác** (không phân biệt dấu/hoa thường). Tên hiển thị khác trong thông báo (vd. biệt danh) cần thêm đúng tên đó. Với tin nhóm, chỉ nhận ra khi app ghi dạng "Tên: nội dung".
