# Kế hoạch phát triển mobile — iOS trước, Flutter

*Bản kế hoạch: 1.0 · 21/11/2026 · Chưa phải implementation.*

## 1. Mục tiêu

Xây dựng Cute Pet Companion mobile với trải nghiệm và hành vi cốt lõi tương đương desktop: cùng nhân vật, cảm xúc, privacy modes, mức ưu tiên, contact rules, Focus/Quiet Hours, inbox/digest, sound preferences và các connector được hỗ trợ. Mobile có UI, quyền hệ thống, notification delivery và renderer phù hợp nền tảng.

**Chọn Flutter làm công nghệ mobile mặc định.** Flutter phù hợp vì app cần iOS trước nhưng Android tiếp theo, có một UI/domain codebase cho hai mobile platform và có thể gọi capability native qua plugin/platform channel. Giữ desktop Electron hiện tại; không rewrite desktop sang Flutter.

Flutter không tự động làm app nhẹ hoặc chia sẻ code hiện hữu. Release size, cold start, memory, pet render, pin và nhiệt cần đo trên thiết bị thật. Flutter docs phân biệt debug với release; dùng IPA/release build để đánh giá kích thước người dùng tải, không lấy debug build làm số liệu. [Flutter app-size guidance](https://docs.flutter.dev/perf/app-size), [Flutter iOS release](https://docs.flutter.dev/deployment/ios).

## 2. Giới hạn sản phẩm trên iOS

- iOS app **không đọc notification từ app khác**, không thay banner Slack/Zalo/Gmail và không đặt pet overlay toàn hệ thống.
- Khi app foreground: Flutter app nhận event từ nguồn đã kết nối và hiển thị pet ngay cạnh/đè nhẹ lên thẻ sự kiện trong app.
- Khi app background: APNs gửi notification của **Cute Pet Companion**. Cả banner thu gọn và notification mở rộng cùng nhận diện pet đã chọn: banner thu gọn dùng ảnh pet đính kèm làm thumbnail nếu iOS chọn hiển thị; notification mở rộng dùng Notification Content Extension để trình bày pet lớn tựa mép thẻ. iOS kiểm soát layout banner thu gọn nên không thể đảm bảo thumbnail luôn hiện hoặc đặt pet tùy ý lên banner. [Apple notification customization](https://developer.apple.com/documentation/usernotificationsui/customizing-the-appearance-of-notifications), [Apple notification attachments](https://developer.apple.com/documentation/usernotifications/unnotificationattachment).
- Sự kiện Slack/Calendar/Gmail chỉ tới app mobile nếu connector/backend có quyền và cơ chế gửi hợp lệ; khi đó iOS hiện notification mang thương hiệu Cute Pet Companion, không phải notification gốc của connector.
- Push là tín hiệu đồng bộ, không là database. Khi người dùng mở app, tải event state đã xác thực; xử lý push trùng, trễ hoặc mất.

## 3. Kiến trúc được đề xuất

```text
Desktop Electron ─┐
Mobile Flutter ───┼── versioned event/settings API ── mobile backend + APNs
Connectors ──────┘                                     │
                                                       └─ push tối thiểu → iOS app

Flutter UI / Inbox / Settings
  ├─ shared mobile domain (Dart; contract parity với desktop)
  ├─ native iOS bridge: APNs, secure storage, deep links
  ├─ native Swift Notification Content Extension
  ├─ pet renderer: Three.js WebView spike → renderer được chọn sau benchmark
  └─ static 2D fallback assets
```

### Ranh giới code

- Desktop giữ Electron/Node và các native adapters hiện hữu.
- Flutter sở hữu toàn bộ mobile UI và mobile domain layer. Không nhúng desktop Control Center vào webview để làm app mobile.
- Hai ứng dụng chia sẻ **schema, semantic IDs, API contracts, test fixtures và hành vi**, không cần chia sẻ mọi dòng code. Domain logic hiện tại là JavaScript; không mặc định Flutter chạy trực tiếp module Node. Port các rule cần thiết sang Dart và xác minh parity bằng cùng bộ fixture/golden tests.
- iOS-only behavior nằm trong Swift plugin/extension nhỏ, có API rõ sang Flutter. Notification Content Extension là target native riêng, không phải màn Flutter chạy trong notification.
- Mobile API dùng auth/session riêng, TLS, token rotation/revoke, rate limiting và audit không chứa raw notification content. Không nhúng Composio/API secrets trong app.

## 4. Đồng bộ chức năng với desktop

| Khả năng | Hành vi chung cần giữ | Khác biệt triển khai iOS |
|---|---|---|
| Chọn pet và trải nghiệm pet | 4 stable pet IDs, 8 emotion IDs, cùng tính cách/semantic mapping | 3D chạy trong app foreground; dùng ảnh tĩnh trong notification extension; có 2D fallback |
| Attention và ưu tiên | Cùng priority, dedupe, grouping, cooldown semantics | Push delivery phụ thuộc APNs; app reconcile state khi mở |
| Privacy | Cùng 4 privacy modes và nguyên tắc policy nghiêm hơn thắng | Lock Screen payload tối thiểu; không đưa raw body lên push mặc định |
| Contact/rules | Nhãn quan hệ, rule cơ bản và thứ tự ưu tiên đồng nhất | Cấu hình nhanh trên mobile; rule AND/OR nâng cao theo roadmap |
| Focus/Quiet Hours | Cùng lựa chọn và kết quả lọc | Tôn trọng iOS Focus; không giả vờ có quyền đổi Focus của hệ thống |
| Inbox/Digest | Cùng event ID, read/archive state, group, retention | Offline cache; sync xung đột theo revision/time policy |
| Audio | Cùng sound identity, mute/channel preferences | Audio chỉ trong app; system push sound theo quyền iOS, không phát pet sound tự do ngoài app |
| Integrations | Cùng connector semantics và trạng thái nguồn | Chỉ nguồn có backend delivery/deep link hợp lệ; UI ghi rõ polling, trễ, lỗi hoặc unsupported |
| Desktop capture/mode B | Chia sẻ lõi event/privacy/attention | Không áp dụng capture/overlay desktop lên iOS; dùng in-app companion + app-owned push |

Mọi feature cần capability matrix: `Supported`, `Partial`, `Unsupported on iOS`, lý do và fallback. “Chung chức năng” là cùng kết quả sản phẩm ở nơi nền tảng cho phép, không phải cùng quyền hệ thống.

## 5. Flutter và hiệu năng

### Vì sao chọn Flutter

- Tạo một giao diện mobile thống nhất cho iOS và Android mà không làm lại UI hai lần.
- Có thể giữ native iOS extension cho notification mở rộng và platform bridge cho APNs/secure storage.
- Flutter có pipeline render riêng và release/AOT build; nhưng package, asset và pet renderer vẫn có thể làm app nặng hoặc tốn pin. Đo release build theo hướng dẫn Flutter trước khi chốt ngân sách. [Flutter: measuring app size](https://docs.flutter.dev/perf/app-size).

### Pet 3D giống desktop

**Mục tiêu:** giữ cùng 3D pet, emotion behavior và animation semantics desktop/mobile khi đạt performance gate.

Hiện desktop dùng Three.js với procedural rig trong `src/renderer/js/pet/`; `assets/pet-manifest.json` hiện đánh dấu các nhân vật `productionReady: false`. Chưa có GLB production hoàn chỉnh. Vì vậy kế hoạch không giả định đã có 3D model đóng gói sẵn.

**Spike kỹ thuật đầu tiên:** Flutter app shell + pet stage riêng trong WebView, đóng gói lại các module Three.js/character renderer hiện tại với bridge tối thiểu cho emotion, focus, touch và lifecycle. Đo trên iPhone thật. Nếu WebView nóng máy, tốn pin, khựng hoặc tăng kích thước quá mức, so sánh với native/Flutter-compatible renderer dùng chung GLB. Không đổi pet identity hoặc emotion IDs theo renderer.

**Ngân sách thử nghiệm** (ngưỡng ban đầu để benchmark, cần xác nhận sau khi chọn iPhone baseline):

- 30 FPS ổn định cho pet 3D trong app là mục tiêu mobile ban đầu; giảm render khi pet không chuyển động.
- Tắt/giảm particle, shadow và post-processing trên mobile; hỗ trợ reduced motion.
- Không tải tất cả model/texture/audio khi cài. Tải asset bundle theo pet được chọn, cache có giới hạn và xóa được.
- App phải mở và dùng Inbox khi WebView/WebGL không khả dụng; chuyển sang 2D fallback mà không mất notification/event.
- Không render 3D liên tục trong background hoặc notification extension. Notification mở rộng dùng ảnh pet tĩnh/vector nhẹ.

### Kích thước tải và độ trễ

- Không đóng gói 4 model/âm thanh chất lượng cao vào binary đầu tiên; chỉ ship UI, Mochi preview/fallback và tải asset pack chọn lọc sau consent.
- Theo dõi release IPA size, install size, cold-start p50/p95, memory peak, frame time, thermal state và pin theo workload.
- Dùng Flutter release build/IPA để đo. Loại package không dùng, tối ưu PNG/texture/audio và trì hoãn tải 3D đến khi pet stage được mở.
- Chưa đặt số MB cam kết trước khi có prototype và asset production; báo cáo actual App Store Connect size sau archive upload.

## 6. UX notification và pet

1. **Trong app:** thẻ thông báo và pet là một component/visual unit; pet có thể tựa đầu, bám mép hoặc đi dọc cạnh trên của thẻ trong một animation ngắn, không che nội dung/action. Tôn trọng reduced motion và dừng animation khi card đóng.
2. **Banner iOS thu gọn:** gửi ảnh chân dung pet đã chọn như notification image attachment (`UNNotificationAttachment`) để iOS có thể dùng làm thumbnail cạnh nội dung ngắn. Ảnh chỉ là nhận diện nhỏ, không phải pet toàn thân đè lên banner; hệ thống quyết định có hiện ảnh và vị trí/kích thước của ảnh. Title/body phải tự đủ nghĩa nếu ảnh bị ẩn hoặc thay đổi cách trình bày. Nếu không có ảnh phù hợp, vẫn nhận diện bằng tên pet và app icon.
3. **Notification mở rộng:** native Notification Content Extension hiển thị cùng pet lớn, tựa/bám mép notification card bằng hình tĩnh hoặc chuyển động ngắn đã benchmark, emotion frame phù hợp và actions do iOS hỗ trợ. Extension phải nhanh, không chờ network, có fallback mặc định và chỉ dùng payload đã sanitize. Ảnh gửi kèm nên là portrait 2D đã tối ưu; 3D chỉ chạy trong app foreground.
4. **Notification Center:** pet có thể xuất hiện bên trong custom expanded view của notification thuộc Cute Pet Companion; notification app khác vẫn riêng.
5. **Privacy:** preview lock-screen có thể dùng generic text/ẩn body. Tap mở app rồi mới tải detail qua API nếu người dùng bật sync.

Concept đã render: [IOS_NOTIFICATION_CONCEPT.html](IOS_NOTIFICATION_CONCEPT.html). Cùng một pet được minh họa ở thumbnail banner thu gọn và bản lớn tựa mép khi mở rộng; thumbnail thực tế phụ thuộc cách iOS trình bày attachment. 2D reference art ở [`../../assets/concepts/mobile-pets/`](../../assets/concepts/mobile-pets/) dùng để kiểm tra màu và fallback, chưa phải spritesheet hoặc production art.

## 7. Backend và dữ liệu cần xây

Current `gateway/server.js` là gateway luồng hiện hữu, chưa được coi là APNs/mobile backend đã sẵn sàng. Cần thiết kế:

- Auth/account/device sessions và endpoint đăng ký, refresh, revoke APNs device tokens.
- Event API idempotent theo `eventId`; secure fetch detail khi mở; expiry và dedupe.
- APNs sender với sandbox/production environments, retry/rate limit, invalid-token cleanup và delivery telemetry không chứa nội dung.
- Connector delivery: webhook/polling server side theo connector; token scopes tối thiểu; revoke; failure/lag status.
- Settings sync với revision/version, conflict policy, selective fields, opt-out và delete account/data.
- Push payload chỉ mang ID, category, privacy-safe summary, deep-link token ngắn hạn và expiration; không gửi secret hoặc raw private body mặc định.
- Chuẩn bị portrait 2D theo `petId` và emotion, tối ưu nhẹ để đính kèm notification. Với push từ xa, Notification Service Extension tải file và gắn `UNNotificationAttachment` trước khi giao notification; dùng cache/bundle an toàn khi có thể, giới hạn timeout/kích thước, và luôn có nội dung fallback nếu ảnh không tải được. Notification Content Extension chỉ render từ attachment/local shared data, không gọi network.
- Offline inbox local store mã hóa theo platform secure storage policy; xác định retention và xóa sạch khi logout.

## 8. Chuẩn bị trước khi code app

### Tài khoản và thiết bị

- Mac có Xcode để build/release iOS; Apple Developer Program/App Store Connect để TestFlight và phát hành.
- Flutter SDK ổn định theo phiên bản dự án, Dart, CocoaPods/Xcode toolchain; chốt versions trong `fvm_config`/CI khi repo mobile được tạo.
- iPhone thật: một máy mục tiêu đời thấp và một iPhone/iOS hiện hành; simulator dùng cho UI, thiết bị thật dùng cho APNs, WebGL, pin/nhiệt.
- Bundle ID, app name, signing team, privacy policy/support URL, APNs key/service credentials, backend environment dev/staging/prod.

### Quyết định sản phẩm

- Chốt các connector đầu tiên cho mobile và ai vận hành token/backend.
- Chốt có account login hay pairing desktop-mobile bằng QR/link code; mặc định pairing chỉ gửi settings/metadata, không tự sync raw notification history.
- Duyệt 4 pet concept, 2D palette, privacy copy, compact/expanded notification copy, sound policy và accessibility.
- Chọn minimum iOS version sau khi kiểm tra Flutter/plugins/notification extension, không đặt trước theo suy đoán.

## 9. Lộ trình thực hiện

| Phase | Kết quả | Gate hoàn tất |
|---|---|---|
| M0 — Product/contract | Versioned feature matrix, event/settings schema, privacy projection, deep-link contract, iOS capability list | Desktop/iOS golden fixtures xác định; connector ownership, sync opt-in và deletion policy rõ |
| M1 — Flutter shell | Flutter iOS app, navigation, onboarding, pet picker, settings skeleton, local inbox storage | App chạy trên iPhone thật; permission denied vẫn dùng được app; VoiceOver/Dynamic Type cơ bản |
| M2 — Pet renderer spike | Three.js renderer trong WebView proof-of-concept, bridge và 2D fallback | Báo cáo release size, cold start, memory, FPS, pin/nhiệt trên thiết bị baseline; chọn renderer |
| M3 — Shared features | Emotion/rules/contacts/focus/privacy/inbox/audio preferences và golden tests | Parity matrix trên desktop/iOS; migration/offline/conflict cases được chứng minh |
| M4 — APNs/backend | Auth/device registration, event API, APNs sender, revoke/delete, connector delivery | Duplicate/lost/stale push reconcile; permission off, logout, token rotate, retry tested |
| M5 — Native notification extensions | `UNNotificationServiceExtension` gắn pet portrait attachment; `UNNotificationContentExtension` hiển thị pet lớn ở trạng thái mở rộng; safe preview, actions/deep-link | Test attachment thành công/thất bại, compact system rendering, extension cold render, no-network content UI, fallback và privacy modes |
| M6 — TestFlight beta | Internal QA, external cohort, support, store metadata | Crash/latency/size/privacy review; beta UX gate and rollback/disable mechanisms |
| M7 — Android | Shared schema/API, Flutter app and Android capability adapters | iOS release unaffected; OEM, battery, notification-access policy individually evaluated |

## 10. Definition of Done cho iOS beta

- Người dùng cài app, chọn một trong 4 pets, nhận event thử, tìm lại trong inbox và đổi privacy mà không cần cấp quyền đọc notification app khác.
- In-app pet và notification card ở sát nhau; expanded app notification hiển thị pet đúng trạng thái; compact banner giữ nội dung dễ hiểu và có cùng pet portrait attachment khi iOS hỗ trợ hiển thị thumbnail, không phụ thuộc thumbnail để truyền đạt thông tin.
- Các chức năng dùng chung khớp desktop trên golden fixtures; unsupported platform capabilities được ghi rõ, không âm thầm bỏ qua.
- App hoạt động offline ở mức inbox/settings đã định nghĩa; push có thể đến muộn/mất nhưng state được reconcile.
- Flutter release size, cold-start, WebView/native 3D performance, memory, pin/nhiệt và fallback được ghi trong báo cáo thiết bị thật.
- User có thể tắt push/sync, logout, thu hồi thiết bị và yêu cầu xóa dữ liệu.

## 11. Tài liệu kỹ thuật tham khảo

- [Flutter: Add to app](https://docs.flutter.dev/add-to-app) — plugin/platform integration và native host.
- [Flutter: iOS release](https://docs.flutter.dev/deployment/ios) — Xcode, archive, signing và App Store Connect.
- [Flutter: app size](https://docs.flutter.dev/perf/app-size) — release-size measurement; debug size không đại diện.
- [Apple: Customizing notification appearance](https://developer.apple.com/documentation/usernotificationsui/customizing-the-appearance-of-notifications) — expanded UI cho notification của chính app.
- [Apple: User Notifications](https://developer.apple.com/documentation/usernotifications) — local/remote notification APIs.
