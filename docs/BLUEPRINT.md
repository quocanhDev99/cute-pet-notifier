# CUTE PET COMPANION — BLUEPRINT HIỆN HÀNH V4.1

## Kế hoạch sản phẩm: review, chế độ thông báo song song và mobile
*Cập nhật: 21/11/2026 · V4.1 = V4.0 + đối chiếu code v3.5.15 (xem §12 Thứ tự triển khai hiện hành và §13 Nhật ký quyết định) · Tài liệu kế hoạch; không đồng nghĩa các hạng mục đã được triển khai.*

> **Nguồn chuẩn:** Tài liệu này là Single Source of Truth cho roadmap sản phẩm hiện hành. Blueprint V3.7 được lưu tại `docs/archive/BLUEPRINT_V3.7.md` để tra cứu lịch sử, không dùng làm chỉ dẫn triển khai mới. Trạng thái thực thi phải lấy từ báo cáo implementation mới nhất và bằng chứng trên build/thiết bị thật.

## 0. Hợp đồng cốt lõi được giữ từ V3.7

Các đặc tả dưới đây tiếp tục là hợp đồng sản phẩm dùng chung. Chi tiết lịch sử nằm trong archive; mọi cập nhật mới phải giữ tương thích hoặc ghi migration rõ ràng.

- **8 Canonical Emotions:** `happy`, `excited`, `love`, `surprised`, `angry`, `sad`, `thinking`, `sleeping`. Runtime states như `idle`, `hidden`, `focused` và `isGrabbed` không phải cảm xúc.
- **4 Privacy Display Modes:** `full_content`, `masked`, `source_only`, `anonymous_source_only`. Privacy gate chạy trước mọi **sink** (log, persistence, renderer, companion overlay, Control Center, history, sync); chính sách nghiêm hơn thắng. Bước phân loại *trên máy* (emotion, priority, contact/chat rule) được phép đọc nội dung đầy đủ trước khi chiếu privacy, vì kết quả của nó không chứa nội dung; mọi thứ rời khỏi bước phân loại phải là bản đã chiếu. Hiện thực: `src/core/privacy.js` + `notification-pipeline.js` (projection trước overlay/Inbox/history).
- **Thứ tự ưu tiên quy tắc:** người cụ thể > nhóm chat > quan hệ > ứng dụng > chung > mặc định; phải được áp dụng trong engine, không chỉ UI.
- **Pipeline duy nhất:** capture/provider → normalize → dedupe → phân loại trên máy (contact/chat/focus/attention + emotion/attitude) → privacy gate → presentation adapter → inbox/digest. Mode A/B chỉ thay cách trình bày, không tạo engine/pipeline thứ hai.
- **Tương thích:** giữ stable character IDs, emotion IDs, settings keys và notification actions; thay đổi schema cần migration, fallback và rollback.
- **Không trùng tên khái niệm:** `notifications.presentationMode` đã được dùng cho *kiểu thẻ* (`billboard` / `peeker` / `courier`) và giữ nguyên. Mode A/B dùng key riêng **`notifications.bannerMode`**: `replace` (Mode A — pet thay banner) | `companion` (Mode B — giữ banner hệ thống + pet). Key này là nguồn chuẩn; cờ cũ của adapter (`windows_nc.suppressNativeToast`, `macos_nc.suppressNativeBanner`) được suy ra từ nó.
> **Mục tiêu bản nâng cấp:** Giữ lại một lõi sản phẩm duy nhất (nhận thông báo → quyền riêng tư → quy tắc/ưu tiên → cảm xúc → phản hồi pet → inbox), bổ sung chế độ thông báo song song và xác định lộ trình mobile khả thi theo giới hạn hệ điều hành.

## 1. Kết luận review V3.7

Blueprint hiện có định hướng sản phẩm mạnh và nhiều tính năng đã được mô tả khá sâu, nhưng đang trộn ba thứ: năng lực đã triển khai, giả định/đề xuất, và mục tiêu chất lượng chưa có bằng chứng. Một số trạng thái hoàn thành cũng mâu thuẫn với báo cáo hiện trạng: ví dụ V3.7 ghi đủ bốn model GLB và đo 74.9 FPS, trong khi `KNOWN_LIMITATIONS.md` nói chưa có GLB production; tài liệu kiểm kê ghi phiên bản khác và nhiều tích hợp chưa xác minh bằng tài khoản thật. Trước mọi tính năng mới, cần chuẩn hóa trạng thái theo bằng chứng và coi báo cáo hiện trạng mới nhất là nguồn chuẩn.

### Nên giữ và nâng cấp

| Nhóm | Quyết định | Nâng cấp cần làm |
|---|---|---|
| Notification pipeline, Attention, Inbox/Digest | Giữ, là lõi dùng chung | Chuẩn hóa notification event; chống trùng idempotent; hàng đợi có giới hạn; quy tắc không làm mất thông báo ưu tiên; inbox lưu trạng thái bền vững. |
| Quyền riêng tư | Giữ, nâng thành cổng kiểm soát đầu tiên | Áp dụng trước log, lưu trữ, pet UI, overlay, đồng bộ và mobile; mặc định chỉ metadata; TTL/retention và xóa dữ liệu rõ ràng. |
| Emotion Engine và Rule Studio | Giữ engine; nâng khả năng giải thích | Hiển thị lý do chọn cảm xúc/quy tắc, độ tin cậy, preview; thêm AND/OR và nhân bản quy tắc sau khi UX cơ bản ổn định. Tránh suy luận cảm xúc quá tự tin. |
| Contact / relationship rules | Giữ, thu gọn phần thông minh | Metadata tối thiểu, opt-in học danh bạ, hiển thị nguồn khớp, sửa/xóa dễ; không tự đưa gợi ý thành quy tắc hoạt động. |
| Desktop pet, âm thanh, animation | Giữ nhưng đặt hiệu năng và khả năng tắt lên trước | Pilot một pet chất lượng; giảm chuyển động; không bắt buộc 60 FPS trên mọi máy; đo CPU/RAM/GPU và độ trễ theo từng chế độ. |
| Tích hợp dịch vụ và thao tác | Giữ những luồng có giá trị, làm rõ mức hỗ trợ | Webhook/Graph/API/polling cần ghi nguồn, độ trễ, quyền, giới hạn và trạng thái xác thực; thao tác ghi dữ liệu (ví dụ Approve) cần xác nhận, chống gửi lặp và kiểm tra kết quả. |
| Accessibility / nền tảng | Nâng ưu tiên | Mô tả API công khai/không công khai, quyền cần thiết, suy giảm an toàn khi bị thu hồi và tương thích từng OS; không gọi workaround là hỗ trợ ổn định. |

### Nên hoãn, bỏ khỏi roadmap chính hoặc gộp lại

- **Bỏ Phase 11 YouTube pet video frame** khỏi blueprint đang hoạt động; ghi một dòng trong lịch sử quyết định thay vì giữ phase/checklist giả như tính năng sẽ quay lại.
- **Hoãn phụ kiện theo mùa và hồ sơ tính cách theo giờ** tới sau khi luồng thông báo, quyền riêng tư và độ tin cậy nền tảng đạt tiêu chí. Không coi đây là điều kiện phát hành.
- **Không làm Smart Emotion Memory chủ động** trong giai đoạn nền tảng. Nếu sau này có phản hồi sửa cảm xúc, chỉ lưu cục bộ khi bật rõ ràng, có xem/xóa và không dùng nội dung thông báo làm hồ sơ mặc định.
- **Bỏ lời hứa cứng “60 FPS”, “CPU <2%”, “0 FPS idle” khỏi acceptance phổ quát.** Thay bằng ngân sách đo theo thiết bị, p95 frame time, pin/CPU, và thời gian render giảm khi idle.
- **Bỏ lặp các yêu cầu tính năng** ở phần vision, phase, checklist và report. Duy trì một roadmap có owner, dependency, trạng thái, tiêu chí hoàn tất; release gate chỉ liên kết tới đó.
- **Gộp 8 cảm xúc, 5 thái độ, 6/7 focus mode, 4 privacy mode và display states** thành các khái niệm rõ: cảm xúc là phản ứng; thái độ là phong cách; focus là chính sách tiếp nhận; privacy là phép biến đổi nội dung; presentation là cách vẽ pet/thông báo.
- **Đánh dấu không khả thi/không cam kết:** đọc hoặc phủ pet lên banner của app khác trên mọi OS; mở đúng chat bằng API hệ thống chung; đồng bộ tự động mọi notification setting giữa desktop và mobile.

