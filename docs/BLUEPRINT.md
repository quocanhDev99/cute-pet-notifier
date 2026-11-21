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
Mở rộng mobile theo thứ tự **iOS trước, Android sau**. Mục tiêu là dùng chung chức năng sản phẩm và dữ liệu với desktop; giao diện, push và quyền hệ thống dùng adapter riêng theo nền tảng. iOS app có pet tương tác, emotion/rule, Focus, privacy, inbox/digest, contact preferences, âm thanh và connector theo khả năng; iOS không thể đọc notification từ app khác, thay banner của app khác hoặc cho pet nổi trên toàn hệ thống. Android chỉ bắt đầu sau khi iOS MVP và backend vận hành ổn định; Notification Listener nếu có là quyền tùy chọn cần đánh giá riêng.

### iOS MVP (mục tiêu mobile đầu tiên)
1. Onboarding iOS, chọn pet/tính cách, xin quyền notification của chính app đúng lúc có ngữ cảnh, cài đặt riêng tư và giải thích đồng bộ.
2. Home pet tương tác; mục tiêu là render cùng GLB/animation contract desktop sau khi model production được kiểm chứng trên iPhone. Dùng bộ 2D concept làm fallback nhẹ cho máy không đạt ngân sách tài nguyên, trạng thái giảm chuyển động và notification extension.
3. Inbox/Digest dùng chung schema, trạng thái đã xem/lưu trữ, lọc nguồn và search cục bộ.
4. Quy tắc cơ bản: nguồn, từ khóa, ưu tiên, Focus/Quiet Hours; thêm người quen thủ công. Advanced AND/OR và học tự động để sau.
5. Push qua APNs cho sự kiện backend/connector được phép gửi; payload tối thiểu, nội dung nhạy cảm chỉ tải sau khi mở app nếu người dùng bật sync; deep link về app/nguồn khi adapter có URL.
6. Đồng bộ tùy chọn, có chọn trường dữ liệu, mã hóa khi truyền/lưu, quản lý phiên đăng nhập và thu hồi thiết bị.
7. Accessibility: Dynamic Type/font scaling, VoiceOver, reduced motion, dark mode, haptics opt-in, pin/data controls; hỗ trợ iPhone trước, iPad sau khi luồng chính ổn định.

### Sau iOS MVP: Android và khả năng mở rộng
- Android app là nền tảng mobile thứ hai: trước hết pet/inbox/push riêng; Notification Listener opt-in chỉ sau đánh giá chính sách, UX quyền, pin và bảo mật.
- iOS widgets/Live Activities chỉ cho dữ liệu và hoạt động của chính app, theo giới hạn nền tảng; widget không phải pet overlay luôn chạy.
- Android notification shortcuts/widgets và selective sync; conflict resolution theo thời gian + nguồn thiết bị, không đồng bộ secrets/token trong export.
- Pet 3D mobile hoặc AR chỉ sau benchmark pin/nhiệt, kích thước tải xuống và thiết bị hỗ trợ.
- Không làm overlay universal trên iOS; Android floating pet/overlay là thử nghiệm sau MVP, không phải cam kết parity.

### Đồng bộ chức năng desktop/iOS

Định nghĩa **parity ở cấp sản phẩm**: cùng user account, pet IDs, 8 emotion IDs, attention/priority semantics, privacy modes, contact groups, basic rules, Focus/Quiet Hours, inbox/read state, sound preferences và connector events khi nguồn hỗ trợ. Duy trì capability matrix theo feature để UI giải thích rõ tính năng nào dùng được trên từng OS.

