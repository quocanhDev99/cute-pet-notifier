/**
 * Control Center i18n (VI → EN).
 * The UI is authored in Vietnamese; when English is selected, a MutationObserver translates
 * every rendered text node / placeholder / title through this dictionary, so dynamic parts
 * (adapter cards, toasts, inbox rows…) are covered too. Original text is remembered so that
 * switching back to Vietnamese restores it exactly.
 *
 * Not translated on purpose: user data (notification titles/bodies, keyword lists, inputs).
 */

const EN = {
  // ---------- navigation / shell
  'Thú cưng': 'Pets', 'Cảm xúc & Tính cách': 'Emotions & Personality', 'Thông báo': 'Notifications',
  'Sự chú ý & Inbox': 'Attention & Inbox', 'Tập trung & Hiện diện': 'Focus & Presence', 'Kết nối ứng dụng': 'App Connections',
  'Hiển thị & Vị trí': 'Display & Position', 'Âm thanh & Hoạt họa': 'Sounds & Animation', 'Quyền riêng tư & Cài đặt': 'Privacy & Settings',
  'Đang chạy trên desktop': 'Running on desktop', 'Đang kết nối…': 'Connecting…', 'Mất kết nối với app…': 'Lost connection to the app…',
  'Không làm phiền': 'Do Not Disturb', 'Thoát ứng dụng': 'Quit app', 'Tắt hẳn ứng dụng (thú cưng và máy chủ nội bộ)': 'Quit the app completely (pet and local server)',
  'Bình thường': 'Normal', 'Đã lưu': 'Saved', 'Đang tải Mochi…': 'Loading Mochi…',

  // ---------- dashboard
  'Xin chào sen! 👋': 'Hello there! 👋', 'Tổng quan thú cưng, cảm xúc hiện tại và thông báo trong phiên này.': 'Overview of your pet, its current emotion and this session’s notifications.',
  'Thú cưng đang hoạt động': 'Active pet', 'Sẵn sàng nhận tin': 'Ready for notifications', 'Đang không làm phiền': 'Do Not Disturb is on',
  'Chưa có thông báo': 'No notifications yet', 'Cảm xúc gần nhất:': 'Latest emotion:',
  'Đã nhận': 'Received', 'Đã hiển thị': 'Displayed', 'Gộp / trùng lặp': 'Grouped / duplicate', 'Ẩn do DND': 'Hidden by DND',
  'Gửi thông báo thử ra desktop': 'Send a test notification to the desktop', 'Phân bố cảm xúc': 'Emotion distribution', 'Kết nối': 'Connections',
  'Inbox & chế độ': 'Inbox & mode', 'Chưa đọc': 'Unread', 'Chế độ hiện tại': 'Current mode', 'Độ trễ đo thực tế': 'Measured latency',
  'Chưa có mẫu đo — gửi vài thông báo nhé.': 'No samples yet — send a few notifications.', 'Thông báo gần đây': 'Recent notifications',
  'Hàng đợi:': 'Queue:', 'Chưa có thông báo nào. Thử gửi một cái nhé! 🐾': 'No notifications yet. Try sending one! 🐾',
  'Đứng chờ (idle)': 'Idle', 'Vẫy tay': 'Wave', 'Vuốt ve': 'Pet', 'Đá': 'Kick', 'Thử trên desktop': 'Try on desktop',

  // ---------- emotions (labels + meanings)
  'Vui vẻ': 'Happy', 'Hào hứng': 'Excited', 'Yêu thương': 'Love', 'Bất ngờ': 'Surprised', 'Cáu kỉnh': 'Grumpy', 'Buồn bã': 'Sad', 'Suy tư': 'Thinking', 'Ngủ say': 'Sleeping', 'Ngủ': 'Sleep',
  'Hoàn thành tác vụ': 'Task done', 'Tin nhắn mới': 'New message', 'Khen ngợi / Lương về': 'Kudos / payday', 'Cảnh báo gấp': 'Urgent warning',
  'Deadline sát nút': 'Deadline close', 'Lỗi hệ thống': 'System error', 'Đang xử lý': 'Processing', 'Họp / Không làm phiền': 'Meeting / DND',
  'mặc định': 'default', 'né': 'dodge',

  // ---------- pets
  'Chọn nhân vật, xem trước 3D thời gian thực và nhập mô hình .glb từ Blender.': 'Choose a character, preview it live in 3D and import a .glb model from Blender.',
  'Mèo Mochi': 'Mochi the Cat', 'Chó Boba': 'Boba the Dog', 'Thỏ Cloud': 'Cloud the Bunny', 'Chim cánh cụt Pip': 'Pip the Penguin',
  'Chọn': 'Select', 'Đang dùng': 'In use', 'Nhập .glb': 'Import .glb', 'Xóa GLB': 'Remove GLB', 'Kế hoạch': 'Planned', 'Runtime procedural': 'Procedural runtime',
  'Rig procedural': 'Procedural rig', 'GLB tùy chỉnh': 'Custom GLB', 'GLB đi kèm': 'Bundled GLB',
  'Chuẩn gói nhân vật': 'Character package standard', 'Mỗi nhân vật dùng': 'Each character uses', '1 mô hình duy nhất': 'a single model',
  '+ khung xương + morph targets + animation clips. File': '+ skeleton + morph targets + animation clips. An imported', 'nhập vào sẽ được dùng thay cho rig procedural.': 'file replaces the procedural rig.',
  'Gốc tọa độ tại đáy bàn chân, mặt hướng': 'Origin at the feet, facing', ', cao 1.5–2.0 BU (tự chuẩn hóa).': ', 1.5–2.0 BU tall (auto-normalized).',
  'sẽ nhìn theo chuột.': 'follows the cursor.', '+ tên 8 cảm xúc.': '+ the 8 emotion names.', 'Morph targets đặt tên theo cảm xúc (': 'Morph targets named after emotions (',
  'hoặc': 'or', '…) sẽ tự blend.': '…) are blended automatically.', 'Xem chi tiết: docs/BLENDER_GUIDE.md': 'Details: docs/BLENDER_GUIDE.md',

  // ---------- emotions page
  'Emotion Engine độc lập với nhân vật — 5 preset tính cách, bộ quy tắc phân loại 5 tầng và xem trước 8 cảm xúc.': 'Character-independent Emotion Engine — 5 personality presets, a 5-level rule hierarchy and a live preview of the 8 emotions.',
  'Preset tính cách': 'Personality presets', 'Luôn chào đón, ưu tiên vui vẻ & yêu thương, rất thích được vuốt ve.': 'Always welcoming, favours happy & loving reactions, loves being petted.',
  'Hay cà khịa, lườm liếc xéo xắc với tin phiền phức.': 'Snarky, gives annoying notifications the side-eye.', 'Dễ nổi quạu, phản ứng cực mạnh với deadline và họp hành.': 'Easily grumpy, overreacts to deadlines and meetings.',
  'Điềm đạm, cử động chậm rãi, ưu tiên suy tư và vui vẻ nhẹ nhàng.': 'Calm and slow-moving, prefers thoughtful and gently happy reactions.', 'Tinh nghịch, nhảy nhót, tai và đuôi chuyển động nhanh nhẹn.': 'Playful and bouncy, with lively ears and tail.',
  'Thử bộ phân loại': 'Try the classifier', 'Gõ thử một thông báo để xem Emotion Engine chọn cảm xúc nào và vì sao.': 'Type a sample notification to see which emotion the engine picks and why.',
  'Tiêu đề (vd: Sếp nhắc deadline 17h)': 'Title (e.g. Boss reminds: deadline 5pm)', 'Nội dung': 'Message', 'Ứng dụng (slack, github, calendar…)': 'App (slack, github, calendar…)',
  'Kết quả sẽ hiện ở đây': 'Results appear here', 'Quy tắc tùy chỉnh': 'Custom rules', 'Theo ứng dụng': 'By app', 'Từ khóa': 'Keywords',
  'Metadata (priority, mood, event)': 'Metadata (priority, mood, event)', 'Mặc định theo tính cách': 'Personality default',
  'Thêm quy tắc': 'Add rule', 'Thêm': 'Add', 'Mặc định': 'Defaults', 'vd: jira, discord': 'e.g. jira, discord', '— không áp dụng —': '— none —',
  'Chưa có quy tắc nào. Ví dụ: nếu tiêu đề chứa "sếp" → angry.': 'No rules yet. Example: if the title contains "boss" → angry.',
  'Tiêu đề + nội dung': 'Title + message', 'Tiêu đề': 'Title', 'Ứng dụng': 'App', 'chứa': 'contains', 'bằng': 'equals', 'từ khóa / mẫu': 'keyword / pattern',
  'Hiện thẻ': 'Show card', 'Vào Inbox': 'To Inbox', 'tính cách đổi từ': 'personality changed it from', 'né tránh vuốt ve': 'dodges petting',

  // ---------- notifications page
  'Kiểu cầm thẻ, giao diện thẻ, vị trí trên màn hình và chống nghẽn hàng đợi.': 'How the card is held, card theme, on-screen position and queue control.',
  'Chế độ cầm thẻ': 'Presentation mode', 'Thú cưng đứng cạnh, một tay giữ mép thẻ acrylic, thẻ "thở" theo nhịp.': 'The pet stands beside the card holding its edge; the card “breathes” along.',
  'Ló đầu từ sau mép thẻ, gác hai tay lên viền, mắt dõi theo chuột.': 'Peeks over the card’s edge, paws on the rim, eyes following the cursor.',
  'Chạy vào từ mép màn hình mang phong bì, rồi bung thẻ thông báo.': 'Runs in from the screen edge carrying an envelope, then unfolds the card.',
  'Giao diện thẻ': 'Card theme', 'Nhỏ': 'Small', 'Vừa': 'Medium', 'Lớn': 'Large', 'Thời gian hiển thị': 'Display time',
  'Vị trí trên màn hình': 'Screen position', 'Chọn một trong 8 góc / mép. Khoảng cách viền chỉnh ở mục Hiển thị.': 'Pick one of 8 corners / edges. Edge margin is set under Display.',
  'Chống nghẽn hàng đợi': 'Queue control', 'Tối đa trong hàng đợi': 'Max queue size', 'Tin cũ ít quan trọng sẽ bị bỏ khi đầy': 'Old low-priority items move to the Inbox when full',
  'Bỏ trùng trong (giây)': 'Deduplicate within (seconds)', 'Cùng nguồn + tiêu đề + nội dung': 'Same source + title + message', 'Gộp khi ≥ N tin cùng app': 'Group when ≥ N from one app',
  'Hiển thị 1 thẻ tóm tắt': 'Show one summary card', 'Xóa hàng đợi': 'Clear queue', 'Ai được phép làm phiền?': 'Who may interrupt you?',
  'Mức ưu tiên, cooldown, tắt tiếng từng ứng dụng và Inbox nằm ở': 'Priorities, cooldown, per-app mute and the Inbox live in',
  'Chế độ hiện diện (Full / Minimal / Hidden), 6 chế độ tập trung và giờ yên tĩnh nằm ở': 'Presence (Full / Minimal / Hidden), the 6 focus modes and quiet hours live in',

  // ---------- attention page
  'Quản lý sự chú ý': 'Attention management', 'Chống mỏi thông báo: 4 mức ưu tiên, cooldown theo ứng dụng, gom chùm và hộp thư Inbox — không có gì bị mất khi bạn đang tập trung.': 'Fight notification fatigue: 4 priority levels, per-app cooldown, grouping and an Inbox — nothing is lost while you focus.',
  'Chính sách ưu tiên': 'Priority policy', 'Khẩn cấp': 'Critical', 'Quan trọng': 'Important', 'Ít quan trọng': 'Low',
  'Pin cạn, máy quá nhiệt, server sập → luôn được hiện, vượt mọi chế độ.': 'Battery dying, overheating, server down → always shown, bypasses every mode.',
  'Pin cạn, máy quá nhiệt, server sập → luôn được hiện.': 'Battery dying, overheating, server down → always shown.',
  'Tin nhắn riêng, @mention, lịch họp sắp tới.': 'Direct messages, @mentions, upcoming meetings.', 'Cập nhật thường ngày — tuân theo cooldown.': 'Everyday updates — subject to cooldown.',
  'Khuyến mãi, bản tin → thẳng vào Inbox.': 'Promotions, newsletters → straight to the Inbox.', 'Khuyến mãi, bản tin → vẫn hiện thẻ.': 'Promotions, newsletters → still shown.',
  'Tin khẩn cấp được vượt rào mọi chế độ': 'Critical notifications bypass every mode', 'Tin ít quan trọng vào Inbox, không bật thẻ': 'Low-priority notifications go to the Inbox, no card',
  'Cooldown & tắt tiếng ứng dụng': 'Cooldown & app mute', 'Tối đa số thẻ / ứng dụng': 'Max cards per app', 'Trong khoảng (giây)': 'Within (seconds)', '0 = tắt cooldown': '0 = cooldown off',
  'Ứng dụng đã tắt tiếng (vào thẳng Inbox)': 'Muted apps (go straight to the Inbox)', 'chưa đọc': 'unread', 'tin chưa đọc': 'unread',
  'Đánh dấu đã đọc': 'Mark all read', 'Xóa Inbox': 'Clear Inbox', 'Không có tin nào đang chờ 🎉': 'Nothing waiting 🎉', 'Inbox trống — không có tin nào bị giữ lại. 🐾': 'Inbox is empty — nothing held back. 🐾',
  'Thử chính sách với từng mức ưu tiên': 'Test the policy per priority', 'Gửi một thông báo thử qua pipeline thật (không bỏ qua Attention Engine) và cho biết nó được hiện hay vào Inbox.': 'Sends a test notification through the real pipeline (Attention Engine included) and tells you whether it was shown or went to the Inbox.',
  'Hiển thị': 'Shown', 'Ít quan trọng → Inbox': 'Low priority → Inbox', 'Quá nhiều tin cùng app (cooldown)': 'Too many from one app (cooldown)', 'App đã tắt tiếng': 'App muted',
  'Đang ẩn thú cưng': 'Pet hidden', 'Hiện tối giản': 'Minimal presence', 'Khẩn cấp — vượt rào': 'Critical — bypass', 'Hàng đợi đầy': 'Queue full', 'Thử nghiệm': 'Test', 'Mở ↗': 'Open ↗', 'Xóa': 'Delete',

  // ---------- focus page
  'Lệnh thủ công của bạn luôn có quyền cao nhất. Thú cưng không bao giờ ép bạn tương tác.': 'Your manual choice always wins. The pet never pressures you to interact.',
  'Đang áp dụng:': 'Active:', '(mặc định)': '(default)', '(bạn chọn)': '(your choice)', '(giờ yên tĩnh)': '(quiet hours)', '(Không làm phiền)': '(Do Not Disturb)',
  'Trạng thái hiện diện': 'Presence', 'Đồng hành toàn phần': 'Full companion', 'Ngồi ở góc màn hình, thở nhịp nhàng, dõi theo chuột, đón vuốt ve.': 'Sits in the corner, breathes, follows the cursor and welcomes petting.',
  'Tối giản': 'Minimal', 'Thu nhỏ, cuộn tròn ngủ ở góc; thẻ vẫn hiện nhưng chuyển động nhẹ.': 'Shrinks and naps in the corner; cards still show with gentle motion.',
  'Ẩn hoàn toàn': 'Hidden', 'Ẩn toàn bộ, ngừng render (0% GPU). Tin vào Inbox, trừ tin khẩn cấp.': 'Fully hidden, rendering stopped (0% GPU). Notifications go to the Inbox, except critical ones.',
  'Chế độ tập trung': 'Focus modes', 'Mọi tin bình thường trở lên được hiện.': 'Normal priority and above are shown.', 'Lọc tin mạng xã hội, giải trí, khuyến mãi.': 'Filters social, entertainment and promotions.',
  'Chỉ tin khẩn cấp; tắt âm thanh, giảm chuyển động.': 'Critical only; sound off, reduced motion.', 'Thú cưng ngủ; chỉ tin quan trọng trở lên, không âm thanh.': 'Pet sleeps; important and above only, no sound.',
  'Ẩn thú cưng & dừng WebGL (0%); tin khẩn vẫn được hiện.': 'Hides the pet & stops WebGL (0%); critical still shows.', 'Mọi tương tác, cả tin ít quan trọng.': 'Every interaction, even low-priority items.',
  'Im lặng tuyệt đối, chỉ tin khẩn cấp.': 'Total silence, critical only.', 'đầy đủ': 'full', 'giảm': 'reduced',
  'Không làm phiền & giờ yên tĩnh': 'Do Not Disturb & quiet hours', 'Bật Không làm phiền (= Sleep)': 'Turn on Do Not Disturb (= Sleep)', 'Áp dụng khi bạn không chọn chế độ tập trung nào khác.': 'Applies when no other focus mode is selected.',
  'Giờ yên tĩnh hằng ngày (tự bật Sleep)': 'Daily quiet hours (auto Sleep)', 'Từ': 'From', 'đến': 'to', 'Giới hạn hiện tại': 'Current limitations',
  'Gaming Mode cần bật thủ công: Electron không có API công khai để phát hiện ứng dụng khác đang toàn màn hình.': 'Gaming Mode must be turned on manually: Electron has no public API to detect other full-screen apps.',
  'Chế độ tự động theo lịch họp (Calendar-aware Focus) thuộc Phase 10 — chưa triển khai.': 'Calendar-aware Focus belongs to Phase 10 — not implemented yet.', 'Giảm chuyển động': 'Reduced motion',

  // ---------- connections
  'Chỉ dùng API chính thức, webhook và sự kiện hệ điều hành — không screen-scraping. Token được mã hóa bằng Keychain / DPAPI.': 'Official APIs, webhooks and OS events — no screen-scraping. Tokens are encrypted with Keychain / DPAPI.',
  'Đã kết nối': 'Connected', 'Chưa kết nối': 'Not connected', 'Cần xác thực': 'Needs authorization', 'Quyền hạn chế': 'Limited permission', 'Không hỗ trợ': 'Unsupported', 'Lỗi': 'Error',
  'Xử lý cục bộ': 'Processed locally', 'Qua Gateway đám mây của bạn': 'Via your cloud gateway', 'Hướng dẫn thiết lập': 'Setup guide',
  'Lưu & kết nối': 'Save & connect', 'Lưu & kết nối lại': 'Save & reconnect', 'Ngắt kết nối': 'Disconnect', 'Xóa token': 'Delete token', 'đã lưu': 'saved',
  'Đã mở Cài đặt Hệ thống': 'Opened System Settings',
  'Windows Toast Listener (thay thế thông báo hệ thống)': 'Windows Toast Listener (replace system notifications)',
  'Bắt thông báo của MỌI ứng dụng trên Windows (Zalo, Teams, Outlook, Chrome, Telegram…) qua WinRT và để thú cưng mang tới thay cho toast mặc định.': 'Captures notifications from EVERY Windows app (Zalo, Teams, Outlook, Chrome, Telegram…) via WinRT and delivers them via the pet instead of the default toasts.',
  '⚙️ Mở Cài đặt Thông báo của Windows': '⚙️ Open Windows Notification Settings',
  '🔐 Mở Cài đặt Quyền riêng tư Thông báo': '🔐 Open Windows Notification Privacy Settings',
  '🔐 Mở Cài đặt Trợ năng (Accessibility - để tự đóng banner gốc)': '🔐 Open Accessibility Settings (to auto-dismiss native banners)',
  'Webhook nội bộ': 'Local webhook', 'Mọi script, CI, Zapier-local, Shortcuts, n8n… có thể POST tới http://127.0.0.1:3721/notify': 'Any script, CI, Shortcuts, n8n… can POST to http://127.0.0.1:3721/notify',
  'Webhook secret (tùy chọn)': 'Webhook secret (optional)', 'để trống = không yêu cầu': 'leave empty = not required', 'Lắng nghe 127.0.0.1:3721': 'Listening on 127.0.0.1:3721',
  'Payload JSON: {"title","message","app","url","priority":"critical|important|normal|low","category","sourceEventId","sourceCreatedAt"}. Nếu bật secret, gửi header "X-Pet-Secret". Người gửi chủ động đẩy (push) tới máy này.': 'JSON payload: {"title","message","app","url","priority":"critical|important|normal|low","category","sourceEventId","sourceCreatedAt"}. If a secret is set, send the "X-Pet-Secret" header. The sender pushes to this machine.',
  'macOS Notification Center (thay thế thông báo hệ thống)': 'macOS Notification Center (replace system notifications)',
  'Bắt thông báo của MỌI ứng dụng trên Mac (Zalo, Messenger, Mail, Slack, Lịch…) và để thú cưng mang tới thay cho banner mặc định.': 'Captures notifications from EVERY Mac app (Zalo, Messenger, Mail, Slack, Calendar…) and lets the pet deliver them instead of the default banners.',
  'Chỉ đọc cơ sở dữ liệu Notification Center có sẵn trên máy bạn, xử lý cục bộ. Đây KHÔNG phải API công khai của Apple: có thể ngừng hoạt động sau khi nâng cấp macOS. Để tắt banner gốc: Cài đặt Hệ thống → Thông báo → chọn từng app → Kiểu thông báo "Không có", vẫn BẬT "Hiển thị trong Trung tâm thông báo".': 'Reads (read-only) the Notification Center database already on your Mac and processes it locally. This is NOT a public Apple API and may stop working after a macOS update. To hide the original banners: System Settings → Notifications → each app → Alert style "None", while keeping "Show in Notification Center" ON.',
  'Bỏ qua Slack khi đã kết nối Slack trực tiếp (tránh trùng)': 'Skip Slack when Slack is connected directly (avoid duplicates)', 'Bỏ qua thông báo hệ thống của Apple (cập nhật, Screen Time…)': 'Skip Apple system notifications (updates, Screen Time…)',
  'Mở Cài đặt Thông báo của macOS (tắt banner gốc)': 'Open macOS Notification settings (turn off original banners)', 'Mở cài đặt Full Disk Access (macOS 15+)': 'Open Full Disk Access settings (macOS 15+)',
  'Hệ thống (macOS / Windows)': 'System (macOS / Windows)', 'Sự kiện thật từ hệ điều hành: pin yếu, cắm/rút sạc, mở khóa màn hình, máy quá nhiệt.': 'Real OS events: low battery, plug/unplug, screen unlock, overheating.',
  'Dùng Electron powerMonitor và Battery API của Chromium — không cần quyền đặc biệt.': 'Uses Electron powerMonitor and Chromium’s Battery API — no special permission needed.',
  'Cảnh báo pin (≤20%, ≤10%) & sạc': 'Battery alerts (≤20%, ≤10%) & charging', 'Chào khi mở khóa màn hình': 'Greet when the screen unlocks', 'Cảnh báo máy quá nhiệt': 'Overheating alerts',
  'Đang lắng nghe sự kiện nguồn & màn hình': 'Listening to power & screen events',
  'Thông báo PR, review, @mention, CI từ GitHub Notifications API.': 'PRs, reviews, @mentions and CI from the GitHub Notifications API.',
  'Tạo Personal Access Token (classic) tại github.com/settings/tokens với scope "notifications" (thêm "repo" nếu muốn đọc repo private). GitHub không có push cho Notifications API → đây là near real-time polling.': 'Create a classic Personal Access Token at github.com/settings/tokens with the "notifications" scope ("repo" for private repos). GitHub has no push for the Notifications API → this is near real-time polling.',
  'Chỉ thread tôi tham gia': 'Only threads I participate in', 'Chu kỳ kiểm tra (giây, ≥60)': 'Check interval (seconds, ≥60)',
  'Google / Outlook Calendar (iCal)': 'Google / Outlook Calendar (iCal)', 'Nhắc lịch họp trước giờ bắt đầu từ link iCal bí mật của bạn.': 'Reminds you before meetings using your secret iCal link.',
  'Google Calendar → Cài đặt lịch → "Địa chỉ bí mật ở định dạng iCal". Outlook → Cài đặt → Lịch → Lịch đã chia sẻ → Xuất bản → ICS. Lịch được đồng bộ theo chu kỳ (scheduled sync), nhắc họp chạy cục bộ mỗi 30s.': 'Google Calendar → calendar settings → "Secret address in iCal format". Outlook → Settings → Calendar → Shared calendars → Publish → ICS. The calendar syncs periodically (scheduled sync); reminders run locally every 30s.',
  'Link iCal bí mật (https://…/basic.ics)': 'Secret iCal link (https://…/basic.ics)', 'Nhắc trước (phút)': 'Remind before (minutes)', 'Đồng bộ lịch mỗi (phút)': 'Sync calendar every (minutes)',
  'Tin nhắn trực tiếp & @mention qua Slack Socket Mode (WebSocket chính thức).': 'Direct messages & @mentions via Slack Socket Mode (official WebSocket).',
  'api.slack.com/apps → Create App → bật Socket Mode (tạo App-Level Token scope connections:write) → Event Subscriptions: app_mention, message.im → Install vào workspace → copy Bot Token. Socket Mode là kênh push chính thức của Slack (không cần public URL).': 'api.slack.com/apps → Create App → enable Socket Mode (App-Level Token with connections:write) → Event Subscriptions: app_mention, message.im → Install to workspace → copy the Bot Token. Socket Mode is Slack’s official push channel (no public URL needed).',
  'Báo khi': 'Notify on', '@mention + tin nhắn trực tiếp': '@mentions + direct messages', 'Chỉ tin nhắn trực tiếp': 'Direct messages only', 'Mọi tin nhắn bot nhìn thấy': 'Every message the bot can see',
  'Cloud Integration Gateway (Composio · Slack Events · HMAC)': 'Cloud Integration Gateway (Composio · Slack Events · HMAC)',
  'Nhận sự kiện realtime từ Composio triggers, Slack Events API hoặc webhook có chữ ký qua Gateway HTTPS của riêng bạn. Desktop chủ động kết nối ra ngoài — không mở cổng.': 'Receives realtime events from Composio triggers, the Slack Events API or signed webhooks through your own HTTPS gateway. The desktop connects outward — no open ports.',
  'Triển khai thư mục gateway/ lên máy chủ HTTPS (xem gateway/README.md), đặt DESKTOP_TOKEN và secret của nhà cung cấp trên gateway. Dán URL gateway + DESKTOP_TOKEN vào đây. Nhãn delivery mode được lấy theo từng sự kiện (Gmail/Calendar qua Composio là polling).': 'Deploy the gateway/ folder to an HTTPS server (see gateway/README.md), set DESKTOP_TOKEN and the provider secrets there, then paste the gateway URL + DESKTOP_TOKEN here. Delivery mode is labelled per event (Gmail/Calendar via Composio are polling).',
  'URL Gateway (https://…)': 'Gateway URL (https://…)', '≥ 24 ký tự ngẫu nhiên': '≥ 24 random characters',
  'Thư mới trong Gmail.': 'New Gmail messages.', 'Mail/Lịch Outlook qua Microsoft Graph change notifications.': 'Outlook mail/calendar via Microsoft Graph change notifications.',
  'Tin nhắn Teams qua Microsoft Graph.': 'Teams messages via Microsoft Graph.', 'Sự kiện trang/cơ sở dữ liệu Notion.': 'Notion page/database events.',
  'Tin nhắn trong server Discord.': 'Messages in Discord servers.', 'Tin nhắn Zalo cá nhân.': 'Personal Zalo messages.', 'Đọc Windows Toast qua UserNotificationListener (WinRT).': 'Read Windows toasts via UserNotificationListener (WinRT).',
  'Chỉ có trên Windows 10/11.': 'Windows 10/11 only.', 'Chỉ có trên macOS.': 'macOS only.',
  'Kết nối trực tiếp chưa triển khai: Gmail push cần Google Cloud Pub/Sub + public HTTPS + History API. Thay thế: trigger Gmail của Composio qua Cloud Gateway — lưu ý đó là POLLING (Composio managed OAuth tối thiểu 15 phút), sẽ được gắn nhãn near_realtime_poll, không phải realtime.': 'Direct connection not implemented: Gmail push needs Google Cloud Pub/Sub + public HTTPS + the History API. Alternative: Composio’s Gmail trigger via the Cloud Gateway — note it is POLLING (managed OAuth ≥ 15 minutes) and is labelled near_realtime_poll, not realtime.',
  'Kết nối Graph trực tiếp chưa triển khai (cần Azure AD app, public HTTPS, gia hạn subscription). Thay thế: trigger Outlook của Composio qua Cloud Gateway, hoặc link lịch ICS ở mục Calendar.': 'Direct Graph connection not implemented (needs an Azure AD app, public HTTPS, subscription renewal). Alternative: Composio’s Outlook trigger via the Cloud Gateway, or an ICS link in Calendar.',
  'Chưa hỗ trợ: Graph change notifications cho chat Teams cần quyền resource riêng và public HTTPS endpoint; không suy diễn từ Outlook. Có thể đẩy sự kiện qua Gateway /webhooks/generic từ một luồng Power Automate/Graph của bạn.': 'Not supported: Graph change notifications for Teams chats need dedicated resource permissions and a public HTTPS endpoint (not implied by Outlook). You can push events to Gateway /webhooks/generic from your own Power Automate/Graph flow. Tip: Teams desktop notifications are already captured by macOS Notification Center.',
  'Kết nối trực tiếp chưa triển khai. Dùng Notion trigger của Composio (được Composio mô tả là realtime) qua Cloud Gateway; cần kiểm thử end-to-end trước khi coi là realtime.': 'Direct connection not implemented. Use Composio’s Notion trigger (described by Composio as realtime) via the Cloud Gateway; verify end-to-end before treating it as realtime.',
  'Chưa triển khai: cần Discord bot + Gateway WebSocket với intents phù hợp; chỉ nhận được tin trong server bot có mặt, không đọc được thông báo cá nhân.': 'Not implemented: requires a Discord bot + Gateway WebSocket with suitable intents; only messages in servers the bot joined, never personal notifications.',
  'Zalo không cung cấp API đọc tin nhắn tài khoản cá nhân (Zalo OA API chỉ dành cho Official Account). Không hỗ trợ để tránh screen-scraping.': 'Zalo offers no API for personal-account messages (the Zalo OA API is for Official Accounts only). Use macOS Notification Center to capture Zalo desktop notifications.',
  'UserNotificationListener yêu cầu app được đóng gói MSIX với capability "userNotificationListener". Sẽ khả dụng ở bản cài đặt MSIX (Phase 7).': 'UserNotificationListener requires an MSIX-packaged app with the "userNotificationListener" capability. Available in a future MSIX build.',
  'Bộ lưu trữ bảo mật của hệ điều hành không khả dụng — không thể lưu token.': 'OS secure storage is unavailable — tokens cannot be saved.',
  'Near real-time (poll)': 'Near real-time (poll)', 'Scheduled sync': 'Scheduled sync', 'Realtime push': 'Realtime push', 'System event': 'System event',
  'Đang theo dõi Notification Center': 'Watching Notification Center', 'sự kiện gần nhất': 'latest event',

  // ---------- appearance / sounds / settings
  'Màn hình hiển thị, vị trí tự do, khoảng cách viền, kích thước và chế độ thường trú.': 'Display, free positioning, edge margin, size and resident mode.',
  'Đa màn hình & Tỷ lệ': 'Multi-monitor & scale', 'Hiển thị trên': 'Show on', 'Khoảng cách viền': 'Edge margin', 'Kích thước thú cưng': 'Pet size',
  'Kéo thả tự do & Thường trú': 'Free drag & resident pet', 'Cho phép nắm kéo thả tự do': 'Allow free drag & drop',
  'Nhấn giữ chuột vào thú cưng để nhấc bổng và thả vào bất kỳ vị trí nào trên màn hình làm việc.': 'Press and hold the pet to pick it up and drop it anywhere on your desktop.',
  'Luôn ngồi ở góc màn hình': 'Always sit in the screen corner', 'Tắt đi để thú cưng chỉ xuất hiện khi có thông báo. Khi rảnh, render tự ngủ đông (0% CPU).': 'Turn off to show the pet only for notifications. When idle, rendering hibernates (0% CPU).',
  'Đặt lại vị trí mặc định': 'Reset to default position', 'Đang ở vị trí kéo thả tùy chỉnh': 'At a custom dragged position',
  'Mẹo: Thú cưng sẽ có phản ứng quơ quào chân, kêu cứu hài hước khi bị bạn nhấc bổng!': 'Tip: the pet flails and cries for help (comically) when you pick it up!',
  'Âm lượng, tiếng kêu, độ nhạy vuốt ve và cường độ chuyển động.': 'Volume, voices, petting sensitivity and motion intensity.', 'Âm thanh': 'Sound', 'Bật âm thanh': 'Sound on',
  'Tiếng kêu & hiệu ứng được tổng hợp bằng Web Audio, không cần file âm thanh.': 'Voices & effects are synthesized with Web Audio — no audio files needed.', 'Âm lượng': 'Volume',
  'Meo': 'Meow', 'Gâu': 'Woof', 'Chíp': 'Squeak', 'Píp': 'Chirp', 'Chuông': 'Bell', 'Hoạt họa & xúc giác': 'Animation & touch', 'Cường độ chuyển động': 'Motion intensity',
  'Độ nhạy vuốt ve': 'Petting sensitivity', 'Giảm chuyển động (Reduced Motion)': 'Reduced Motion', 'Theo hệ điều hành': 'Follow the OS', '(đang bật)': '(currently on)',
  'Luôn bật': 'Always on', 'Tắt': 'Off', 'Thử vuốt đầu thú cưng ở khung xem trước bên dưới.': 'Try petting the pet’s head in the preview below.',
  'Cài đặt': 'Settings', 'Khởi động cùng hệ thống, ngôn ngữ, quyền riêng tư và bảo mật dữ liệu.': 'Launch at login, language, privacy and data security.',
  'Hệ thống': 'System', 'Tự khởi động cùng hệ thống': 'Launch at login', 'Mở ẩn khi đăng nhập macOS / Windows.': 'Opens hidden when you log in to macOS / Windows.',
  'Tự khởi động chỉ hỗ trợ macOS / Windows.': 'Launch at login is only supported on macOS / Windows.', 'Ngôn ngữ hiển thị (Language)': 'Display language',
  'Quyền riêng tư': 'Privacy', 'Lưu lịch sử thông báo trong phiên': 'Keep notification history for this session', 'Chỉ lưu trong bộ nhớ, không ghi ra ổ đĩa.': 'Kept in memory only, never written to disk.',
  'Số thông báo tối đa': 'Max notifications', 'Lưu Inbox xuống ổ đĩa': 'Save the Inbox to disk', 'Để tin trong Inbox không mất khi khởi động lại. Tắt sẽ xóa file inbox.json.': 'Keeps Inbox items across restarts. Turning it off deletes inbox.json.',
  'Xóa lịch sử': 'Clear history', 'Bảo mật': 'Security', 'Lưu trữ token:': 'Token storage:', 'Máy chủ chỉ lắng nghe': 'The server only listens on', ', kiểm tra Host header.': ', with Host-header checks.',
  'API Control Center yêu cầu token ngẫu nhiên mỗi lần khởi động.': 'The Control Center API requires a random token per launch.',
  'Nội dung thông báo được xem là dữ liệu không tin cậy: lọc ký tự điều khiển, giới hạn độ dài, chỉ mở link http(s).': 'Notification content is treated as untrusted: control characters stripped, lengths capped, only http(s) links opened.',
  'Thông tin': 'About', 'Phiên bản:': 'Version:', '· Nền tảng:': '· Platform:', 'Khôi phục cài đặt gốc': 'Restore default settings', 'không khả dụng ✗': 'unavailable ✗',

  // ---------- toasts / confirms
  'Đã copy': 'Copied', 'Đã xóa hàng đợi': 'Queue cleared', 'Đã xóa lịch sử': 'History cleared', 'Đã khôi phục cài đặt gốc': 'Defaults restored',
  'Đã đặt lại vị trí mặc định': 'Position reset', 'Đã nhập mô hình .glb 🎉': 'Model imported 🎉', 'Đã xóa token khỏi Keychain': 'Token removed from the Keychain',
  'Nhập tên ứng dụng trước nhé': 'Enter an app name first', 'File quá lớn (tối đa 60MB)': 'File too large (max 60 MB)',
  'Đã xóa GLB tùy chỉnh, quay lại rig procedural': 'Custom GLB removed, back to the procedural rig',
  'Đang Không làm phiền — đã ghi lại nhưng không hiện': 'Do Not Disturb — recorded but not shown',
  'Tắt hẳn Cute Pet Companion? Thú cưng sẽ biến mất cho tới khi bạn mở lại app.': 'Quit Cute Pet Companion? The pet will disappear until you reopen the app.',
  'Đã tắt Cute Pet Companion. Bạn có thể đóng cửa sổ này.': 'Cute Pet Companion has quit. You can close this window.',
  'Khôi phục toàn bộ cài đặt về mặc định? (Token kết nối được giữ nguyên)': 'Restore all settings to defaults? (Connection tokens are kept)'
};