## 2. Bổ sung quan trọng: hai chế độ desktop

### Chế độ A — Pet thay banner (hiện tại)
Ứng dụng nhận sự kiện, áp dụng pipeline hiện hữu và trình bày thẻ/pet riêng. Quyền tắt banner gốc chỉ bật theo lựa chọn rõ ràng, có hướng dẫn, trạng thái và phục hồi cấu hình khi thoát/gỡ lỗi **và khi gỡ cài đặt app**. Đây tiếp tục là chế độ tương thích ngược (`notifications.bannerMode = 'replace'`).

**Migration A/B:** người dùng đã cài trước bản có `bannerMode` giữ nguyên hành vi hiện tại — `replace` nếu cờ suppress của adapter đang bật, `companion` nếu đã tắt. Bản cài mới mặc định `companion` (Mode B). Đổi A↔B không được làm mất event đang ở hàng đợi/Inbox.

### Chế độ B — Thông báo hệ thống + Pet Companion
Thông báo gốc của OS vẫn được giữ nguyên. App nhận cùng sự kiện (nếu OS/API cho phép), áp dụng đúng pipeline dùng chung, sau đó hiển thị pet cạnh hoặc bám theo bản sao thông báo của app. Không sửa, che, chiếm click hay giả mạo banner gốc. Pet/card có thể được tắt riêng; thao tác mở thông báo gốc chỉ thực hiện khi platform adapter cung cấp action hợp lệ.

**Định nghĩa “bám lên thông báo”:** một companion card do app vẽ, neo gần vị trí banner nếu hệ điều hành cung cấp vị trí/callback hợp lệ; nếu không, hiển thị ở vùng pet cố định với cùng nội dung đã qua privacy gate và liên kết bằng trạng thái/thời gian. Không được hứa overlay chính xác cho mọi ứng dụng/OS. Trên các OS không cho biết tọa độ hoặc nội dung banner, dùng chế độ “companion liên kết” ở vị trí pet đã chọn.

### Hành vi dùng chung, không nhân đôi tính năng

```text
Nguồn OS / connector
  → chuẩn hóa event
  → dedupe + nguồn/định danh
  → privacy gate (trước log/lưu/UI)
  → quy tắc người quen + focus + priority + attention
  → emotion/attitude + sound policy
  → inbox/digest (nếu cần)
  → presentation adapter: thay banner | banner gốc + pet companion
```

Các thao tác, lọc, ưu tiên, giờ yên tĩnh, Focus, cảm xúc, âm thanh, inbox, người quen, Jira/Bitbucket và quy tắc vẫn thuộc cùng lõi. `bannerMode` chỉ quyết định cách trình bày. Không đổi tên field của event contract hiện có (`normalize()` trong `notification-pipeline.js`); ánh xạ khái niệm: `eventId` = `id` + `deduplicationKey`/`sourceEventId`, `receivedAt` = `desktopReceivedAt`, `privacyPayload` = item sau `privacy.project()` (đánh dấu bằng field `privacy`), `emotionDecision` = `emotion`/`contentEmotion`/`matchedBy`/`rule`, `actions`, `priority`. `bannerMode` là cài đặt toàn cục, không phải field của từng event. Không lưu raw content nếu privacy policy cấm.

**Hành vi riêng của Mode B (bắt buộc):**
- Không gọi bất kỳ action nào lên banner gốc (`dismissNativeBanner`, bấm hộ, đóng hộ) và không ghi registry/ncprefs.
- Âm thanh: banner gốc đã có tiếng, nên pet mặc định **im lặng** ở Mode B (người dùng có thể bật lại); không bao giờ phát hai tiếng cho một event.
- Vị trí: companion card không đặt trùng vùng banner hệ thống (Windows: góc dưới phải trên màn hình chính; macOS: góc trên phải). Nếu pet đang ở vùng đó, card lệch sang phía còn lại của pet.

### UX và an toàn

- Cài đặt đơn giản: **Thay thông báo hệ thống** / **Giữ thông báo hệ thống + pet đồng hành**; mô tả quyền và giới hạn trước khi bật.
- Companion mặc định nhỏ, không che nội dung/controls, tự hết hạn cùng banner hoặc thời gian cấu hình; giới hạn số card đồng thời và gom sự kiện dồn dập.
- Full/Masked/Source only/Hidden phải cho kết quả nhất quán ở pet, card, inbox, log, preview và ảnh chụp màn hình trong app.
- Bấm card mở nguồn/đích chỉ khi adapter hỗ trợ; nếu không thì mở app hoặc đưa ra hành động khả dụng. Không giả lập click vào banner riêng tư.
- Tôn trọng Do Not Disturb/Focus của hệ thống; chế độ “khẩn cấp” chỉ áp dụng cho nguồn/quy tắc người dùng chọn.
- Có khay trạng thái quyền: listener, Accessibility/notification access, connector, banner suppression; báo rõ khi nguồn bị trễ hoặc mất.

## 3. Khả năng theo nền tảng

| Nền tảng | Nhận sự kiện | Hiển thị pet cạnh banner gốc | Hướng triển khai |
|---|---|---|---|
| Windows 10/11 | Toast listener hiện có | Không có API chung đáng tin cậy để lấy tọa độ và gắn nội dung lên toast của app khác. Companion riêng gần pet là khả thi hơn; overlay toàn màn hình cần thử nghiệm và tránh chiếm tương tác. | Giữ toast gốc, không chỉnh registry ở chế độ B; companion window không kích hoạt, click-through ngoài vùng điều khiển, tự căn màn hình/DPI. |
| macOS | Notification Center/Accessibility hiện có với giới hạn và quyền | Có thể quan sát banner qua Accessibility ở một số cấu hình nhưng là phụ thuộc giao diện/không ổn định; không cam kết neo chuẩn hoặc sống qua cập nhật OS. | Bản đầu companion liên kết ở cạnh pet; adapter Accessibility chỉ là capability tùy chọn có cảnh báo tương thích. Không dùng API riêng để giả lập như API công khai. |
| iOS | App không được đọc notification của app khác | Không thể tạo pet nổi trên notification/banner của ứng dụng khác; iOS không cho app tùy ý vẽ overlay toàn hệ thống. | Mobile app là companion độc lập: push tới chính app, inbox, widget/Live Activities khi phù hợp, Focus và đồng bộ cài đặt có kiểm soát. Không thay notification của app khác. |
| Android | Notification access chỉ khi người dùng cấp quyền Notification Listener | Không có overlay hợp lệ tự động dính vào mọi banner; overlay permission xâm lấn và bị giới hạn chính sách/OEM. | Ưu tiên Notification Listener + pet trong app/widget; tùy chọn overlay riêng chỉ sau nghiên cứu UX, pin, quyền, chính sách Play và có bật/tắt rõ. Không bắt buộc cho MVP. |

## 4. Blueprint mobile app

### Mục tiêu và phạm vi
Ứng dụng mobile là **companion cho hệ sinh thái**, không phải bản sao desktop thu nhỏ và không hứa thay notification system. Cung cấp pet 2D nhẹ, inbox, cảm xúc/rule cơ bản, quản lý focus và kết nối thiết bị; tận dụng push do chính dịch vụ tích hợp gửi tới app khi có quyền. Mobile không thể đọc toàn bộ notification ứng dụng khác trên iOS; Android có thể nhận qua Notification Listener opt-in nhưng cần đánh giá riêng quyền riêng tư, phân phối và pin.