- Dùng chung event/settings schema, rule fixtures, emotion test vectors và API contracts. Chia sẻ thư viện domain logic nếu dependency audit chứng minh nó chạy an toàn trên Node và iOS; không buộc chia sẻ UI hoặc renderer.
- Settings và inbox sync có versioning, conflict policy, offline behavior, opt-out, revoke và delete. Notification payload không phải database; raw content chỉ sync theo lựa chọn riêng của người dùng.
- Desktop capture, Windows registry/banner adapter, macOS Accessibility, iOS APNs/notification content extension và Android listener là platform-specific capabilities; không hứa các quyền hệ thống giống nhau.
- Connector chỉ được hiển thị trên mobile nếu có API/backend delivery phù hợp. Trạng thái polling, độ trễ, lỗi và quyền cần ghi rõ; không giả lập event native của app khác.
- Feature parity không có nghĩa mọi màn hình hoặc thao tác giống hệt. Giữ cùng kết quả nghiệp vụ, dùng UX phù hợp iPhone; thiếu capability thì ghi `Unsupported on this platform` và cung cấp fallback.

### Dùng chung pet 3D desktop/iOS

Mục tiêu là **một character identity, cùng hành vi và dùng lại tối đa renderer/asset source**, không bắt buộc cùng render engine. Desktop hiện dùng Three.js với procedural rig; `assets/pet-manifest.json` đánh dấu cả bốn nhân vật `productionReady: false` và chưa có GLB production, nên hiện chưa có model production hoàn chỉnh để đóng gói lên iPhone. Có thể thử chạy các module pet Three.js hiện tại trong WKWebView để giữ hình dáng/animation desktop; đây là feasibility spike, chưa phải quyết định renderer mobile.

1. Hoàn thiện Mochi GLB production trước: rig, morph/clip map theo semantic contract, scale/pivot, texture/material và license.
2. Spike reuse Three.js pet stage hiện tại trong WKWebView trước; so sánh với native renderer/asset conversion cho cùng GLB/animation set. Đo thời gian mở, memory, frame-time, nhiệt và pin trên iPhone đời thấp/mục tiêu; không chốt theo cảm giác trên simulator.
3. Chia sẻ character ID, emotion mapping và logic trạng thái; renderer desktop/iOS có thể khác nhau nhưng phản ứng 8 cảm xúc và tương tác phải tương đương.
4. Dùng LOD, texture nén, giới hạn animation, reduced motion và 2D fallback. Notification banner ngắn/Lock Screen dùng hình tĩnh gọn; 3D pet realtime chạy trong app foreground, không chạy nổi trên toàn iOS.
5. Chỉ mở rộng Boba/Cloud/Pip khi Mochi đạt asset QA trên desktop và iPhone; asset lỗi hoặc máy yếu phải chuyển fallback mà Inbox/notification tiếp tục hoạt động.


### Chuẩn bị bắt buộc trước khi bắt đầu iOS

**Sản phẩm và phạm vi**

- Chốt iOS MVP là companion cho notification do chính app/backend hoặc connector hợp lệ tạo; không đưa “đọc notification từ Zalo/Slack/Gmail khác” hay “pet nổi trên mọi app” vào tiêu chí iOS.
- Chọn use cases đầu tiên: pet + inbox; notification/push từ connector đã xác minh; mở deep link hợp lệ; cài đặt privacy/focus và đồng bộ tùy chọn.
- Chốt các nội dung được phép đưa lên lock screen. Mặc định chỉ gửi source/title tối thiểu hoặc generic alert; nội dung chi tiết được tải trong app sau privacy gate.

**Tài khoản, công cụ và thiết bị**

- Apple Account và Mac có Xcode; tài khoản miễn phí đủ để bắt đầu development/test trên thiết bị cá nhân. Phân phối beta qua TestFlight/App Store cần Apple Developer Program membership, App Store Connect và signing/provisioning phù hợp. Xác minh yêu cầu/cước phí enrollment tại thời điểm đăng ký.
- iPhone thật để kiểm tra quyền notification, lock screen, Focus, offline/background, token rotation, font size, VoiceOver, reduced motion và pin; chuẩn bị tối thiểu một thiết bị đời thấp mục tiêu và một iOS mới nhất. Simulator không thay thế kiểm tra push/background trên thiết bị thật.
- Quyết định cá nhân hay tổ chức đứng tên app, bundle ID, tên hiển thị, website/support URL, privacy policy, icon/screenshots và nhóm TestFlight nội bộ/bên ngoài.

