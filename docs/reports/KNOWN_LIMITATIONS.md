# KNOWN_LIMITATIONS — Hạn chế còn tồn tại

*Cập nhật: 21/11/2026 · v3.7.0. Danh sách công khai để người dùng và đội ngũ nắm rõ. Lộ trình xử lý: `docs/BLUEPRINT.md` §12.*

## Nhân vật & hoạt họa
1. **Chưa có `model.glb` production cho nhân vật nào.** Cả 4 nhân vật đang chạy bằng rig procedural. Đường nạp GLB đã có, nhưng chưa thử với một file GLB thật.

## Thay thông báo của macOS
2. **Dùng giao diện không công khai của Apple.** App đọc kho thông báo và dùng Accessibility cho banner. Một bản nâng cấp macOS có thể làm hỏng tính năng này.
3. **Khi bật Focus của macOS:** macOS không hiện banner, nên app chỉ đọc được kho thông báo (trễ khoảng 5 giây).
4. **Một số app tự bật lại banner gốc** sau khi đã tắt (Chrome, Brave, Tin nhắn). Cần tắt tay trong *Cài đặt → Thông báo*.
5. **Bấm thẻ mở đúng cuộc chat** chỉ chắc chắn ở chế độ bắt banner tức thì (đã cấp quyền Trợ năng). Ở chế độ đọc kho thông báo, chỉ Teams và Slack có thông tin để mở đúng chat.
6. **App chưa có chứng chỉ Apple Developer.** App được ký bằng chứng chỉ tự ký nên quyền giữ được qua các bản cập nhật trên máy này. Khi cài trên máy khác, Gatekeeper vẫn cảnh báo (*Quyền riêng tư & Bảo mật → Open Anyway*, xem INSTALL.md).

## Hiệu năng
7. **Cài nhầm bản Intel (`-x64`) trên máy chip Apple** làm hoạt họa rất chậm, giật (Rosetta; đo được khựng 2–5 giây). App cảnh báo khi mở và trên Trang chủ. Trên Apple M2, bản `-arm64` chạy ổn định ~73 khung hình/giây (màn hình 75 Hz), không có khung khựng khi thẻ hiện.
8. **Thẻ hiện lần lượt từng cái.** Thẻ mới thay thẻ đang hiện sau tối thiểu 2,5 giây (thẻ bị thay vào Hộp thư); tin kém ưu tiên hơn thì chờ thẻ trước đóng.
9. **Độ trễ theo nguồn:** chưa cấp quyền Trợ năng thì thông báo của máy trễ khoảng 5 giây; Gmail/Jira/Bitbucket qua Composio là kiểm tra định kỳ (mặc định 2 phút).

## Âm thanh của bé
- **25 tiếng thật (CC0, Freesound) mới được chọn bằng phân tích phổ và độ ồn, chưa ai nghe duyệt bằng tai.** Nếu tiếng nào nghe không hợp, tắt *🎙️ Tiếng thật của bé* để quay về tiếng tổng hợp; nguồn từng file ở `art/{bé}/audio/SOURCES.json`.
- Nguồn là bản preview 128 kb/s của Freesound (bản gốc cần đăng nhập), đủ cho tiếng kêu ngắn nhưng chưa phải master 48 kHz/24-bit như Blueprint §8.5.
- Thỏ và cánh cụt thật ít kêu: tiếng của Cloud lấy từ chuột lang (guinea pig), của Pip từ đồ chơi chim cánh cụt kêu chít và gà con.

## Chat & cảm xúc
10. **Tin nhắn riêng 1-1 với thông báo của máy là đoán** theo dạng tin: tiêu đề là tên nhóm/#kênh, hoặc nội dung "Người gửi: …" thì là tin nhóm. Nhóm chỉ có tên thường (vd "Ban A, Ban B") mà app không ghi người gửi có thể bị coi là 1-1. Slack thì biết chính xác.
11. **Đọc cảm xúc dựa trên từ điển và emoji, không phải AI.** Câu mỉa mai hay câu mơ hồ có thể bị đoán sai. Không đủ chắc thì bé giữ cảm xúc mặc định.
12. **Giọng nói dùng giọng của hệ thống.** Chất lượng tùy máy, tiếng Việt là giọng "Linh". Bé không bao giờ đọc nội dung thông báo.

## Kết nối
13. **Composio Connect (`ck_`) không có trigger**, nên Gmail, Jira, Bitbucket… là **kiểm tra định kỳ** (mặc định 2 phút) chứ không tức thì. Mỗi lần kiểm tra là một lượt gọi công cụ của Composio, có thể tính phí theo gói của bạn.
14. **Bitbucket:** chỉ quét 25 repo cập nhật gần nhất. Nếu có 2 tài khoản Bitbucket trong Composio thì dùng tài khoản mặc định. Approve thật từ thẻ chưa được xác nhận trên tài khoản thật.
15. **Jira:** "giao bởi" chỉ có khi Jira ghi lại lần giao việc. Việc được tạo ra đã gán sẵn cho bạn thì hiện "không có thông tin". Chưa báo khi bạn bị gỡ khỏi một việc.
16. **Outlook, Lịch Google, GitHub qua Composio** chưa được kiểm tra với tài khoản thật.