### MVP mobile (ưu tiên Android/iOS chung)
1. Onboarding, chọn pet/tính cách, quyền thông báo của chính app, cài đặt riêng tư và giải thích đồng bộ.
2. Home pet 2D nhẹ, trạng thái và tương tác cơ bản; không cần 3D realtime ở bản đầu.
3. Inbox/Digest dùng chung schema, trạng thái đã xem/lưu trữ, lọc nguồn và search cục bộ.
4. Quy tắc cơ bản: nguồn, từ khóa, ưu tiên, Focus/Quiet Hours; thêm người quen thủ công. Advanced AND/OR và học tự động để sau.
5. Push cho sự kiện do backend/connector hợp pháp hỗ trợ; deep link về app và nguồn gốc khi adapter có URL.
6. Đồng bộ tùy chọn, có chọn trường dữ liệu, mã hóa khi truyền/lưu, quản lý phiên đăng nhập và thu hồi thiết bị.
7. Accessibility: Dynamic Type/font scaling, screen reader, reduced motion, dark mode, haptic opt-in, pin/data controls.

### Mobile sau MVP (Post-MVP)
- Android notification access opt-in: ingest metadata theo allowlist, preview trước khi bật, per-app denylist, pause, xóa cục bộ, không upload raw notification mặc định.
- Widget pet/inbox; Android notification shortcuts và iOS widgets/Live Activities chỉ cho dữ liệu/sự kiện thuộc app và theo giới hạn nền tảng.
- Sync rule/settings; conflict resolution theo thời gian + nguồn thiết bị, không đồng bộ secrets/token trong export.
- Pet 3D mobile hoặc AR chỉ sau benchmark pin/nhiệt, kích thước tải xuống và thiết bị hỗ trợ.
- Không làm overlay universal trên iOS; Android floating pet/overlay là thử nghiệm sau MVP, không phải cam kết parity.

### Ranh giới dữ liệu desktop/mobile

- Mặc định mobile không nhận raw desktop notification. Sync chỉ cấu hình, metadata tối thiểu và event người dùng chủ động chọn chia sẻ.
- Nếu bật sync inbox: cho chọn nguồn, loại nội dung, retention; payload đã qua privacy gate; xóa/thu hồi đồng bộ có tác dụng trên thiết bị đã đăng nhập theo chính sách.
- Credentials connector lưu trong kho bảo mật hệ điều hành, không trong settings JSON; backend chỉ giữ token cần thiết, scope tối thiểu và có nút revoke.
- Thiết kế transport có thể dùng relay/push service, nhưng không đưa Composio/cloud AI vào xử lý nội dung nhạy cảm nếu chưa có consent rõ và đánh giá riêng.

## 5. Lộ trình ưu tiên và cổng hoàn tất

| Phase | Ưu tiên | Phạm vi | Hoàn tất khi |
|---|---|---|---|
| 0 — Chuẩn hóa sự thật | P0 (≤ 1 ngày, không chặn Phase 1–2) | Cập nhật `IMPLEMENTATION_STATUS.md` / `KNOWN_LIMITATIONS.md` theo version hiện hành; đánh số lại; phân loại `Implemented`, `Partial`, `Verified`, `Not tested`, `Unsupported`, `Planned`. | Mỗi tuyên bố có nguồn bằng chứng hoặc nhãn kế hoạch; version/ngày khớp `package.json`; không còn trạng thái tự mâu thuẫn. |
| 1 — Ổn định lõi | P0 | Lõi đã có (dedupe theo ID + cửa sổ thời gian, privacy projection trước sink, Inbox ghi nguyên tử, tràn hàng đợi → Inbox). Việc còn lại: test hợp đồng "không sink nào nhận nội dung chưa chiếu", **khôi phục cấu hình hệ thống khi gỡ cài đặt (Windows NSIS)**, bảng tình trạng nguồn (listener sống, event cuối, quyền thiếu). | Không mất/nhân đôi event trong luồng chuẩn; privacy modes áp dụng đồng nhất; gỡ app không để lại banner bị tắt; lỗi quyền có trạng thái khôi phục. |
| 2 — Desktop mode B | P0 | `notifications.bannerMode` + migration (§2); Mode B không đụng banner gốc, pet im lặng mặc định, card tránh vùng banner. Windows trước; macOS theo capability. | A/B đổi được không mất event; B không sửa registry/ncprefs và không gọi action lên banner gốc; không phát hai âm thanh cho một event; có test tự động cho chuyển A↔B. |
| 3 — Desktop hardening | P0 | Test nền tảng thật, quyền, multi-monitor/DPI, Focus, sleep/resume, burst, restart/uninstall, accessibility. | Ma trận hỗ trợ công khai; khôi phục settings; hiệu năng/độ trễ đo được theo máy; giới hạn được ghi rõ. |
| 4a — Trải nghiệm người mới | P1 | Onboarding tối thiểu (pet → Mode → riêng tư → giờ yên tĩnh); chuột phải trên thẻ có Undo + 4 preset; Mode B mặc định cho bản cài mới. | Người mới thiết lập được trong vài phút không cần tài liệu (UX gate §11.3). |
| 4b — Độ bền chạy nền | P1 | Script soak test 8 giờ + đo idle. | Trên máy văn phòng tham chiếu, 8 giờ không có xu hướng tăng RAM liên tục, không có CPU wakeup/render loop đáng kể khi idle, pet ngủ đúng chính sách, quạt không tăng rõ rệt so với baseline; lưu RAM đầu/cuối, CPU trung bình/p95, wakeups. |
| 4c — Phát hành | P1 | Ký app, auto-update có chữ ký + rollback, tích hợp phổ thông đã xác minh bằng tài khoản thật (Lịch, Outlook, GitHub). Gọn Control Center chỉ sau khi có bảng ánh xạ tính năng. | Build Windows/macOS ký đúng quy trình (closed beta được miễn, xem §10.6); cập nhật/rollback được kiểm chứng; connector công bố đều có verified account test. |
| 5 — Mobile foundation và MVP | P2 | Chỉ sau khi desktop beta cung cấp tín hiệu nhu cầu: chọn framework, domain model/API, app shell, pet 2D nhẹ, inbox và push cho sự kiện của chính app. | iOS/Android MVP dùng được không cần quyền đọc notification; offline inbox, session revoke và xóa dữ liệu được định nghĩa. |
| 6 — Mobile notification capability và selective sync | P2 | Android listener opt-in với kiểm soát theo app; iOS push/widget/Live Activities cho sự kiện app được phép; đồng bộ chọn lọc settings/metadata. | Preview quyền, pause/revoke/delete; kiểm tra pin/riêng tư; iOS không đọc notification bên thứ ba; sync có thể tắt độc lập. |
| 7 — Personalization mở rộng | P2 | Rule AND/OR, simulator, học phản hồi opt-in, âm thanh file, theme/phụ kiện, asset packs cộng đồng sau khi có mô hình an toàn. | Chỉ tiến hành khi adoption/support metrics cho thấy giá trị; mọi học tự động có giải thích và undo. |

## 6. Tiêu chí đo lường mới

- **Độ tin cậy:** tỷ lệ event ingest, duplicate/loss, restart recovery; thống kê riêng theo nguồn/OS.
- **Độ trễ:** p50/p95 từ OS event tới companion render, phân biệt listener/API/polling.
- **Quyền riêng tư:** kiểm tra mọi sink nhận payload đã sanitize; log không có raw content; retention/xóa có xác minh.
- **Tương tác:** tỷ lệ dismiss/open/inbox, thời gian pet/card chiếm màn hình, số lần người dùng tắt mode; không tối ưu engagement bằng cách tăng gián đoạn.
- **Tài nguyên:** CPU/RAM/GPU, idle wakeups, pin/nhiệt trên mobile; báo theo thiết bị tham chiếu và workload.
- **Khả năng tiếp cận:** keyboard/screen reader, font scale, reduced motion, contrast và vùng tương tác.