**Kiến trúc và backend**

- Repo hiện tại là Electron/Node desktop; chưa có iOS target, APNs sender hoặc mobile API chuyên dụng. `gateway/server.js` hiện xử lý luồng gateway hiện tại, không được mặc định coi là backend mobile sẵn sàng.
- Chốt spike framework trước đầu tư UI. Khuyến nghị **Flutter cho mobile iOS/Android**, giữ desktop Electron; dùng Swift cho iOS Notification Content Extension và native bridges cần thiết. Đo release size/performance và thử pet Three.js trong WKWebView trước khi khóa renderer.
- Thiết kế backend authenticated API + APNs provider: device registration, token rotation, per-device revoke, environment separation (dev/prod), retry/rate limit, observability không chứa notification content, account deletion và idempotency.
- APNs delivery là best effort, không đảm bảo thời điểm nhận. App phải đồng bộ trạng thái khi mở lại, xử lý push trùng/mất/thứ tự khác, token hết hiệu lực và user tắt quyền.
- Không nhúng Composio/API secrets vào app. Connector credentials giữ ở desktop hoặc backend theo scope tối thiểu; mobile chỉ nhận event được phép. Chốt rõ backend giữ dữ liệu gì, nơi lưu, retention, mã hóa và quy trình xóa tài khoản/dữ liệu.

**Dữ liệu và quyền riêng tư**

- Định nghĩa mobile event schema phiên bản hóa: `eventId`, `source`, `createdAt`, `privacyMode`, `safePreview`, `deepLink`, `expiresAt`; không gửi raw body mặc định. Payload push phải nhỏ và không được dùng như database.
- Cho phép tắt sync; chọn riêng sync settings, metadata và inbox; mô tả rõ dữ liệu nào rời desktop. Xóa/đăng xuất phải revoke device token và phiên backend.
- Viết threat model cho lock-screen leakage, thiết bị mất, log/crash, shared account, token theft, replay và connector compromise; kiểm tra notification privacy ở mọi display mode.
- Quyền notification xin trong ngữ cảnh giải thích giá trị; cho phép tiếp tục dùng pet/inbox khi người dùng từ chối, với trạng thái hướng dẫn bật lại trong Settings.

**Quyết định release**

- Chọn minimum iOS version sau khi khảo sát thiết bị mục tiêu và API cần dùng; không chốt theo phỏng đoán.
- Hoàn thiện app icon, onboarding/privacy copy, support page, privacy policy, App Store metadata, screenshots, age/content declarations và support process trước beta công khai.
- Đặt gate: TestFlight nội bộ → nhóm người dùng nhỏ → sửa crash/permission/privacy UX → beta rộng. Thu telemetry vận hành opt-in/tối thiểu; không gửi nội dung thông báo.