## Riêng tư
17. **Không tự phát hiện chia sẻ màn hình** (Electron không có API công khai), nên dùng lối tắt "🙈 Ẩn nội dung thông báo".
18. **Nội dung vẫn tới máy trước khi bị ẩn.** Nội dung đi qua macOS Notification Center, Composio (đám mây) hoặc Gateway rồi mới bị ẩn trên máy. Cảm xúc của bé vẫn được suy ra từ nội dung.

## Windows
19. **Đã chạy trên Windows 11 thật (04/11/2026):** Toast Listener, tắt banner + âm thanh gốc, đóng gói NSIS. Khay hệ thống chưa kiểm kỹ.
20. **Thay thế thông báo Windows chỉnh registry của người dùng** (`HKCU…NotificationsSettings`: `ShowBanner`, `SoundFile`, `NOC_GLOBAL_SETTING_ALLOW_NOTIFICATION_SOUND`). Giá trị gốc được sao lưu vào `%APPDATA%Cute Pet Companionwindows-banners.json` và khôi phục khi tắt tính năng / thoát app / lần mở sau nếu app bị crash. Từ v3.6.0, trình gỡ cài đặt cũng khôi phục từ bản sao lưu này (hook NSIS `build/installer.nsh`; lệnh khôi phục đã kiểm trên khóa registry thử, **chưa chạy thử gỡ cài đặt thật**).
21. **Âm thanh gốc của Windows được tắt bằng giá trị registry giống Windows Settings, nhưng chưa nghe thử bằng tai** trên mọi bản Windows.
22. **Ứng dụng mới gửi thông báo lần đầu** có thể hiện banner gốc một lần (rất nhanh) trước khi app kịp tắt banner cho nó.

23. **Windows: "Mở app" mở đúng ứng dụng nhưng không mở đúng cuộc chat.** App lấy ID ứng dụng (AUMID) của thông báo rồi đưa app đó lên trên cùng, ví dụ Zalo hiện ở cuộc chat bạn đang mở dở. Windows không có API cho app khác kích hoạt thông báo của Zalo/Teams, nên không làm được như macOS (bấm hộ vào banner thật). Thông báo từ web (Chrome/Edge) không mở đúng trang.

## Chế độ "Giữ thông báo hệ thống + thú cưng" (Mode 1) — tạm tắt từ v3.8.2, "Sắp ra mắt"
- Đang tắt bằng một cờ trong code; người dùng đang ở Mode 1 được chuyển sang Mode 2 (thay banner gốc, có sao lưu + khôi phục). Các mục dưới đây mô tả Mode 1 khi được bật lại.
- **Vị trí banner hệ thống là ước lượng.** Không hệ điều hành nào cho app khác biết banner đang ở đâu. App coi vùng banner là góc dưới phải (Windows) / góc trên phải (macOS) của màn hình chính và dời bé + thẻ ra khỏi đó khi thẻ là của chính thông báo hệ thống. Banner xếp chồng nhiều hơn 2 cái hoặc thanh tác vụ đặt bên cạnh có thể vẫn bị che một phần.
- **Bé về chỗ cũ khi thẻ đóng**, trong khi banner gốc có thể còn hiện thêm vài giây.
- **Chế độ 1 bám mép toast theo kích thước toast mặc định của Windows 11** (rộng 364, cao ≈ 150). Toast cao hơn (nhiều dòng, có nút), hai toast chồng nhau, hay thanh tác vụ đặt bên cạnh/trên thì bé có thể không trùng đúng mép trên.
- **Chế độ 1 "chỉ có bé"**: bé ở cạnh vùng banner khoảng 6 giây (không biết chính xác banner còn hay đã tắt). Bấm vào bé là vuốt ve, không mở được banner — bấm vào chính banner của máy để mở tin.
- **Xem thử chế độ 1** dùng thông báo hệ thống của chính app; trên Windows bản chưa cài (chạy dev) thông báo có thể không hiện, khi đó chỉ thấy bé.
- **Pomodoro không lưu khi thoát app** (chủ ý); nhãn trong menu khay cập nhật theo phút.
- **macOS:** mới chặn nút "Thay thế tất cả" khi ở Mode B; chưa tự khôi phục banner đã tắt từ trước bằng nút đó và chưa kiểm trên máy Mac thật.
- **Chưa kiểm trên máy thật:** chuyển chế độ khi đang chạy (unit test + e2e overlay đã qua).

## Người quen
24. **Người quen khớp theo tên chính xác** (không phân biệt dấu/hoa thường). Tên hiển thị khác trong thông báo (vd. biệt danh) cần thêm đúng tên đó. Với tin nhóm, chỉ nhận ra khi app ghi dạng "Tên: nội dung".