## 7. Quy tắc biên tập blueprint từ bản này

1. Đây là đề xuất roadmap V4.0; trạng thái thực thi chỉ cập nhật sau khi kiểm tra code và thiết bị thật.
2. Gỡ phase YouTube khỏi roadmap đang hoạt động; lưu quyết định lịch sử ngắn gọn.
3. Mỗi phase chỉ có một checklist chuẩn; report là bằng chứng, không lặp toàn bộ tính năng.
4. Mỗi tích hợp nêu protocol, quyền, độ trễ, dữ liệu truyền, trạng thái test thật và fallback.
5. Phân biệt **notification capture** (đọc sự kiện), **notification presentation** (OS/app hiển thị) và **pet companion presentation** (lớp do app vẽ).
6. Không tuyên bố feature parity giữa Windows/macOS/iOS/Android khi khả năng API khác nhau.


## 8. Chuẩn sản xuất pet tự nhiên, giàu sức sống và nhất quán chức năng

### 8.1 Mục tiêu nghệ thuật

Hướng đến **stylized-realistic**: vật liệu, ánh sáng, tỷ lệ và chuyển động gợi cảm giác thú cưng thật; hình dáng vẫn dễ thương, dễ đọc ở kích thước nhỏ và thống nhất với bản sắc Mochi, Boba, Cloud, Pip. Không dùng photorealism nặng chi tiết làm mất biểu cảm, không biến nhân vật thành bản sao giống hệt một con vật có thật. Cả bốn nhân vật cần chung ngôn ngữ ánh sáng/chất liệu nhưng rig, dáng đi, tai, đuôi và nhịp chuyển động phải đúng từng loài.

### 8.2 Gói tư liệu cần chuẩn bị cho từng nhân vật

- **Character brief:** loài/giống, tuổi biểu kiến, tỷ lệ đầu-thân, tính cách, màu chủ đạo, dấu hiệu nhận diện, các điều không được thay đổi giữa góc nhìn và cảm xúc.
- **Ảnh tham chiếu có quyền sử dụng:** mặt trước, hai bên, sau, góc 3/4, cận mắt/mũi/chân/lông; ánh sáng trung tính, nền sạch, không che khuất. Ghi rõ ảnh chỉ tham khảo hay được phép dùng để huấn luyện/tạo sinh; lưu tác giả, nguồn, giấy phép và ngày nhận. Không dùng ảnh người dùng hoặc ảnh thú cưng riêng tư làm dữ liệu huấn luyện nếu chưa có đồng ý rõ.
- **Color/material sheet:** bảng màu sRGB/linear, màu mắt/mũi/da, roughness, sheen, độ dài và hướng lông, vùng lông khác màu, phụ kiện tách riêng để bật/tắt. Không bake chữ/logo thương hiệu vào model.
- **Expression/pose sheet:** 8 cảm xúc chuẩn, neutral, blink, nhìn theo con trỏ, tương tác vuốt/kéo, và pose nghỉ; mỗi trạng thái ghi rõ mắt, tai, miệng, đầu, thân, đuôi và cường độ. Tránh cảm xúc xung đột hoặc quá người hóa.
- **Âm thanh tham chiếu:** meow/woof/squeak/chirp phù hợp nhân vật, ambient/footstep/purr nếu cần; lưu nguồn, giấy phép, người thu và quyền sử dụng thương mại. Thu nhiều take ngắn, có khoảng lặng; không dùng âm thanh tổng hợp bắt chước tiếng thú thật nếu nghe giả hoặc gây giật mình.
- **Technical profile:** target desktop/mobile, giới hạn polygon/texture/draw calls/file size, bộ clip, morph targets, semantic mapping và cấu hình fallback.

### 8.3 Quy trình tạo hình ảnh/model

1. Khóa silhouette và character sheet 2D trước; duyệt nhận diện ở thumbnail, grayscale và 8 hướng cơ bản. Không bắt đầu sculpt chi tiết trước khi silhouette/tỷ lệ được duyệt.
2. Tạo base mesh trong Blender hoặc quy trình image-to-3D có artist kiểm tra. AI output chỉ là bản nháp: bắt buộc sửa anatomy, topology, UV, mắt/miệng và vùng giao nhau; không đưa thẳng mesh lỗi vào runtime.
3. Tạo topology sạch, deformation loops quanh vai/hông/miệng/mắt; rig riêng từng loài, trọng tâm và bàn chân ổn định; thêm secondary motion có damping cho tai/đuôi/chuông. Tránh rung vô cớ.
4. UV/material PBR gọn: base color, normal khi có giá trị ở kích thước app, roughness; ưu tiên texture atlas và mipmaps. Lông dùng clumps/tufts có silhouette rõ hoặc shader nhẹ; tránh hàng nghìn alpha planes gây overdraw.
5. Face rig phải hỗ trợ blink bất đối xứng, hướng nhìn, squint, jaw/muzzle và 8 cảm xúc; morph targets/tên clip được ánh xạ qua semantic map, không hard-code theo một skeleton chung.
6. Tạo LOD hoặc quality tier cho desktop/mobile; đặt pivot/scale/forward-axis chuẩn; nén texture/mesh phù hợp; giữ file nguồn `.blend`, texture nguồn, license và manifest cùng bản export GLB.
7. Review render dưới UI thật: nền sáng/tối, pet 96–256 px, màn hình DPI khác nhau, card notification và pet solo; chi tiết đẹp ở full size nhưng phải còn đọc được khi thu nhỏ.

### 8.4 Chuyển động tự nhiên

- Ghi video tham chiếu hoặc quan sát chuyển động hợp pháp của từng loài; animator tạo pose/keyframe có nhịp và trọng lượng, không retarget máy móc cùng clip giữa mèo/chó/thỏ/cánh cụt.
- Tạo bộ tối thiểu theo giai đoạn: `idle_breathe`, `blink`, `look`, `happy`, `excited`, `love`, `surprised`, `angry/grumpy`, `sad`, `thinking`, `sleeping`, `pet`, `grabbed`, `recover`. Không yêu cầu mỗi trạng thái phải là clip dài; blend clip, facial morph và procedural secondary motion khi phù hợp.
- Idle phải có biến thiên theo thời gian (thở, chớp mắt, đổi hướng nhìn), nhưng không lặp chu kỳ lộ liễu. Event reaction có anticipation → action → settle; trở về đúng idle/Focus state sau khi card hết hạn.
- Khóa API/semantic contract trước khi thay asset: 8 canonical emotion IDs, interaction events, animation priority, interruption/cancel, reduced motion và fallback không đổi. Asset thiếu clip/morph thì dùng fallback cũ an toàn; asset lỗi không chặn notification hoặc Inbox.
- Tách thời lượng pet reaction khỏi vòng đời thông báo; card bị thay/dismiss phải dừng clip/VFX/audio tương ứng. Không phát âm thanh khi mute, giờ yên tĩnh, focus chặn hoặc user tắt audio.

### 8.5 Thu và xử lý âm thanh tự nhiên

- Thu/đặt mua từ thư viện có license rõ; chọn nhiều take ngắn theo character, không chỉ đổi pitch của một mẫu. Tránh tiếng kêu gây nhầm như báo động/âm thanh hệ thống.
- Lưu master WAV mono/stereo 48 kHz/24-bit; runtime encode OGG/Opus hoặc định dạng tương thích theo platform. Giữ peak headroom, normalize loudness nhất quán theo perceptual LUFS; kiểm tra trên loa laptop, tai nghe và âm lượng thấp.
- Có biến thể ngẫu nhiên, pitch/time variation rất nhẹ trong giới hạn không làm méo; thêm cooldown, giới hạn tần suất và không chồng lấp âm thanh. Không cắt transient/đuôi tiếng, không click ở loop boundaries.
- Mỗi âm thanh có manifest: ID, nhân vật, event/emotion, file, license/source, loudness, duration, cooldown, fallback procedural. Cho người dùng preview, chỉnh volume/mute và tắt riêng voice/effects.
- Không đọc nội dung notification thành tiếng; voice line chỉ là câu cố định, opt-in và theo sound policy. Tôn trọng system mute, output device changes và app suspend/resume.