Tham khảo chính thức: [Apple User Notifications](https://developer.apple.com/documentation/usernotifications), [Apple Developer Program membership](https://developer.apple.com/help/account/membership/programs-overview/), [WidgetKit interactivity](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities) và [Apple Human Interface Guidelines — Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities).

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
| 5 — iOS foundation và shared feature MVP | P1 | Bắt đầu sau khi event/privacy contracts ổn định: Flutter app shell iPhone, parity matrix, inbox/offline, domain API, production GLB feasibility và 2D fallback. | Có thể dùng các chức năng lõi không cần quyền đọc notification bên thứ ba; cùng emotion/rule/privacy fixtures với desktop; session revoke, xóa dữ liệu và TestFlight flow được xác định. |
| 6 — iOS APNs, integrations, 3D pet và selective sync | P1 | APNs provider, device tokens, deep links, integrations, sync chọn lọc và cùng asset GLB với desktop nếu đạt mobile performance gate. | Permission denied/offline/logout/delete xử lý đúng; push dedupe; parity matrix được xác minh; frame-time/pin/nhiệt đạt ngân sách thiết bị; fallback không mất chức năng. |
| 7 — Android feasibility and MVP | P2 | Chỉ sau khi iOS MVP ổn định: app Android dùng shared schema/API và pet asset; Notification Listener là nghiên cứu opt-in riêng. | Không ảnh hưởng iOS cadence; quyền nhạy cảm có preview/revoke; benchmark pin, OEM, privacy trước khi bật listener. |

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

> **Spec chi tiết & task:** `docs/character-production/` — bắt đầu từ `00_AUDIT_AND_TASKS.md` (bản đồ module thật, quyết định, task CP-xx). Mục 8 này là nguồn chuẩn khi có mâu thuẫn.

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
- Với mobile, dùng cùng character IDs/emotion semantics và ưu tiên tái sử dụng pet 3D Three.js/GLB; cho phép LOD/mobile pack, clip rút gọn và 2D fallback khi máy yếu hoặc trong notification extension.
- Bộ hình 2D ban đầu tại `assets/concepts/mobile-pets/` là concept art tham khảo, chưa phải sprite sheet/animation production. Cần duyệt likeness, palette và quyền sử dụng trước khi chuyển thành asset phát hành.

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

**Ưu tiên phát hành:** tiếp tục ổn định desktop, đồng thời bắt đầu iOS sau khi event/privacy contract P0 được chốt; iOS là nền tảng mobile đầu tiên và Android theo sau khi iOS MVP ổn định. Không chờ hoàn tất toàn bộ desktop roadmap mới bắt đầu iOS. Giữ chung chức năng nghiệp vụ ở cấp core; UI, notification delivery/capture và system permissions có adapter riêng theo OS.

### 10.2 Onboarding 5 phút và cấu hình theo tầng

Luồng lần đầu chỉ hỏi thông tin thiết yếu:

1. Chọn pet (pilot public beta: Mochi; nhân vật khác vẫn chọn được bằng rig procedural hiện có, được quảng bá dần khi asset production-ready).
2. Chọn mục đích gần nhất: Công việc, Học tập hoặc Cá nhân; cho phép bỏ qua.
3. Chọn cách hiển thị, mặc định **Giữ thông báo hệ thống + Pet Companion (Mode B)**.
4. Chọn mức riêng tư đơn giản và thời điểm yên tĩnh; giải thích rõ quyền trước khi mở system settings.
5. Vào sử dụng ngay; kết nối dịch vụ và quy tắc nâng cao là bước tùy chọn sau onboarding.

Preset chỉ khởi tạo cấu hình có thể xem/sửa, không tự xin quyền, kết nối tài khoản hoặc bật đọc notification. Cần có “Bỏ qua”, “Đặt lại mặc định” và đường dẫn giải thích vì sao một thông báo bị lọc.

### 10.3 Chuẩn Hóa Control Center 6 Tabs & Chế Độ Đồng Hành Hệ Thống (Concept v2.0)

> **Bản đặc tả thiết kế 100% Concept Render:** Xem tại [MASTER_UIUX_SPEC_V2.md](design/uiux-v2/MASTER_UIUX_SPEC_V2.md) và [NOTIFICATION_MODE_REDESIGN_SPEC.md](product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md).

Cấu trúc điều hướng thanh Sidebar được chuẩn hóa thành **6 tabs duy nhất** theo phong cách Pastel Glassmorphism:
- 🏠 **Trang chủ:** Lời chào, thẻ ngày giờ `12:29 ☀️`, 3D Pet Showcase với bục đệm tròn + `< Boba >`, Lưới 3×2 Chế độ đồng hành (Focus, Pomodoro 25-5, Break, Study, Work, Sleep), Card Thông báo (2 tùy chọn nguồn), Card Hoạt động hôm nay (8 thông báo, 5 tác vụ, 2h 30m).
- 🐱 **Thú cưng:** Chọn thú cưng (Mochi, Boba, Cloud, Pip), sân khấu 3D live, panel tùy chỉnh (Thái độ, Kích thước 100%, Sinh động 1.0x, Âm thanh).
- 🔔 **Thông báo (Khớp 100% Hình 1):** Gồm 5 khối hoàn chỉnh: Dual OS Live Preview (Windows 11 Teams & macOS GitHub); 2 Card chọn chế độ có nút bắn thử riêng (`[ ▶ Thử thông báo hệ thống ]` & `[ ▶ Thử thẻ Cute Pet ]`); 4 kiểu bám (Ôm bảng, Ló đầu, Nghỉ ngơi, Đưa thư); Chuỗi hoạt ảnh 6 bước; 4 Biến thể thực tế (Email, Tin nhắn, Lịch, Hệ thống); Bộ tùy chỉnh nhanh.
- 📥 **Hộp thư:** Badge số `2`, 4 tab filter (Tất cả, Tin nhắn, Công việc, Quan trọng), danh sách notification rows, nút `✓ Đánh dấu đã đọc tất cả`.
- 🔌 **Kết nối:** Danh sách app (GitHub, Gmail, Teams, Notion) kèm công tắc bật/tắt trực tiếp, nút `+ Thêm ứng dụng khác`.
- ⚙️ **Cài đặt:** 4 nút tròn chọn theme (Oải hương, Xanh biển, Bạc hà, Đêm), Ngôn ngữ Tiếng Việt, Khởi động cùng máy, Giảm chuyển động, Slider âm lượng 70%.
*(Tab nâng cao "Theo dõi" chỉ xuất hiện khi người dùng kích hoạt Chế độ Nâng cao trong Cài đặt).*

### 10.4 Ưu tiên tích hợp theo nhu cầu, không theo độ phức tạp kỹ thuật

- **P0:** Notification hệ thống + inbox ổn định, Mode B, thông báo lịch họp và mở link cuộc họp khi nguồn cung cấp URL hợp lệ.
- **P1:** Gmail/Outlook/Google Calendar, Slack/Teams và GitHub theo nhu cầu beta được ghi nhận; công khai rõ polling so với push, quyền OAuth và giới hạn từng nguồn.
- **Đang bảo trì / connector nâng cao:** Jira và Bitbucket giữ nguyên các luồng đã triển khai cho người dùng hiện tại (bao gồm changelog assigner, PR review/approve và trạng thái đã xem); không gỡ bỏ hoặc coi là chưa làm. Trong P0/P1 chỉ sửa lỗi, bảo mật và tương thích; tạm dừng mở rộng tính năng để ưu tiên Calendar, Gmail/Outlook, Slack/Teams và GitHub.
- **P2:** Rule AND/OR, thao tác ghi dữ liệu mới và integrations ít người dùng hơn; chỉ ưu tiên khi dữ liệu sử dụng/feedback hỗ trợ.

Không quảng bá “tích hợp” nếu chỉ có khung code hoặc unit test. Mỗi connector cần verified account test, token scope tối thiểu, revoke flow, rate-limit/error handling và trạng thái hiển thị cho người dùng.

### 10.5 Cozy productivity có giới hạn rõ

Break reminder và Pomodoro có thể tăng giá trị khi ít notification, nhưng không nên biến app thành bộ theo dõi sức khỏe/năng suất. Đưa vào như tiện ích opt-in, mặc định ít gây phiền; cho phép snooze/tắt, không theo dõi phím gõ hoặc hành vi người dùng. Ưu tiên một timer cơ bản và nhắc nghỉ mắt hiện có trước; nhắc uống nước/giãn cơ chỉ thêm sau khi kiểm chứng nhu cầu và nội dung phù hợp. Pet “body doubling” là hướng trải nghiệm tùy chọn, không phải tính năng bắt buộc của notification MVP.

### 10.6 Phát hành, cập nhật và đo lường

- **Code signing/notarization:** điều kiện phát hành rộng, với chứng chỉ và quy trình phù hợp nền tảng; nếu chưa sẵn sàng, beta cần ghi rõ cách cài và giới hạn trust. **Quyết định hiện hành:** closed beta chấp nhận cảnh báo SmartScreen (Windows) / Gatekeeper (macOS) kèm hướng dẫn trong `docs/guides/release/INSTALL.md`; chọn chứng chỉ là điều kiện trước *public* beta. Không khẳng định một loại EV certificate là bắt buộc cho mọi luồng phân phối Windows.
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
| iOS app | Ưu tiên phát triển song song sau khi P0 event/privacy contract ổn định | Chốt parity matrix, backend/APNs, sync/privacy và renderer/pet 3D feasibility; TestFlight beta đạt quality gate. |
| Android app | Hoãn tới khi iOS MVP ổn định | Dùng lại shared schema/API/assets; đánh giá riêng notification listener, policy, OEM, pin và maintenance. |
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

**Track nhân vật (song song, không chặn beta):** theo `docs/character-production/00_AUDIT_AND_TASKS.md` — làm trước CP-05 AudioController và CP-06 micro-behaviour (không cần asset); GLB/âm thanh Mochi (CP-20…22) chờ họa sĩ và nguồn âm thanh có license.

**Hoãn (không chặn desktop beta):** Android (Phase 7), mở rộng asset/GLB ngoài pilot Mochi §8, tái cấu trúc Control Center 5 khu, rule AND/OR + simulator, telemetry mở rộng và thu gọn theme (chỉ ẩn bớt, không xóa). iOS Phase 5–6 bắt đầu sau khi P0 event/privacy contract ổn định và chạy song song với desktop P1; iOS beta không chặn desktop beta.

## 13. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 04/11/2026 | Gỡ YouTube Pet Video Frame và thao tác nhanh trên thẻ (Hoãn/Ghim/Tắt app/Sửa cảm xúc) theo yêu cầu người dùng. |
| 21/11/2026 | V4.1: Mode A/B dùng key `notifications.bannerMode`, không tái dùng `presentationMode` (đã là kiểu thẻ). |
| 21/11/2026 | Privacy gate được định nghĩa là "trước mọi sink"; phân loại trên máy được đọc nội dung đầy đủ. |
| 21/11/2026 | Migration: người dùng hiện tại giữ hành vi cũ (Mode A nếu đang bật suppress); bản cài mới mặc định Mode B. |
| 21/11/2026 | Phase 4 tách thành 4a (người mới) / 4b (chạy nền) / 4c (phát hành). GLB Mochi không phải điều kiện beta. |
| 21/11/2026 | Closed beta chấp nhận cảnh báo SmartScreen/Gatekeeper kèm hướng dẫn; chứng chỉ ký là điều kiện public beta. |
| 21/11/2026 | UI/UX JSON v2 (v3.8.0): theme Oải hương + kính mờ là mặc định cho bản cài mới; route **Chế độ** riêng; thẻ thông báo gọn 340 px mặc định (thẻ đầy đủ vẫn chọn được); kiểu gắn Bám góc mặc định cho bản cài mới. Chưa làm: lưu trữ Hộp thư, vuốt để đóng thẻ, thời lượng tự tắt cho Focus/Work/Sleep. Chi tiết: `docs/design/uiux-v2/IMPLEMENTATION_AUDIT.md`. |
| 21/11/2026 | Notification redesign (Concept v2, v3.7.0): chế độ 1 trình bày "chỉ có bé" cho tin đã có banner hệ thống (không thẻ trùng); Pomodoro là timer cơ bản opt-in theo §10.5, Học tập = preset 50/10; thêm `petOpacity`, `petClickThrough`, nút "✓ Đã đọc". Chi tiết: `docs/product/notifications/NOTIFICATION_MODE_REDESIGN_SPEC.md`. |
| 21/11/2026 | Character production: giữ bản sắc hiện tại của 4 nhân vật (`species.js`); phong cách stylized-realism thay "art toy" của BLENDER_GUIDE; QA ở chiều cao 72/126/210/400 px; file nguồn ở `art/{id}/` (không đóng gói); giọng nói hệ thống thành opt-in cho bản cài mới. |

