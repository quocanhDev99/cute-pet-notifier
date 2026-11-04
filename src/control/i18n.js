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
// ---------- V3.3 simplified Control Center
Object.assign(EN, {
  'Trang chủ': 'Home', 'Hộp thư': 'Inbox', 'Theo dõi': 'Monitoring', 'Cài đặt': 'Settings', 'Kết nối': 'Connections',
  'Đào hồng': 'Peach', 'Bạc hà': 'Mint', 'Oải hương': 'Lavender', 'Đại dương': 'Ocean', 'Hoàng hôn': 'Sunset', 'Đêm (tối)': 'Midnight (dark)',
  'Đang chờ bạn': 'Waiting for you', 'Nhiều tin liên tiếp': 'Many in a row', 'Ứng dụng đã tắt tiếng': 'App muted', 'Lúc thú cưng đang ẩn': 'While the pet was hidden',
  'Chế độ tối giản': 'Minimal mode', 'Quá nhiều tin cùng lúc': 'Too many at once', 'Đang ở chế độ tập trung': 'During a focus mode',
  'Đang hoạt động': 'Active', 'Cần cấp quyền': 'Needs permission', 'Cần đăng nhập lại': 'Sign in again', 'Có lỗi': 'Error', 'Đã tắt': 'Off', 'Chờ đăng nhập': 'Waiting for sign-in',
  'Pull request, issue, nhắc tên bạn.': 'Pull requests, issues, mentions.', 'Lịch (Google / Outlook / iCloud)': 'Calendar (Google / Outlook / iCloud)',
  'Nhắc trước cuộc họp qua link lịch iCal.': 'Meeting reminders via an iCal link.', 'Tin nhắn riêng và @mention, tức thì.': 'Direct messages and @mentions, instantly.',
  'Pin & hệ thống': 'Battery & system', 'Pin yếu, cắm sạc, máy quá nóng.': 'Low battery, charging, overheating.',
  'Mã truy cập GitHub (Personal Access Token)': 'GitHub access token (Personal Access Token)', 'Link lịch bí mật (iCal)': 'Secret calendar link (iCal)', 'Nhắc trước (phút)': 'Remind before (minutes)', 'Báo khi': 'Notify on',
  'Báo pin yếu & sạc': 'Low battery & charging', 'Chào khi mở khóa máy': 'Greet when unlocking', 'Báo máy quá nóng': 'Overheating alerts',
  'Mở github.com → Settings → Developer settings → Personal access tokens (classic).': 'Open github.com → Settings → Developer settings → Personal access tokens (classic).',
  'Tạo token với quyền "notifications", dán vào ô bên dưới.': 'Create a token with the "notifications" scope and paste it below.',
  'Google Lịch: Cài đặt → chọn lịch → "Địa chỉ bí mật ở định dạng iCal".': 'Google Calendar: Settings → pick a calendar → "Secret address in iCal format".',
  'Outlook: Cài đặt → Lịch → Lịch được chia sẻ → Xuất bản lịch → ICS.': 'Outlook: Settings → Calendar → Shared calendars → Publish a calendar → ICS.',
  'Tạo Slack app (api.slack.com/apps), bật Socket Mode để có App Token.': 'Create a Slack app (api.slack.com/apps) and enable Socket Mode to get an App Token.',
  'Cài app vào workspace để lấy Bot Token, dán cả hai vào đây.': 'Install the app to your workspace to get a Bot Token, then paste both here.',
  'Không cần đăng nhập — chỉ chọn những gì bạn muốn được báo.': 'No sign-in needed — just choose what you want to hear about.',
  'Thú cưng chưa nhận thông báo của máy': 'The pet isn’t receiving this computer’s notifications yet', 'Bật ngay': 'Turn on',
  'Còn 1 bước: cho phép thú cưng thay thế thông báo của máy': 'One step left: let the pet replace this computer’s notifications', 'Hoàn tất': 'Finish',
  'Thú cưng đang thay thế thông báo của máy': 'The pet is replacing this computer’s notifications', 'Thú cưng đang thay thế thông báo của Windows': 'The pet is replacing Windows notifications',
  'Thú cưng chưa nhận thông báo của Windows': 'The pet isn’t receiving Windows notifications yet', 'Bạn đồng hành của bạn': 'Your companion',
  'Thú cưng đang trông thông báo giúp bạn.': 'Your pet is looking after your notifications.', 'Xin chào! 👋': 'Hello! 👋',
  'Thú cưng xuất hiện thế nào?': 'How should the pet appear?', 'Luôn ở bên': 'Always there', 'Nhỏ gọn': 'Compact', 'Ẩn đi': 'Hidden',
  'Gửi thử 1 thông báo': 'Send a test notification', 'Đổi thú cưng': 'Change pet', 'Xem tất cả': 'See all',
  'Những tin được giữ lại khi bạn đang tập trung — không có gì bị mất.': 'Messages held back while you focus — nothing gets lost.', 'tin chưa đọc': 'unread',
  'Ứng dụng đã kết nối': 'Connected apps', 'Quản lý': 'Manage', 'Chưa kết nối ứng dụng nào — thông báo của máy vẫn được thú cưng mang tới.': 'No apps connected yet — the pet still delivers your computer’s notifications.',
  'Sẵn sàng nhận tin': 'Ready for notifications', 'Đang tập trung — tin ít gấp sẽ vào Hộp thư': 'Focusing — non-urgent messages go to the Inbox',
  'Chọn người bạn đồng hành và tính cách của bé.': 'Choose your companion and its personality.', 'Tính cách': 'Personality',
  'Âm thanh & chuyển động': 'Sound & motion', 'Tiếng kêu dễ thương': 'Cute sounds', 'Âm lượng': 'Volume', 'Nghe thử': 'Preview', 'Độ sinh động': 'Liveliness',
  'Giảm chuyển động': 'Reduce motion', 'Theo cài đặt của máy': 'Follow system setting', 'Luôn giảm': 'Always reduce', 'Không giảm': 'Don’t reduce',
  'Thẻ thông báo trông ra sao, khi nào được làm phiền và tin nào quan trọng.': 'How cards look, when you can be disturbed and what matters.',
  'Hiển thị': 'Display', 'Tập trung': 'Focus', 'Ưu tiên': 'Priority',
  'Tin được giữ lại khi bạn đang tập trung hoặc ít quan trọng. Không có gì bị mất.': 'Messages held back while you focus, or low-priority ones. Nothing gets lost.',
  'Đánh dấu đã đọc': 'Mark all read', 'Xóa hết': 'Clear all', 'chưa đọc': 'unread', 'Không có tin nào đang chờ 🎉': 'Nothing waiting 🎉', 'Hộp thư trống 🐾': 'Inbox is empty 🐾',
  'Để thú cưng mang tới thông báo từ máy tính và các ứng dụng bạn dùng.': 'Let the pet bring notifications from your computer and the apps you use.',
  'Ứng dụng của tôi': 'My apps', 'Cập nhật': 'Refresh', 'Chưa chọn sự kiện nào': 'No events selected yet', 'Chọn sự kiện': 'Choose events', 'Đăng nhập': 'Sign in', 'Thiết lập': 'Set up', 'Gỡ': 'Remove',
  'Chưa có ứng dụng nào. Tìm và thêm ở bên dưới nhé 👇': 'No apps yet. Find and add one below 👇', 'Thêm ứng dụng': 'Add apps', 'Hơn 1000 ứng dụng qua Composio': '1000+ apps via Composio',
  'Tìm ứng dụng: Gmail, Notion, Jira, Teams…': 'Search apps: Gmail, Notion, Jira, Teams…', 'Đã thêm': 'Added', 'Kết nối': 'Connect', 'Không tìm thấy ứng dụng phù hợp.': 'No matching apps.',
  'Giao diện, ngôn ngữ và quyền riêng tư.': 'Appearance, language and privacy.', 'Màu giao diện': 'App color', 'Chung': 'General', 'Ngôn ngữ (Language)': 'Language',
  '🇻🇳 Tiếng Việt': '🇻🇳 Vietnamese', 'Mở cùng máy tính': 'Open at login', 'Thú cưng tự xuất hiện khi bạn đăng nhập.': 'The pet appears when you log in.', 'Hiện trên màn hình': 'Show on display',
  'Quyền riêng tư': 'Privacy', 'Nhớ thông báo gần đây': 'Remember recent notifications', 'Chỉ giữ trong bộ nhớ, mất khi tắt app.': 'Kept in memory only, cleared when the app quits.',
  'Giữ Hộp thư khi tắt app': 'Keep the Inbox after quitting', 'Lưu trên máy này, không gửi đi đâu.': 'Stored on this computer, never sent anywhere.', 'Xóa thông báo gần đây': 'Clear recent notifications',
  'Nâng cao': 'Advanced', 'Hiện tab "Theo dõi"': 'Show the "Monitoring" tab', 'Dành cho người muốn xem thống kê, độ trễ và chỉnh quy tắc chi tiết.': 'For people who want stats, latency and detailed rules.',
  'Khôi phục cài đặt gốc': 'Reset to defaults', 'Thoát ứng dụng': 'Quit app',
  'Thoải mái': 'Relaxed', 'Cho hiện nhiều tin liên tiếp': 'Allow many cards in a row', 'Vừa phải': 'Balanced', 'Tối đa 3 thẻ mỗi 10 giây / ứng dụng': 'At most 3 cards per 10 seconds per app',
  'Ít làm phiền': 'Fewer interruptions', '1 thẻ mỗi 30 giây / ứng dụng, phần còn lại vào Hộp thư': '1 card per 30 seconds per app, the rest go to the Inbox',
  'Ôm bảng': 'Billboard', 'Bé đứng cạnh, giữ mép thẻ thông báo.': 'The pet stands beside the card, holding its edge.', 'Ló đầu': 'Peeker', 'Bé ló đầu từ sau thẻ, mắt dõi theo chuột.': 'The pet peeks over the card, eyes following your cursor.',
  'Đưa thư': 'Courier', 'Bé chạy vào mang phong bì rồi mở thẻ.': 'The pet runs in with an envelope and opens the card.',
  'Pastel': 'Pastel', 'Trắng tối giản': 'Minimal white', 'Tối': 'Dark', 'Kính mờ': 'Frosted glass', 'Trong suốt': 'Transparent',
  'Cách bé mang thông báo tới': 'How the pet delivers notifications', 'Kiểu thẻ': 'Card style', 'Nhỏ': 'Small', 'Vừa': 'Medium', 'Lớn': 'Large', 'Thẻ hiện trong': 'Card shows for',
  'Vị trí của bé': 'Pet position', 'Kích thước bé': 'Pet size', 'Cho phép kéo bé đi chỗ khác': 'Let me drag the pet around', 'Nhấn giữ vào bé rồi thả ở bất kỳ đâu.': 'Press and hold the pet, then drop it anywhere.',
  'Bé luôn ngồi trên màn hình': 'Pet always stays on screen', 'Tắt để bé chỉ xuất hiện khi có thông báo.': 'Turn off to show the pet only when a notification arrives.', 'Đưa bé về góc đã chọn': 'Move the pet back to its corner',
  'Bé ngồi ở góc màn hình, dõi theo chuột, thích được vuốt ve.': 'Sits in a corner, follows your cursor, loves being petted.', 'Bé thu nhỏ, cuộn tròn ngủ; thẻ vẫn hiện nhẹ nhàng.': 'Shrinks and naps; cards still appear gently.',
  'Bé ẩn hoàn toàn. Tin vào Hộp thư, trừ tin khẩn cấp.': 'Fully hidden. Messages go to the Inbox, except urgent ones.',
  'Mọi tin đều được báo.': 'Everything is shown.', 'Làm việc': 'Work', 'Bớt tin mạng xã hội, giải trí, khuyến mãi.': 'Fewer social, entertainment and promo messages.',
  'Tập trung sâu': 'Deep focus', 'Chỉ tin khẩn cấp, không âm thanh.': 'Urgent only, no sound.', 'Đang họp': 'In a meeting', 'Bé ngủ, chỉ tin quan trọng, không âm thanh.': 'Pet sleeps, important only, no sound.',
  'Chơi game': 'Gaming', 'Ẩn bé, chỉ tin khẩn cấp.': 'Pet hidden, urgent only.', 'Thư giãn': 'Relax', 'Báo tất cả, kể cả tin nhỏ.': 'Show everything, even small stuff.',
  'Đi ngủ': 'Sleep', 'Im lặng, chỉ tin khẩn cấp.': 'Silent, urgent only.', 'Bạn đang làm gì?': 'What are you doing?', 'Bé xuất hiện thế nào?': 'How should the pet appear?',
  'Bật Không làm phiền ngay': 'Turn on Do Not Disturb now', 'Tự im lặng mỗi ngày': 'Quiet hours every day', 'Từ': 'From', 'đến': 'to',
  'Tin nào được làm phiền bạn?': 'What may interrupt you?', 'Tin khẩn cấp luôn được báo': 'Urgent messages always come through',
  'Ví dụ: pin sắp hết, máy quá nóng — kể cả khi đang tập trung.': 'E.g. battery almost empty, overheating — even while focusing.',
  'Tin ít quan trọng vào thẳng Hộp thư': 'Low-priority messages go straight to the Inbox', 'Khuyến mãi, bản tin… không bật thẻ.': 'Promos, newsletters… no card.',
  'Khi nhiều tin tới cùng lúc': 'When many messages arrive at once', 'Tắt tiếng ứng dụng': 'Mute apps',
  'Tin từ ứng dụng bị tắt tiếng sẽ vào Hộp thư, không bật thẻ. Bấm để bật/tắt.': 'Messages from muted apps go to the Inbox without a card. Click to toggle.',
  'Danh sách sẽ hiện các ứng dụng đã gửi thông báo cho bạn.': 'Apps that have sent you notifications will appear here.', 'Thêm tên ứng dụng, vd: zalo': 'Add an app name, e.g. zalo', 'Tắt tiếng': 'Mute',
  'Thay thế thông báo của máy Mac': 'Replace Mac notifications', 'Đang bật': 'On', 'Đang tắt': 'Off',
  'Thông báo của mọi ứng dụng (Zalo, Messenger, Mail, Teams…) sẽ được thú cưng mang tới thay cho banner của macOS. Bấm vào thẻ để mở đúng cuộc trò chuyện.': 'Notifications from every app (Zalo, Messenger, Mail, Teams…) are delivered by the pet instead of macOS banners. Click a card to open that exact conversation.',
  'Cho phép thú cưng đọc thông báo': 'Let the pet read notifications', 'Đã xong — thông báo tới ngay lập tức.': 'Done — notifications arrive instantly.',
  'Mở Cài đặt → Quyền riêng tư & Bảo mật → Trợ năng, bật "Cute Pet Companion".': 'Open Settings → Privacy & Security → Accessibility and turn on "Cute Pet Companion".', 'Mở Cài đặt': 'Open Settings',
  'Không bao giờ thấy banner gốc (tùy chọn)': 'Never see the original banners (optional)', 'Đã tắt banner của macOS cho mọi ứng dụng. Thông báo chỉ hiện qua thú cưng.': 'macOS banners are off for every app. Notifications only appear through the pet.',
  'Tắt hẳn banner của macOS để không còn chớp lên. Có thể hoàn tác bất cứ lúc nào.': 'Turn macOS banners off completely so they never flash. You can undo any time.', 'Hoàn tác': 'Undo', 'Bật': 'Turn on',
  'Thay thế thông báo của Windows': 'Replace Windows notifications', 'Cho phép đọc thông báo': 'Allow reading notifications', 'Đã xong.': 'Done.',
  'Windows sẽ hỏi quyền "Truy cập thông báo" — hãy bấm Cho phép.': 'Windows will ask for "Notification access" — click Allow.', 'Đang tìm…': 'Searching…',
  'Mở khóa hơn 1000 ứng dụng': 'Unlock 1000+ apps', 'Gmail, Outlook, Teams, Notion, Jira, Trello, Discord, HubSpot… qua dịch vụ kết nối Composio. Bạn tự đăng nhập từng ứng dụng trên trang của họ — app không bao giờ thấy mật khẩu.': 'Gmail, Outlook, Teams, Notion, Jira, Trello, Discord, HubSpot… through the Composio connection service. You sign in to each app on its own page — this app never sees your password.',
  'Tạo tài khoản Composio miễn phí': 'Create a free Composio account', 'Rồi vào Settings → API Keys để lấy khóa.': 'Then go to Settings → API Keys to get a key.', 'Mở composio.dev ↗': 'Open composio.dev ↗',
  'Dán khóa vào đây': 'Paste the key here', 'Khóa được mã hóa bằng Keychain của máy, không rời khỏi máy bạn.': 'The key is encrypted with your system keychain and never leaves your computer.', 'Khóa API Composio': 'Composio API key', 'Lưu': 'Save',
  'Để sau': 'Later', 'Chọn những sự kiện bạn muốn thú cưng báo.': 'Choose the events you want the pet to tell you about.', 'Đang tải…': 'Loading…',
  'Ứng dụng này chưa có sự kiện nào để báo.': 'This app has no events to notify about yet.', 'Đã bật sự kiện': 'Event turned on', 'Đã tắt sự kiện': 'Event turned off',
  'Để sự kiện tới được máy này cần bật "Cổng nhận sự kiện" (một lần, do người cài đặt thiết lập). Bật tab Theo dõi trong Cài đặt → Kết nối (kỹ thuật) → Gateway.': 'For events to reach this computer, an "event gateway" must be set up once. Turn on the Monitoring tab in Settings → Connections (technical) → Gateway.',

  'Thống kê, độ trễ, chi tiết kỹ thuật của kết nối và công cụ thử nghiệm.': 'Statistics, latency, technical connection details and test tools.',
  'Thống kê': 'Statistics', 'Kết nối (kỹ thuật)': 'Connections (technical)', 'Quy tắc cảm xúc': 'Emotion rules', 'Công cụ': 'Tools',
  'Vào Hộp thư': 'To Inbox', 'Theo mức ưu tiên': 'By priority', 'Lý do vào Hộp thư': 'Why messages went to the Inbox', 'Hàng đợi hiện tại': 'Current queue', 'Lịch sử (chi tiết)': 'History (detailed)',
  'Sự kiện từ Composio đi qua Gateway HTTPS của bạn (SSE ra ngoài) — máy này không mở cổng ra Internet.': 'Composio events go through your HTTPS gateway (outbound SSE) — this computer opens no port to the Internet.',
  'Máy chủ chỉ lắng nghe': 'The server only listens on', ', kiểm tra Host header; API cần token ngẫu nhiên mỗi lần khởi động.': ', checks the Host header; the API needs a random per-launch token.',
  'Lưu trữ token:': 'Token storage:', 'Khóa Composio:': 'Composio key:', 'đã lưu 🔒': 'saved 🔒', 'chưa có': 'not set', 'Xóa khóa': 'Remove key',
  'Gửi thông báo thử theo cảm xúc': 'Send a test notification per emotion', '← thử qua Attention Engine thật': '← through the real Attention Engine',
  'Hàng đợi & cooldown': 'Queue & cooldown', 'Cooldown: số thẻ / app': 'Cooldown: cards per app', 'Cooldown: trong (giây)': 'Cooldown: window (seconds)', '0 = tắt': '0 = off', 'Lịch sử tối đa': 'History limit',
  'Hiển thị chi tiết': 'Display details', 'Khoảng cách viền': 'Edge margin', 'Độ nhạy vuốt ve': 'Petting sensitivity',
  'Mô hình 3D (.glb)': '3D models (.glb)', 'Nhập mô hình glTF Binary 2.0 xuất từ Blender để thay rig procedural (xem docs/BLENDER_GUIDE.md).': 'Import a glTF Binary 2.0 model exported from Blender to replace the procedural rig (see docs/BLENDER_GUIDE.md).',
  'Ép buộc': 'Forced', 'Đang tập trung — tin thử đã vào Hộp thư': 'Focusing — the test message went to the Inbox', 'Đã xóa thông báo gần đây': 'Recent notifications cleared',
  'Gỡ ứng dụng này? Bạn có thể thêm lại bất cứ lúc nào.': 'Remove this app? You can add it again any time.', 'Dán khóa Composio trước nhé': 'Paste your Composio key first',
  'Đã mở khóa hơn 1000 ứng dụng!': '1000+ apps unlocked!', 'Xóa khóa Composio khỏi máy này?': 'Remove the Composio key from this computer?',
  'Đã mở trang đăng nhập trong trình duyệt. Đăng nhập xong quay lại đây nhé!': 'The sign-in page opened in your browser. Come back here when you’re done!',
  'Gỡ ứng dụng này và ngắt kết nối với Composio?': 'Remove this app and disconnect it from Composio?', 'Xóa toàn bộ tin trong Hộp thư?': 'Delete everything in the Inbox?',
  'Tắt banner gốc của TẤT CẢ ứng dụng trên Mac để chỉ thú cưng hiện thông báo?\n\nThông báo vẫn được lưu trong Trung tâm thông báo. Cài đặt gốc được sao lưu — bấm "Hoàn tác" để trả lại bất cứ lúc nào.': 'Turn off the original banners of ALL apps on this Mac so only the pet shows notifications?\n\nNotifications are still kept in Notification Center. Your original settings are backed up — click "Undo" to restore them any time.',
  'Bật lại banner gốc của macOS cho các ứng dụng đã bị tắt?': 'Turn the original macOS banners back on for the apps that were turned off?',
  'Đã có quyền': 'Permission granted', 'Hãy bật Cute Pet Companion trong danh sách rồi quay lại đây': 'Turn on Cute Pet Companion in the list, then come back here',
  'Đã mở Cài đặt Hệ thống': 'System Settings opened', 'Đã đưa bé về góc đã chọn': 'The pet is back in its corner', 'Đang chạy': 'Running', 'vừa xong': 'just now',
  'Mất kết nối với app…': 'Lost connection to the app…',
  'Tin nhắn chat': 'Chat messages',
  'Đặt lại quyền': 'Reset permission', '⚠️ Công tắc đã bật mà vẫn thấy bước này?': '⚠️ Switch is on but still seeing this step?',
  'Đó là mục quyền của bản app cũ (macOS giữ lại dù app đã được cập nhật). Bấm': 'That entry belongs to an older build of the app (macOS keeps it after updates). Press', ': app xóa mục cũ và hỏi quyền lại cho bản hiện tại — bạn chỉ cần bật': ': the app removes the old entry and asks again for this build — just turn on', '(nếu còn mục': '(if an old', 'cũ, chọn nó và bấm': 'entry remains, select it and press',
  'Đã xóa mục quyền cũ. Bật "Cute Pet Companion" trong danh sách Trợ năng vừa mở nhé': 'Old entry removed. Turn on "Cute Pet Companion" in the Accessibility list that just opened',
  'Bé nói chuyện': 'Pet talks', 'Bé nói khi nhắc nghỉ mắt và khi bị bạn nhấc bổng, kéo thả. Bé không bao giờ đọc nội dung thông báo.': 'Your pet speaks for eye-break reminders and when you pick it up or drag it. It never reads notification content aloud.', 'Nghe bé nói': 'Hear the pet', 'Máy này không có giọng đọc': 'No speech voice on this computer',
  'Tin nhắn': 'Messages', 'Chat: chỉ khi nhắc tới bạn': 'Chat: only when you’re mentioned', 'Chat: báo tất cả tin nhắn': 'Chat: every message', 'Đổi cách báo tin nhắn chat': 'Change how chat messages notify',
  'Nội dung trên thẻ thông báo': 'What notification cards show', 'Dùng khi chia sẻ màn hình, trình chiếu hay làm việc nơi đông người. Bật/tắt nhanh: chuột phải vào bé hoặc icon 🐾 trên thanh menu → "Ẩn nội dung thông báo".': 'For screen sharing, presenting or busy places. Quick toggle: right-click the pet or the 🐾 menu-bar icon → "Hide notification content".',
  'Hiện đầy đủ': 'Show everything', 'Ứng dụng, tiêu đề và nội dung.': 'App, title and content.', 'Che bớt': 'Masked', 'Chỉ giữ chữ cái đầu, ẩn nội dung.': 'First letters only, content hidden.',
  'Chỉ tên ứng dụng': 'App name only', 'Không tiêu đề, không nội dung, không nút Approve.': 'No title, no content, no Approve button.', 'Ẩn hoàn toàn': 'Fully hidden', 'Không cả tên ứng dụng.': 'Not even the app name.',
  'Luôn ẩn nội dung của các ứng dụng': 'Always hide content from these apps', 'Các ứng dụng này luôn chỉ hiện "Tin nhắn mới từ …", kể cả khi đang chọn "Hiện đầy đủ".': 'These apps always show only "New message from …", even when "Show everything" is selected.',
  'Khi nội dung bị ẩn, thẻ không lưu nội dung vào Hộp thư hay lịch sử. Bấm vào thẻ vẫn mở đúng ứng dụng để bạn xem riêng.': 'When content is hidden it is not stored in the Inbox or history either. Clicking the card still opens the app so you can read it privately.',
  'Tin nhắn mới từ Teams': 'New message from Teams', 'Bạn có thông báo mới': 'You have a new notification',
  'Còn 1 bước nhỏ: bật thêm trợ lý nc-bridge trong Trợ năng': 'One small step left: also allow the nc-bridge helper in Accessibility', 'Hướng dẫn': 'Show me',
  'Mở Cài đặt + chỉ file': 'Open Settings + show the file', 'Copy đường dẫn': 'Copy path', 'Đã copy đường dẫn — trong cửa sổ chọn file bấm ⌘⇧G rồi dán': 'Path copied — in the file picker press ⌘⇧G and paste',
  'Kéo file nc-bridge (Finder vừa mở) vào danh sách Trợ năng rồi bật công tắc': 'Drag the nc-bridge file (Finder just opened) into the Accessibility list and turn it on',
  'Công tắc đã bật mà vẫn thấy bước này? App vừa được cập nhật nên macOS cần cấp lại: chọn Cute Pet Companion → bấm': 'Switch already on but still seeing this step? The app was just updated so macOS needs it again: select Cute Pet Companion → press', 'để xóa → bấm': 'to remove → press', 'thêm lại': 'to add back', 'Bé tự nhận ra trong vài giây.': 'Your pet notices within a few seconds.', 'Lần kiểm tra gần nhất có lỗi:': 'The last check had an error:',
  'Thẻ thông báo dùng màu giao diện': 'Notification cards use the app colour', 'Tắt để thẻ đổi màu theo cảm xúc của bé (vui = vàng, buồn = xanh…).': 'Turn off to colour cards by the pet’s emotion (happy = yellow, sad = blue…).', 'Xem thử thẻ thông báo': 'Preview a notification card',
  'Bé đọc cảm xúc tin nhắn': 'Your pet reads the mood of messages', 'Bé đoán cảm xúc từ nội dung': 'Guess the emotion from the content', 'Dựa vào emoji và câu chữ (tiếng Việt có hoặc không dấu, tiếng Anh). Xử lý ngay trên máy, không gửi đi đâu.': 'From emoji and words (Vietnamese with or without accents, English). Processed on this computer, never sent anywhere.',
  'Bé phản ứng': 'Reaction strength', 'Ít': 'Low', 'Nhạy': 'Sensitive', 'Ít: chỉ khi tin nhắn thể hiện rõ cảm xúc. Nhạy: phản ứng cả với một từ hay một emoji.': 'Low: only clearly emotional messages. Sensitive: reacts even to a single word or emoji.',
  'Gõ thử một tin nhắn': 'Try a message', 'Bé sẽ phản ứng trong khung xem trước ở trên 👆': 'Your pet reacts in the preview above 👆',
  'Bé đọc từ nội dung': 'Read from the message', 'Theo ứng dụng': 'From the app', 'Theo từ khóa': 'From keywords', 'Theo quy tắc của bạn': 'From your rule', 'Theo mức ưu tiên': 'From the priority', 'Cảm xúc mặc định của bé': 'Pet’s default mood', 'Ứng dụng chỉ định': 'Set by the app', 'Áp dụng cho Teams, Slack, Zalo, Messenger, Tin nhắn, Telegram, Discord, WhatsApp…': 'Applies to Teams, Slack, Zalo, Messenger, Messages, Telegram, Discord, WhatsApp…',
  'Báo tất cả tin nhắn': 'Notify every message', 'Mọi tin nhắn được gửi tới đều hiện thẻ.': 'Every incoming message shows a card.',
  'Chỉ khi nhắc tới tôi': 'Only when I’m mentioned', 'Chỉ hiện khi có tên bạn, @all / @everyone, hoặc app báo "nhắc đến bạn". Tin khác vào Hộp thư.': 'Only shows when your name, @all / @everyone appears, or the app says "mentioned you". Others go to the Inbox.',
  'Tên của bạn trong chat': 'Your names in chat', 'Cách nhau bằng dấu phẩy. Tên 2 chữ trở lên (vd: Mai Pham) nhận cả khi không có @; tên 1 chữ phải có @ (vd: @Mai) để tránh nhầm với từ thường ngày ("mai" = ngày mai, "anh", "em"…).': 'Comma-separated. Names of 2+ words (e.g. Mai Pham) match without @; one-word names need @ (e.g. @Mai) so everyday words ("mai" = tomorrow…) don’t trigger it.',
  'Tin nhắn riêng (1-1) vẫn báo': 'Direct (1-1) messages still notify', 'Với Slack biết chính xác; với thông báo của máy là đoán theo dạng tin ("Người gửi: nội dung" thường là tin nhóm).': 'Exact for Slack; for system notifications it’s a guess from the format ("Sender: text" is usually a group).',
  'Không nhắc tên bạn': 'Didn’t mention you',
  'Nhắc nghỉ mắt': 'Eye-break reminder', 'Bé nhắc bạn cho mắt nghỉ': 'Let the pet remind you to rest your eyes', 'Nhắc sau mỗi': 'Remind every', 'Nghỉ trong': 'Break length',
  'Chỉ tính lúc bạn đang dùng máy — rời máy ≥ 5 phút hay khóa màn hình thì đếm lại. Hoãn khi đang họp / tập trung sâu.': 'Counts only while you use the computer — 5+ minutes away or a locked screen restarts it. Waits during meetings / deep focus.',
  'Lấy khóa Composio': 'Get a Composio key', 'Trên dashboard.composio.dev mở': 'On dashboard.composio.dev open', 'và copy khóa': 'and copy the', '(hoặc khóa dự án': 'key (or the project key', 'nếu bạn dùng Project).': 'if you use a Project).',
  'ck_… hoặc ak_…': 'ck_… or ak_…', 'Kiểm tra ngay': 'Check now', 'Kiểm tra mỗi 1 phút': 'Check every minute', 'Kiểm tra mỗi 2 phút': 'Check every 2 minutes', 'Kiểm tra mỗi 5 phút': 'Check every 5 minutes', 'Kiểm tra mỗi 15 phút': 'Check every 15 minutes',
  'Chưa có tin mới': 'Nothing new yet', 'Đã kết nối Composio': 'Composio connected', 'Đã kết nối Composio Connect!': 'Composio Connect connected!', 'Đã kết nối — chưa có sự kiện tự động cho app này': 'Connected — no automatic events for this app yet',
  'Thư mới chưa đọc': 'New unread email', 'Thông báo mới (PR, issue, nhắc tên)': 'New notifications (PRs, issues, mentions)', 'Nhắc trước cuộc họp 5 phút': 'Remind 5 minutes before meetings', 'Issue giao cho bạn vừa cập nhật': 'Issues assigned to you just updated',
  'Mở Project của bạn → Settings → API Keys, copy khóa dự án bắt đầu bằng': 'Open your Project → Settings → API Keys and copy the project key starting with',
  '(không dùng khóa uak_ ở mục Sessions & API Key của tổ chức).': '(not the uak_ key from the organization’s Sessions & API Key page).', 'Đang kết nối…': 'Connecting…', 'Để trống để giữ nguyên': 'leave empty to keep',
});

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
  [/^(.+): đã kết nối!$/, (m) => `${m[1]}: connected!`],
  [/^(\d+) loại sự kiện đang bật$/, (m) => `${m[1]} event types on`],
  [/^Phiên bản (.+)$/, (m) => `Version ${m[1]}`],
  [/^🔔 Kiểm tra mỗi (\d+) phút$/, (m) => `🔔 Checked every ${m[1]} min`],
  [/^🔔 Có (\d+) tin mới$/, (m) => `🔔 ${m[1]} new`],
  [/^Báo khi có: (.+)$/, (m) => `Notifies on: ${tr(m[1].charAt(0).toUpperCase() + m[1].slice(1))}`],
  [/^🤫 Đã tắt banner gốc của (\d+) ứng dụng( \(một số app đang mở cần tắt thủ công\))?$/, (m) => `🤫 Turned off original banners for ${m[1]} apps${m[2] ? ' (some open apps need to be turned off manually)' : ''}`],
  [/^↺ Đã khôi phục banner gốc cho (\d+) ứng dụng$/, (m) => `↺ Restored original banners for ${m[1]} apps`],
  [/^Không tải được danh sách ứng dụng: (.+)$/, (m) => `Couldn’t load the app list: ${m[1]}`]
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