### 8.6 Bảo toàn chức năng và tương thích

- Giữ `pet-manifest.json`, mỗi `pet.json`, stable character ID, emotion IDs, event contracts và setting keys tương thích; nâng schema có migration và rollback.
- Asset loader hỗ trợ version, checksum, timeout, giới hạn kích thước, validate node/clip/morph; lỗi tải hoặc shader thì quay về procedural pet hiện tại, còn notification pipeline tiếp tục chạy.
- Không để asset pack thực thi code; chỉ đọc model/texture/audio đã validate. User import phải sandbox hóa, giới hạn kích thước/định dạng và có reset về default.
- Mode “thay banner” và “system banner + pet companion” dùng cùng pet renderer/animation/audio controller; presentation adapter không sở hữu logic cảm xúc, privacy, Inbox hay quick action.
- Không lưu notification content trong asset logs/crash report; log asset chỉ gồm ID, version và mã lỗi kỹ thuật.
- Với mobile, dùng cùng character IDs/emotion semantics nhưng cho phép asset LOD/mobile pack, clip rút gọn và 2D fallback; không bắt mobile render model desktop.

### 8.7 Quy trình duyệt và tiêu chí nghiệm thu asset

**Giai đoạn duyệt:** concept silhouette → turnaround/color sheet → graybox rig → lookdev → animation preview → runtime integration → license/performance sign-off. Duyệt Mochi làm pilot; sau khi pipeline đạt chuẩn mới nhân rộng từng loài.

Asset chỉ đạt khi:

- Nhận ra đúng nhân vật ở thumbnail, 8 hướng, nền sáng/tối; vật liệu không nhấp nháy hoặc bệt khi scale nhỏ.
- Không xuyên mesh, trượt chân rõ, gãy khớp, méo mắt/miệng; clip có anticipation/settle và chuyển trạng thái sạch.
- 8 emotion IDs và interaction callbacks ánh xạ đúng; hidden/focus/reduced-motion/mute/privacy hoạt động như trước; asset lỗi vẫn quay về fallback.
- Tải/giải phóng tài nguyên đúng vòng đời, không tăng dần RAM/texture/audio; đo frame time và bộ nhớ trên cấu hình tham chiếu desktop và mobile tier.
- Âm thanh không clipping/click, không quá lớn, không spam; người dùng có mute/preview; license/source được lưu cùng asset manifest.
- Có checklist QA, ảnh/video capture runtime, hardware profile, asset version/checksum và người duyệt; chưa có bằng chứng thì ghi `Not verified`, không đánh dấu production.

**Deliverables cho pilot:** character brief + reference/license pack; turnaround và expression sheet; `.blend` có tổ chức; GLB runtime; texture/source; clip/morph map; audio masters + runtime encodes; `pet.json`/manifest; preview ở kích thước thật; benchmark; test/fallback report. Chưa có đủ gói này thì chưa được coi là pet production-ready. Pipeline asset này là track song song, **không chặn** Phase 4a–4c: beta dùng rig procedural; GLB thay vào khi đạt §8.7 mà không đổi semantic contract.


## 9. Báo cáo tình trạng, ưu điểm và hạn chế theo nền tảng

> **Cách đọc:** “Hiện trạng” dưới đây được tổng hợp từ blueprint và `docs/reports/KNOWN_LIMITATIONS.md` / `IMPLEMENTATION_STATUS.md` đang có trong repository. Báo cáo hiện trạng có ngày cập nhật cũ hơn bản kế hoạch này; cần Phase 0 đối chiếu lại với build/code và thiết bị trước khi công bố tương thích. Android/iOS hiện là kế hoạch, chưa phải app đã triển khai.

### 9.1 Tóm tắt trạng thái

| Nền tảng | Tình trạng trong dự án | Thu nhận notification bên thứ ba | Mode A: pet thay banner | Mode B: giữ banner + pet | Mức tin cậy hiện tại |
|---|---|---|---|---|---|
| Windows 10/11 | Desktop Electron; Windows 11 listener/toast đã được ghi nhận chạy trên máy thật; một số hành vi âm thanh, lần đầu và lifecycle còn cần kiểm chứng. | WinRT Toast Listener, gần realtime theo báo cáo; phụ thuộc quyền/cấu hình và loại nguồn. | Có giải pháp tắt banner/âm thanh qua registry người dùng; cần backup/restore tốt và lưu ý gỡ app khi đang bật. | Giữ toast gốc là hướng khả thi; pet companion riêng gần vị trí pet là mục tiêu. Neo chính xác lên toast bên thứ ba chưa có API chung đáng tin cậy. | Trung bình; cần kiểm thử release build, nhiều phiên bản Windows, DPI/multi-monitor, uninstall/recovery. |
| macOS | Desktop Electron + native bridge; đọc Notification Center; bắt banner nhanh phụ thuộc Accessibility và cơ chế giao diện. | Có thể đọc kho thông báo hoặc quan sát banner; đường đọc kho trễ khoảng vài giây; Composio một số nguồn polling. | Có thể tắt banner gốc theo cơ chế hiện tại nhưng một số app có thể bật lại; yêu cầu quyền và kiểm thử sau update. | Companion liên kết ở vùng pet là phương án an toàn. Neo chính xác có thể phụ thuộc Accessibility/phiên bản OS, không được cam kết phổ quát. | Trung bình/thấp theo nguồn; ký/notarize và quyền Accessibility ảnh hưởng onboarding. |
| Android | Chưa triển khai theo blueprint V4.0. | Notification Listener có thể được xem xét khi người dùng chủ động cấp quyền; cần kiểm tra policy, OEM và pin. | Không nằm trong phạm vi MVP; thay banner hệ thống không phải giả định hỗ trợ. | Pet trong app/widget là baseline. Overlay/floating pet chỉ là thử nghiệm opt-in sau đánh giá UX, chính sách và tài nguyên. | Chưa đánh giá thực tế. |
| iOS | Chưa triển khai theo blueprint V4.0. | App không được đọc notification từ app khác qua API chung. | Không hỗ trợ thay notification của app khác. | Không có pet overlay toàn hệ thống. Companion dùng inbox/push của chính app, widget hoặc Live Activities trong giới hạn nền tảng. | Chưa đánh giá thực tế. |

### 9.2 Windows

**Ưu điểm**
- Tích hợp Toast Listener hiện có giúp bắt sự kiện nhanh mà không cần poll cho một số notification Windows.
- Có đường mở ứng dụng nguồn theo AUMID và desktop app có thể dùng cửa sổ pet/companion riêng.
- Windows 11 thật đã được báo cáo chạy listener và gói cài NSIS; đây là nền tảng phù hợp để pilot Mode B.

**Hạn chế và rủi ro**
- Windows không cung cấp API chung để app bên thứ ba lấy chính xác tọa độ, nội dung đầy đủ, nút hành động và vòng đời của toast từ mọi ứng dụng. Vì vậy “pet bám chính xác lên banner” không phải cam kết chung.
- Mode A sửa registry người dùng để tắt banner/âm thanh; phải sao lưu đúng giá trị, khôi phục khi tắt/thoát/crash/gỡ cài đặt và xử lý lần khởi chạy đầu. Không dùng thay đổi registry ở Mode B.
- Âm thanh gốc, toast của app mới, app chạy qua browser, DPI/multi-monitor, lock screen và Windows Focus cần ma trận kiểm chứng riêng.
- “Mở app” không đồng nghĩa mở đúng cuộc chat/trang web; thao tác phải hiển thị fallback trung thực.