/** Dynamic strings (numbers, times). Applied when no exact match exists. */
const PATTERNS = [
  [/^(\d+)s trước$/, (m) => `${m[1]}s ago`],
  [/^(\d+) phút trước$/, (m) => `${m[1]} min ago`],
  [/^(\d+) giờ trước$/, (m) => `${m[1]} h ago`],
  [/^mỗi (\d+)s$/, (m) => `every ${m[1]}s`],
  [/^mỗi (\d+) phút$/, (m) => `every ${m[1]} min`],
  [/^(\d+) kết nối đang hoạt động$/, (m) => `${m[1]} active connections`],
  [/^Màn hình (\d+) — (.+?)( \(chính\))?$/, (m) => `Display ${m[1]} — ${m[2]}${m[3] ? ' (primary)' : ''}`],
  [/^né (\d+)%$/, (m) => `dodge ${m[1]}%`],
  [/^#(\d+)$/, (m) => `#${m[1]}`],
  [/^bắt đầu từ #(\d+)$/, (m) => `starting at #${m[1]}`],
  [/^nguồn→hiển thị (.+)$/, (m) => `source→render ${m[1]}`],
  [/^(\d+) thông báo mới từ (.+)$/, (m) => `${m[1]} new notifications from ${m[2]}`],
  [/^Chế độ (\w+) chỉ cho mức ≥ (\w+)$/, (m) => `${m[1]} mode only allows ≥ ${m[2]}`],
  [/^Chế độ (\w+) chặn nhóm (\w+)$/, (m) => `${m[1]} mode blocks ${m[2]}`],
  [/^Chế độ (\w+)$/, (m) => `${m[1]} mode`],
  [/^Đã gửi (.+) ra desktop!$/, (m) => `Sent ${m[1]} to the desktop!`],
  [/^(.+) → hiện trên desktop$/, (m) => `${tr(m[1])} → shown on the desktop`],
  [/^(.+) → Inbox \((.+)\)$/, (m) => `${tr(m[1])} → Inbox (${tr(m[2])})`],
  [/^Lưu thất bại: (.+)$/, (m) => `Save failed: ${m[1]}`],
  [/^sự kiện gần nhất (.+) \((\d+)\)$/, (m) => `latest event ${tr(m[1])} (${m[2]})`],
  [/^Cảm xúc gần nhất: (.+)$/, (m) => `Latest emotion: ${tr(m[1])}`],
  [/^(.+): đã kết nối!$/, (m) => `${m[1]}: connected!`]
];

let current = 'vi';
const ORIGINAL = new WeakMap(); // node → original Vietnamese text
const ATTR_ORIG = new WeakMap(); // element → {placeholder,title}

/** Translate one string (exact → split " · " → strip symbol prefix → patterns). */
export function tr(s) {
  if (current !== 'en' || typeof s !== 'string') return s;
  const raw = s;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return raw;
  if (EN[t] !== undefined) return raw.replace(t, EN[t]);
  if (t.includes(' · ')) {
    const parts = t.split(' · ');
    const out = parts.map(p => tr(p));
    if (out.some((x, i) => x !== parts[i])) return out.join(' · ');
  }
  // Leading emoji / symbols / bullets (e.g. "😸 Vui vẻ", "① Quy tắc", "• Bình thường")
  const m = t.match(/^((?:[^\p{L}\p{N}"(]|[\u2139\u2460-\u2473])+)(.+)$/u);
  if (m) { const rest = m[2].trim(); const tt = tr(rest); if (tt !== rest) return m[1] + tt; }
  for (const [re, fn] of PATTERNS) { const mm = t.match(re); if (mm) return fn(mm); }
  // Trailing parenthetical id, e.g. "Vui vẻ (happy)"
  const p = t.match(/^(.+?) (\([^)]*\))$/);
  if (p) { const tt = tr(p[1]); if (tt !== p[1]) return `${tt} ${p[2]}`; }
  return raw;
}

const SKIP = 'textarea, input, code, pre, .h-main, [data-no-i18n], .cls-result small:first-child';
const VI_RE = /[\u00C0-\u024F\u1EA0-\u1EF9]/; // Latin with diacritics + Vietnamese block

function translateNode(root) {
  if (current !== 'en' || !root) return;
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP) || !VI_RE.test(node.nodeValue)) return;
      const next = tr(node.nodeValue);
      if (next !== node.nodeValue) { if (!ORIGINAL.has(node)) ORIGINAL.set(node, node.nodeValue); node.nodeValue = next; }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches && node.matches('textarea, code, pre, [data-no-i18n]')) return;
    for (const a of ['placeholder', 'title']) {
      const v = node.getAttribute && node.getAttribute(a);
      if (v && VI_RE.test(v)) {
        const next = tr(v);
        if (next !== v) {
          const o = ATTR_ORIG.get(node) || {};
          if (!(a in o)) o[a] = v;
          ATTR_ORIG.set(node, o);
          node.setAttribute(a, next);
        }
      }
    }
    for (const c of node.childNodes) walk(c);
  };
  walk(root);
}

function restoreNode(root) {
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) { if (ORIGINAL.has(node)) { node.nodeValue = ORIGINAL.get(node); ORIGINAL.delete(node); } return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const o = ATTR_ORIG.get(node);
    if (o) { for (const [a, v] of Object.entries(o)) node.setAttribute(a, v); ATTR_ORIG.delete(node); }
    for (const c of node.childNodes) walk(c);
  };
  walk(root);
}

let observer = null;
export function setLanguage(lang) {
  const next = lang === 'en' ? 'en' : 'vi';
  if (next === current && observer) return;
  current = next;
  document.documentElement.lang = next;
  if (!observer) {
    observer = new MutationObserver((records) => {
      if (current !== 'en') return;
      for (const r of records) for (const n of r.addedNodes) translateNode(n.nodeType === Node.TEXT_NODE ? n.parentElement : n);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (next === 'en') translateNode(document.body); else restoreNode(document.body);
}

export function getLanguage() { return current; }