**Định hướng:** ưu tiên Mode B với banner OS không đổi và companion card của app ở vị trí cấu hình được/gần pet. Tiếp tục duy trì Mode A với cảnh báo rõ, chức năng khôi phục và không bật ngầm.

### 9.3 macOS

**Ưu điểm**
- Có tích hợp native bridge hiện hữu để đọc Notification Center; khi Accessibility cho phép bắt banner nhanh và tương tác có thể giàu ngữ cảnh hơn.
- Môi trường desktop phù hợp với pet overlay, renderer hiện có và các thao tác kéo/thả.

**Hạn chế và rủi ro**
- Notification Center polling/đọc kho có độ trễ; Focus có thể ngăn banner trong khi event chỉ xuất hiện trong kho sau đó.
- Quan sát banner bằng Accessibility phụ thuộc quyền, cấu trúc UI và phiên bản macOS; Apple có thể thay đổi giao diện. Đây không phải API hỗ trợ ổn định cho mọi app.
- App chưa notarize theo báo cáo limitations; cài đặt trên máy khác có thể tạo cảnh báo và giảm tỷ lệ người dùng cấp quyền.
- Một số ứng dụng tự bật lại banner hoặc không cung cấp đủ thông tin để deep-link đúng cuộc hội thoại.

**Định hướng:** Mode B mặc định dùng companion riêng không che banner; capability Accessibility là tùy chọn, có trạng thái quyền và fallback. Mode A chỉ bật sau consent, theo dõi trạng thái khôi phục và nêu giới hạn cụ thể.

### 9.4 Android

**Ưu điểm tiềm năng**
- Notification Listener có thể cho phép ingest notification sau khi người dùng chủ động bật quyền; hệ sinh thái widget/notification action có thể làm companion tiện dụng.
- Có thể xây dựng pet home screen/widget nhẹ, inbox offline và push cho sự kiện của chính dịch vụ.

**Hạn chế và rủi ro**
- Notification access là quyền nhạy cảm, đọc được dữ liệu riêng tư; phải có giải thích trước khi bật, allowlist app, pause/revoke và xóa dữ liệu. Mặc định không gửi raw notification lên cloud.
- Cách hoạt động nền, pin, giới hạn autostart và notification bị ẩn khác nhau theo hãng/OEM/phiên bản Android.
- Overlay permission có thể làm người dùng lo ngại, bị giới hạn bởi policy/phân phối và có nguy cơ che nội dung hoặc nút thao tác; không đặt làm điều kiện để app dùng được.
- Chưa có implementation hoặc benchmark trong dự án; mọi tuyên bố tương thích cần chờ prototype và thiết bị thật.

**Định hướng:** MVP không cần quyền Notification Listener: pet, inbox và push của chính app hoạt động độc lập. Nghiên cứu listener opt-in trong giai đoạn sau; floating pet là thử nghiệm riêng.

### 9.5 iOS

**Ưu điểm tiềm năng**
- Có thể phát triển companion app ổn định với pet 2D/3D nhẹ, inbox, widget, push của chính app và Live Activities khi use case phù hợp.
- Hệ thống quyền nhất quán hơn về cách cấp quyền notification cho app của mình; có thể đồng bộ cấu hình nếu thiết kế backend/privacy phù hợp.

**Hạn chế và rủi ro**
- iOS không cho app đọc nội dung notification của ứng dụng khác, thay banner của chúng hoặc đặt pet nổi toàn hệ thống. Đây là giới hạn nền tảng, không phải thiếu tính năng của sản phẩm.
- Push chỉ bao phủ nguồn tích hợp gửi tới app/backend và cần thiết kế token, quyền, background delivery, đăng xuất/thu hồi; không đảm bảo chạy tức thì trong mọi trạng thái.
- Widget/Live Activities có giao diện và thời lượng do hệ thống quản lý, không tương đương cửa sổ pet desktop hay overlay tùy ý.
- Chưa có app iOS, backend sync/mobile API hoặc kiểm thử phân phối trong repository; cần xác định kiến trúc, chi phí vận hành và privacy trước khi chốt framework.

**Định hướng:** iOS là companion độc lập cho pet, inbox, push từ dịch vụ tích hợp, widget/Live Activities phù hợp; không quảng bá khả năng đọc notification app khác.

### 9.6 Kết luận sản phẩm và điều kiện công bố

- **Mode B desktop:** đặt làm mục tiêu chính cho trải nghiệm “giữ notification gốc + pet đồng hành”; triển khai companion card tách biệt, dùng chung lõi xử lý. Hỗ trợ neo theo banner chỉ công bố trên tổ hợp OS/app đã xác minh.
- **Windows:** ưu tiên pilot Mode B vì listener hiện hữu đã có bằng chứng trên Windows 11; bổ sung kiểm thử khôi phục, DPI, monitor và lifecycle trước phát hành rộng.
- **macOS:** giữ support theo capability; nêu rõ khác biệt giữa đọc Notification Center và bắt banner Accessibility. Không để chế độ phụ thuộc Accessibility làm hỏng fallback.
- **Mobile:** phát triển như companion có inbox/pet/push riêng; Android listener là quyền tùy chọn ở phase sau; iOS không đọc notification bên thứ ba.
- Mỗi dòng hỗ trợ trong release notes cần ghi **OS/build, nguồn notification, quyền cần cấp, độ trễ đo được, hành động khả dụng, fallback và ngày kiểm thử**. Chỉ đánh dấu `Verified` khi có bằng chứng trên bản build phát hành và thiết bị thật; nếu không ghi `Partial`, `Not tested` hoặc `Unsupported`.


## 10. Kế hoạch đưa sản phẩm tới người dùng phổ thông

### 10.1 Định vị và ưu tiên

Cute Pet Companion nên được giới thiệu trước tiên như **pet đồng hành giúp quản lý thông báo nhẹ nhàng**, thay vì một bảng điều khiển tự động hóa công việc. Lợi thế sản phẩm cần được chứng minh bằng trải nghiệm thực tế: pet có cá tính, người dùng kiểm soát được điều gì làm gián đoạn mình, và dữ liệu nhạy cảm được xử lý minh bạch. Không dùng tuyên bố tuyệt đối như “bảo mật tuyệt đối/on-device hoàn toàn” khi một số connector hoặc luồng đồng bộ có xử lý ngoài thiết bị.

**Ưu tiên phát hành:** Desktop Windows/macOS trước; mobile chuyển thành giai đoạn sau khi desktop beta chứng minh được nhu cầu và năng lực vận hành. Đây là quyết định phân bổ nguồn lực, không phải hủy mobile. iOS/Android có thể tiếp tục discovery/technical spike nhỏ, nhưng chưa xây đồng thời backend đồng bộ và hai ứng dụng hoàn chỉnh trong P0/P1.

### 10.2 Onboarding 5 phút và cấu hình theo tầng

Luồng lần đầu chỉ hỏi thông tin thiết yếu:

1. Chọn pet (pilot public beta: Mochi; nhân vật khác vẫn chọn được bằng rig procedural hiện có, được quảng bá dần khi asset production-ready).
2. Chọn mục đích gần nhất: Công việc, Học tập hoặc Cá nhân; cho phép bỏ qua.
3. Chọn cách hiển thị, mặc định **Giữ thông báo hệ thống + Pet Companion (Mode B)**.
4. Chọn mức riêng tư đơn giản và thời điểm yên tĩnh; giải thích rõ quyền trước khi mở system settings.
5. Vào sử dụng ngay; kết nối dịch vụ và quy tắc nâng cao là bước tùy chọn sau onboarding.

Preset chỉ khởi tạo cấu hình có thể xem/sửa, không tự xin quyền, kết nối tài khoản hoặc bật đọc notification. Cần có “Bỏ qua”, “Đặt lại mặc định” và đường dẫn giải thích vì sao một thông báo bị lọc.

### 10.3 Thu gọn Control Center và khái niệm

Đề xuất điều hướng người dùng thành 5 khu vực:

- **Trang chủ & Pet:** trạng thái, chọn nhân vật, tương tác, preview.
- **Thông báo & Tập trung:** Mode A/B, nguồn, ưu tiên, giờ yên tĩnh, inbox/digest.
- **Người quen & Quy tắc:** danh sách người/nhóm, preset dễ hiểu, quy tắc cơ bản; nâng cao nằm sau “Tùy chỉnh nâng cao”.
- **Kết nối:** app/service, trạng thái quyền và độ trễ, kết nối/tắt kết nối.
- **Cài đặt:** riêng tư, âm thanh, giao diện, accessibility, cập nhật, dữ liệu.

Đây là cấu trúc UX mục tiêu; trước khi gộp tab hiện có phải lập bảng ánh xạ tính năng để không làm mất capability. **Lối cấu hình ưu tiên số 1 cho người mới là chuột phải lên thẻ thông báo → Xếp nhóm/đặt mức ưu tiên** (đã có: `quickAssignMenu` trong `src/main/index.js`, gán nhóm quan hệ cho người/nhóm chat; việc còn lại là Undo, giải thích kết quả và gom về 4 preset dưới đây — preset ánh xạ vào nhóm quan hệ sẵn có, không đổi dữ liệu cũ): thao tác này tạo hoặc cập nhật quy tắc đơn giản ngay tại ngữ cảnh, có Undo và giải thích kết quả; không bắt người dùng mở Control Center để xử lý lần đầu. Thay vì buộc chọn trong 11 loại quan hệ, cung cấp 4 preset dễ hiểu: **Ưu tiên cao**, **Công việc**, **Cá nhân**, **Im lặng**; “nhãn tùy chỉnh” là lựa chọn mở rộng. Thay vì nhiều Focus mode ngang cấp, trình bày 3 chế độ: **Bình thường**, **Tập trung**, **Im lặng/Họp**; các ngoại lệ và lịch tự động là cài đặt phụ. Các trạng thái hiện diện (Full/Minimal/Hidden) là cách hiển thị pet, không phải Focus mode.

Giữ tối đa 2 giao diện mặc định ở public beta (**Sáng**, **Tối**, có thể theo hệ thống); theme trang trí thêm sau khi kiểm tra contrast, reduced motion và bảo trì.

### 10.4 Ưu tiên tích hợp theo nhu cầu, không theo độ phức tạp kỹ thuật

- **P0:** Notification hệ thống + inbox ổn định, Mode B, thông báo lịch họp và mở link cuộc họp khi nguồn cung cấp URL hợp lệ.
- **P1:** Gmail/Outlook/Google Calendar, Slack/Teams và GitHub theo nhu cầu beta được ghi nhận; công khai rõ polling so với push, quyền OAuth và giới hạn từng nguồn.
- **Đang bảo trì / connector nâng cao:** Jira và Bitbucket giữ nguyên các luồng đã triển khai cho người dùng hiện tại (bao gồm changelog assigner, PR review/approve và trạng thái đã xem); không gỡ bỏ hoặc coi là chưa làm. Trong P0/P1 chỉ sửa lỗi, bảo mật và tương thích; tạm dừng mở rộng tính năng để ưu tiên Calendar, Gmail/Outlook, Slack/Teams và GitHub.
- **P2:** Rule AND/OR, thao tác ghi dữ liệu mới và integrations ít người dùng hơn; chỉ ưu tiên khi dữ liệu sử dụng/feedback hỗ trợ.

Không quảng bá “tích hợp” nếu chỉ có khung code hoặc unit test. Mỗi connector cần verified account test, token scope tối thiểu, revoke flow, rate-limit/error handling và trạng thái hiển thị cho người dùng.

### 10.5 Cozy productivity có giới hạn rõ

Break reminder và Pomodoro có thể tăng giá trị khi ít notification, nhưng không nên biến app thành bộ theo dõi sức khỏe/năng suất. Đưa vào như tiện ích opt-in, mặc định ít gây phiền; cho phép snooze/tắt, không theo dõi phím gõ hoặc hành vi người dùng. Ưu tiên một timer cơ bản và nhắc nghỉ mắt hiện có trước; nhắc uống nước/giãn cơ chỉ thêm sau khi kiểm chứng nhu cầu và nội dung phù hợp. Pet “body doubling” là hướng trải nghiệm tùy chọn, không phải tính năng bắt buộc của notification MVP.

### 10.6 Phát hành, cập nhật và đo lường

- **Code signing/notarization:** điều kiện phát hành rộng, với chứng chỉ và quy trình phù hợp nền tảng; nếu chưa sẵn sàng, beta cần ghi rõ cách cài và giới hạn trust. **Quyết định hiện hành:** closed beta chấp nhận cảnh báo SmartScreen (Windows) / Gatekeeper (macOS) kèm hướng dẫn trong `docs/INSTALL.md`; chọn chứng chỉ là điều kiện trước *public* beta. Không khẳng định một loại EV certificate là bắt buộc cho mọi luồng phân phối Windows.
- **Auto-update:** ký xác thực gói update, kiểm tra tương thích, rollout theo kênh, có fallback/rollback và ghi chú phiên bản. Không update asset/runtime nếu manifest/checksum sai.
- **Telemetry:** mặc định tối thiểu và opt-in rõ; chỉ thu số liệu vận hành đã loại nội dung notification (crash code, latency bucket, OS/app version, asset load success); có màn hình xem/xóa/tắt và retention. Không thu raw title/body, danh bạ, chat hay ảnh màn hình.
- **Public beta:** bắt đầu với Mochi (rig procedural hiện có, đã trau chuốt — **GLB production theo §8 không phải điều kiện beta**, là track song song), Mode B mặc định, chức năng nền đáng tin cậy, onboarding gọn và connector đã xác minh. Các pet và tính năng khác chỉ mở rộng sau khi chi phí asset/support được hiểu rõ.
- **Retention:** đo cohort D7/D30, thời gian thiết lập, tỷ lệ tắt Mode B, tỷ lệ dùng inbox/Focus, crash rate và lý do gỡ nếu tự nguyện cung cấp. Không tối ưu theo số thông báo hiển thị hoặc mức độ gián đoạn.
- **Freemium:** chỉ là giả thuyết thương mại cần nghiên cứu. Không khóa quyền riêng tư, accessibility, kiểm soát thông báo cơ bản hoặc xuất/xóa dữ liệu sau paywall. Chưa định giá/gói trả phí cho tới khi thử nghiệm willingness-to-pay và chi phí hỗ trợ.

### 10.7 Thu gọn và giữ lại roadmap

| Hạng mục | Quyết định phát hành rộng | Điều kiện mở rộng |
|---|---|---|
| Mode A thay banner | Chuyển vào tùy chọn nâng cao; Mode B là mặc định | Chỉ giữ trên OS đã có backup/restore, cảnh báo, kiểm thử upgrade/uninstall và phục hồi độc lập. |
| Rule AND/OR + simulator | Hoãn khỏi public beta cơ bản | Feedback cho thấy người dùng thực sự cần; UX nâng cao không làm phức tạp luồng mặc định. |
| 11 loại quan hệ, nhiều Focus mode, 5 theme | Giữ logic dưới lõi; thu gọn cách trình bày ban đầu | Cho phép nhãn/preset tùy chỉnh từ màn hình nâng cao; giữ migration cho thiết lập cũ. |
| Boba/Cloud/Pip, asset marketplace | Hoãn sau Mochi pilot | Pipeline asset, license, validator, moderation, compatibility và hỗ trợ import đã sẵn sàng. Không mở marketplace trước khi threat model và vận hành được duyệt. |
| Mobile app đầy đủ | Hoãn sau Desktop PMF/public beta learning | Có nhu cầu được chứng minh, kiến trúc sync/privacy được duyệt, ngân sách bảo trì và khác biệt iOS/Android được chấp nhận. |
| Cozy productivity | Chỉ làm nhắc nghỉ/timer đơn giản, opt-in | Dữ liệu beta chứng minh giữ chân mà không tăng notification fatigue. |

### 10.8 Giả thuyết cần kiểm chứng

Các nhận định như “người phổ thông sẽ thấy 10 tab quá nhiều”, “Mochi + Mode B là beta tốt nhất”, “GitHub/Calendar có nhu cầu cao hơn Jira/Bitbucket”, mức abandon do cảnh báo cài đặt, lợi thế so với sản phẩm khác và khả năng người dùng trả phí đều là **giả thuyết sản phẩm**, chưa phải dữ kiện từ nghiên cứu người dùng trong repository. Xác minh qua phỏng vấn, usability test, beta analytics có consent và khảo sát; research thị trường cần nguồn hiện hành, link và ngày kiểm tra. Không dùng số phần trăm không có nguồn.

## 11. Tiêu chuẩn ưu tiên: chất lượng cao, dễ dùng

Đây là nguyên tắc chi phối mọi quyết định sản phẩm và triển khai. Khi phải chọn giữa thêm tính năng và hoàn thiện luồng cốt lõi, ưu tiên **độ tin cậy, quyền kiểm soát, dễ hiểu và ít gây gián đoạn**. Không đưa tính năng vào beta chỉ vì đã có code hoặc được ghi trong roadmap.

### 11.1 Thứ tự ưu tiên khi thiết kế và phát triển

1. Không làm mất thông báo, không lộ nội dung bị ẩn, không làm hỏng cấu hình hệ thống.
2. Người dùng hiểu app đang làm gì, vì sao pet phản ứng, và cách tắt/hoàn tác.
3. Luồng mặc định hoạt động tốt mà không bắt buộc tạo rule, kết nối tài khoản hay cấp quyền nhạy cảm.
4. Tính năng nâng cao được mở dần theo ngữ cảnh; có đường quay lại mặc định.
5. Cá tính, animation, âm thanh và tùy biến chỉ được mở rộng khi không làm giảm hiệu năng, khả năng tiếp cận hoặc sự tập trung.

### 11.2 Definition of Done cho thay đổi hướng tới người dùng

Mỗi thay đổi UI/UX hoặc notification feature phải có:

- Một vấn đề người dùng cụ thể, một luồng mặc định ngắn và tiêu chí thành công đo được.
- Trạng thái loading, empty, permission denied, offline/error và fallback; thông báo lỗi phải hướng dẫn cách khắc phục.
- Giải thích quyền ngay trước khi yêu cầu; quyền không cần thiết không chặn dùng chức năng cốt lõi.
- Undo hoặc reset cho thay đổi quy tắc/cấu hình quan trọng; giữ cấu hình cũ qua migration.
- Kiểm tra keyboard, screen reader, text scaling, contrast, reduced motion và vùng click/touch phù hợp.
- Kiểm thử luồng trên build thực tế, màn hình khác DPI/kích cỡ và ít nhất một cấu hình phổ thông mục tiêu; ghi nhận kết quả và giới hạn.

### 11.3 UX quality gate cho Public Beta

Beta chỉ được mở rộng khi người thử mới có thể: cài/mở app; chọn pet và Mode B; hiểu quyền cần cấp; nhận một notification thử; chỉnh privacy; dùng chuột phải để xếp nhóm; tìm lại sự kiện trong Inbox; và tắt/hoàn tác cài đặt — không cần đọc blueprint hay tài liệu kỹ thuật. Theo dõi tỷ lệ hoàn tất từng bước, nơi người dùng mắc kẹt, lỗi ingest, thời gian thiết lập và tỷ lệ tắt tính năng; dùng phỏng vấn/usability session để giải thích số liệu. Không đặt ngưỡng phần trăm tùy ý trước khi có baseline beta.

### 11.4 Nguyên tắc cho thay đổi kiến trúc và AI coding

Trước khi sửa code, xác định module hiện có và mở rộng nó thay vì tạo engine/pipeline thứ hai. Mọi thay đổi phải đối chiếu hợp đồng ở Mục 0, cập nhật trạng thái tài liệu sau khi có bằng chứng, và không được tuyên bố hoàn tất khi chỉ có mockup/unit test. Không hy sinh behavior hiện có để làm UI mới; chuẩn bị migration, fallback và cách rollback. Các quyết định chưa kiểm chứng phải ghi là giả thuyết hoặc planned.

## 12. Thứ tự triển khai hiện hành

*Đối chiếu với code v3.5.15 ngày 21/11/2026. Bảng này là thứ tự làm việc; trạng thái hoàn tất vẫn chỉ cập nhật khi có bằng chứng (§7).*

| Đợt | # | Hạng mục | Phase | Lý do ưu tiên |
|---|---|---|---|---|
| 1 | 1 | Khôi phục registry banner/âm thanh khi gỡ cài đặt Windows (NSIS uninstall hook đọc `windows-banners.json`) + test | 1 | Rủi ro duy nhất có thể làm hỏng cấu hình hệ thống của người dùng (§11.1 #1). |
| 1 | 2 | Mode B Windows: `notifications.bannerMode` + migration, bỏ `dismissNativeBanner` ở Mode B, pet im lặng mặc định, card tránh vùng toast, test A↔B | 2 | Adapter đã hỗ trợ giữ toast gốc (cờ suppress = false) — phần lớn hạ tầng sẵn có; giá trị lớn nhất cho người dùng phổ thông. |
| 1 | 3 | Phase 0 rút gọn: cập nhật `IMPLEMENTATION_STATUS.md`, `KNOWN_LIMITATIONS.md` | 0 | Báo cáo đang ở v3.5.0 / v3.4.2, đánh số trùng. |
| 2 | 4 | Onboarding tối thiểu | 4a | Mode B mặc định cần chỗ để người dùng chọn. |
| 2 | 5 | Chuột phải trên thẻ: Undo + 4 preset | 4a | Menu đã có, chỉ cần hoàn thiện. |
| 2 | 6 | Bảng tình trạng nguồn/quyền | 1 | Người dùng biết khi listener chết hoặc thiếu quyền. |
| 2 | 7 | Script soak test 8 giờ | 4b | Bằng chứng cho tiêu chí chạy nền. |
| 3 | 8 | Ký app Windows + auto-update | 4c | Điều kiện public beta. |
| 3 | 9 | Xác minh Lịch/Outlook/GitHub bằng tài khoản thật; mở link cuộc họp | 4c | §10.4 P0/P1. |
| 3 | 10 | Mode B macOS theo capability | 2 | Sau khi Windows ổn định. |

**Hoãn (không chặn beta):** GLB/asset pipeline §8 (track song song), tái cấu trúc Control Center 5 khu, rule AND/OR + simulator, mobile (Phase 5–6), telemetry, thu gọn theme (chỉ ẩn bớt, không xóa).

## 13. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 04/11/2026 | Gỡ YouTube Pet Video Frame và thao tác nhanh trên thẻ (Hoãn/Ghim/Tắt app/Sửa cảm xúc) theo yêu cầu người dùng. |
| 21/11/2026 | V4.1: Mode A/B dùng key `notifications.bannerMode`, không tái dùng `presentationMode` (đã là kiểu thẻ). |
| 21/11/2026 | Privacy gate được định nghĩa là "trước mọi sink"; phân loại trên máy được đọc nội dung đầy đủ. |
| 21/11/2026 | Migration: người dùng hiện tại giữ hành vi cũ (Mode A nếu đang bật suppress); bản cài mới mặc định Mode B. |
| 21/11/2026 | Phase 4 tách thành 4a (người mới) / 4b (chạy nền) / 4c (phát hành). GLB Mochi không phải điều kiện beta. |
| 21/11/2026 | Closed beta chấp nhận cảnh báo SmartScreen/Gatekeeper kèm hướng dẫn; chứng chỉ ký là điều kiện public beta. |
