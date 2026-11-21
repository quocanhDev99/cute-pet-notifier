# HƯỚNG DẪN CHI TIẾT — SMOOTH 3D ANIMATION & REAL-TIME NOTIFICATION DELIVERY

**Project:** Cute Pet Companion  
**Version:** 1.0.0  
**Applies to:** macOS, Windows 10/11, Three.js runtime, Composio and direct provider integrations  
**Related documents:** `BLUEPRINT_v2.1.md`, `BLENDER_GUIDE.md`, `README.md`

---

# PHẦN A — ANIMATION MƯỢT VÀ ỔN ĐỊNH

## A1. Mục tiêu

Animation phải tạo cảm giác nhân vật thực sự sống trên desktop, không chỉ chuyển giữa các pose tĩnh. Khi người dùng nhận notification, vuốt ve, chuyển Focus Mode hoặc đổi emotion, chuyển động phải liền mạch và không gây giật/khựng.

Các yêu cầu bắt buộc:

- Không đổi pose đột ngột (pose pop).
- Không có hai clip cùng điều khiển một bộ phận theo cách xung đột.
- Không rung/jitter do cập nhật delta time sai.
- Không lặp lại animation một cách máy móc khi không cần.
- Không để notification animation tiếp tục chạy sau khi card đã bị dismiss.
- Không để animation lỗi làm dừng render loop.
- Animation phải tôn trọng Reduced Motion và Focus/Hidden Mode.

## A2. Nguyên tắc rigging — không áp một bộ xương cứng cho mọi nhân vật

Mỗi nhân vật có thể có rig và anatomy khác nhau. Không bắt buộc Corgi, mèo, thỏ và chim cánh cụt phải có cùng tên bone hoặc cùng hierarchy.

Thay vào đó:

1. Artist tạo rig phù hợp với mesh và chuyển động của nhân vật.
2. Runtime sử dụng semantic mapping cho các nhóm chuyển động, ví dụ `root`, `body`, `head`, `front_limbs`, `hind_limbs`, `ears`, `tail`, `face` khi những thành phần này tồn tại.
3. Mapping cụ thể được cấu hình theo từng asset/character.
4. Nếu một bộ phận không tồn tại (ví dụ chim cánh cụt không có đuôi chuyển động rõ), controller bỏ qua hoặc dùng chuyển động thay thế phù hợp.
5. Không phụ thuộc vào một danh sách bone name cứng trong core engine.

## A3. Chuẩn bị animation trong Blender

### Bước 1 — Kiểm tra model trước khi animate

- Kiểm tra scale/orientation/origin theo `BLENDER_GUIDE.md`.
- Kiểm tra mesh không có phần rời hoặc normal bất thường.
- Kiểm tra phụ kiện không xuyên vào thân khi biến dạng.
- Kiểm tra weight painting ở vai, cổ, chân, tai và đuôi nếu rig sử dụng các vùng này.
- Kiểm tra facial controls có thể thay đổi mà không làm vỡ topology.

### Bước 2 — Tạo animation cơ bản

Tạo tối thiểu các clip thực sự cần cho trải nghiệm pilot:

| Clip | Mục đích | Loop |
|---|---|---|
| `idle` | Trạng thái nền, thở nhẹ, chuyển động nhỏ | Có |
| `happy` | Phản ứng vui vẻ | Không hoặc loop ngắn có chủ đích |
| `excited` | Phản ứng hào hứng | Không |
| `love` | Phản ứng tích cực | Không hoặc loop ngắn |
| `surprised` | Phản ứng bất ngờ | Không |
| `angry` | Phản ứng cáu kỉnh | Không |
| `sad` | Phản ứng buồn | Không hoặc pose có kiểm soát |
| `thinking` | Đang xử lý | Có thể loop nhẹ |
| `sleeping` | Ngủ và thở nhẹ | Có |
| `hold_card` | Giữ notification card | Có thể giữ pose |
| `pet` | Phản ứng khi được vuốt ve | Không |
| `reject` / `dodge` | Từ chối hoặc né tương tác | Không |
| `feed` | Nhận treat | Không |
| `kick` | Đá card khi người dùng chủ động chọn reject | Không |
| `transition` | Chuyển tư thế hoặc vào/ra presentation mode | Không |

Đây là tên clip khuyến nghị/alias cho runtime, không phải yêu cầu phải nhồi tất cả clip vào một file hoặc tạo đủ mọi clip trước MVP. Tên thật trong GLB có thể được ánh xạ trong cấu hình nhân vật.

### Bước 3 — Làm chuyển động liền mạch

- Dùng keyframe có spacing hợp lý; tránh thay đổi vị trí quá lớn giữa hai frame liên tiếp.
- Với chuyển động chu kỳ như idle/breathing, đảm bảo frame cuối và đầu nối được tự nhiên.
- Kiểm tra interpolation của keyframes; tránh linear motion cho chuyển động cần easing nếu tạo cảm giác máy móc.
- Kiểm tra đường đi của root, đầu, chân, tai và đuôi.
- Giảm foot sliding bằng cách giữ chân trụ/pose tiếp xúc nhất quán.
- Tách motion chính và secondary motion (tai, đuôi, phụ kiện) để không làm toàn thân rung.
- Không thêm camera movement bắt buộc vào clip nhân vật nếu runtime cần giữ vị trí overlay ổn định.

### Bước 4 — Facial expression và morph targets

- Dùng shape keys/morph targets cho mắt, miệng, má hoặc biểu cảm phù hợp với topology.
- Tránh phụ thuộc hoàn toàn vào 2D sprite nếu mục tiêu là 3D live animation.
- Chuyển biểu cảm bằng weight blend, không bật/tắt đột ngột.
- Đặt giới hạn weight hợp lý để tránh biến dạng mặt.
- Kiểm tra nhiều biểu cảm kết hợp để tránh mắt/miệng xuyên hoặc biến dạng bất thường.

### Bước 5 — Kiểm tra clip độc lập và tổ hợp

Xem từng clip ở tốc độ 0.5x, 1x và 1.25x.

Sau đó kiểm tra các transition:

- idle → happy → idle
- idle → excited → hold_card → idle
- idle → surprised → idle
- idle → thinking → happy → idle
- idle → sleeping → idle
- idle → pet → idle
- hold_card → reject → idle
- bất kỳ trạng thái tạm thời nào → Focus/Hidden Mode

Không phải mọi clip cần transition trực tiếp với mọi clip; controller cần chọn đường chuyển trạng thái phù hợp.

## A4. Animation Controller trong Three.js

### Bước 1 — Một nguồn điều khiển animation

Tạo một `AnimationController` duy nhất cho mỗi character instance.

Controller chịu trách nhiệm:

- Load và kiểm tra clip.
- Quản lý AnimationMixer.
- Theo dõi state hiện tại và state đích.
- Cross-fade action.
- Quản lý facial morph targets.
- Quản lý interruption/priority.
- Dừng action không còn sử dụng.
- Xử lý fallback.

Không để nhiều component tự ý gọi `play()` trên cùng một mixer mà không thông qua controller.

### Bước 2 — Tách các lớp animation

Thiết kế các lớp logic sau khi phù hợp với model:

1. **Base layer:** idle hoặc sleeping.
2. **Body/action layer:** emotion và interaction clips.
3. **Face layer:** morph targets/shape keys.
4. **Secondary motion:** tai, đuôi, phụ kiện, breathing.
5. **Presentation effects:** particles, card movement, sound.

Nếu các clip điều khiển cùng bones, cần quản lý weight/mask/priority để tránh xung đột. Không cộng chồng mọi action một cách mù quáng.

### Bước 3 — Cross-fade và blend

- Khi đổi action tương thích, dùng cross-fade hoặc fade out/fade in.
- Giá trị khởi đầu đề xuất cho transition ngắn là khoảng 0.18–0.35 giây; điều chỉnh theo tốc độ clip và character.
- Không dùng cùng một duration cho mọi tình huống: waking, sleeping, startled, petting và card delivery có nhịp khác nhau.
- Dùng transition profile riêng nếu cần.
- Tránh cross-fade hai action có root motion hoặc pose khác biệt quá lớn mà không có transition clip.

Pseudo-flow:

```text
requestState(nextState)
  -> validate target clip / morph controls
  -> check presence mode and interruption priority
  -> select transition profile
  -> fade out previous action if compatible
  -> fade in next action
  -> blend facial controls
  -> stop temporary action when completed
  -> return to idle or requested base state
```

### Bước 4 — Delta time và sleep/resume

- Update mixer theo `deltaTime`, không giả định frame rate cố định.
- Khi app bị suspend hoặc máy resume, clamp hoặc reset delta time lớn để tránh animation nhảy vọt.
- Không dùng `setInterval` để điều khiển frame animation.
- Dùng render loop hiện có hoặc event-driven invalidation nếu kiến trúc hỗ trợ.
- Khi Hidden Mode, giảm hoặc dừng update/render nếu không có nhiệm vụ cần xử lý.

### Bước 5 — Missing clip fallback

Nếu emotion clip thiếu:

1. Thử facial morph target tương ứng.
2. Thử body pose/procedural animation nhẹ.
3. Nếu không có, giữ idle và cập nhật UI về fallback status.
4. Không throw lỗi làm dừng toàn bộ renderer.
5. Ghi log kỹ thuật không chứa dữ liệu notification nhạy cảm.

## A5. Quy tắc state và interruption

Phân biệt rõ:

- `idle`: base animation.
- `sleeping`: emotion/presence reaction.
- `hidden`: presentation visibility.
- `focused`: operating mode.
- `emotion`: trạng thái biểu cảm tạm thời.
- `interaction`: petting/feeding/reject.

Gợi ý ưu tiên:

1. User-initiated interaction.
2. Explicit user mode change (Hidden/Reduced Motion/Focus policy).
3. Critical notification reaction nếu được user cho phép.
4. Important notification reaction.
5. Normal emotion reaction.
6. Idle animation.

Quy tắc cụ thể phải do product policy quyết định; không tự ý cho notification thường ngắt một interaction hoặc Focus Mode.

Khi user bật Hidden Mode, stop/hide presentation ngay theo policy và đưa event vào Inbox/queue nếu cần.

## A6. Tiêu chí nghiệm thu animation

| Kiểm thử | Điều kiện đạt |
|---|---|
| Idle loop | Không thấy điểm nối hoặc nhịp giật rõ rệt |
| Emotion transition | Không pose pop; cross-fade hợp lý |
| Facial morph | Không vỡ mặt, không nhảy weight |
| Interaction | Animation đúng thời điểm và kết thúc về state phù hợp |
| Clip interruption | Không có hai action xung đột rõ rệt |
| Suspend/resume | Không nhảy pose sau khi máy/app resume |
| Reduced Motion | Chuyển động giảm hoặc tắt theo cài đặt |
| Missing clip | Fallback hoạt động, renderer không crash |
| Runtime performance | Target trung bình ~60 FPS trên benchmark machine đã khai báo; ghi FPS/frame time thực tế |

Ghi lại:

- Máy test, OS, GPU và độ phân giải.
- FPS average và 1% low nếu công cụ hỗ trợ.
- Frame time p50/p95.
- GLB size và loading time.
- Số draw calls/triangles nếu có thể đo.
- Tình trạng CPU/RAM khi idle và active.

---

# PHẦN B — REAL-TIME NOTIFICATION THEO TỪNG ỨNG DỤNG

## B1. Định nghĩa delivery mode

Không dùng từ “realtime” chung cho mọi connector.

| Mode | Ý nghĩa | UI label |
|---|---|---|
| `realtime_push` | Provider đẩy event qua webhook/event stream khi sự kiện xảy ra | Realtime |
| `near_realtime_poll` | Dịch vụ kiểm tra định kỳ, có độ trễ theo polling interval | Near real-time |
| `scheduled_sync` | Đồng bộ theo lịch | Scheduled sync |
| `native_os` | Nhận event qua native OS interface được phép | System event |
| `manual` | Chỉ cập nhật khi người dùng refresh | Manual refresh |

Chỉ đánh dấu `realtime_push` sau khi xác minh trigger cụ thể và test event thật.

## B2. Source-specific integration strategy

| Ứng dụng | Chiến lược ưu tiên | Điều cần lưu ý |
|---|---|---|
| Slack | Composio trigger realtime nếu trigger cụ thể xác nhận hỗ trợ; hoặc Slack Events API | Cần đăng ký event type, scopes và webhook receiver |
| Microsoft Outlook | Composio realtime trigger nếu có; hoặc Microsoft Graph change notifications | Theo dõi subscription expiration/renewal và resource permissions |
| Microsoft Teams | Kiểm tra chính xác Graph resource/change notification hoặc Composio trigger hiện có | Không suy luận rằng Outlook trigger cũng bao phủ Teams chat |
| Gmail | Gmail API push notifications qua Cloud Pub/Sub khi cần push; Composio Managed OAuth polling chỉ được xem là polling | Push thông báo mailbox change; phải gọi Gmail History API để lấy thay đổi cụ thể |
| Google Calendar | Calendar API push notification channels; Composio chỉ dùng realtime khi trigger cụ thể xác nhận | Webhook thường báo resource changed; cần fetch dữ liệu và gia hạn channel |
| Notion | Composio realtime trigger hoặc Notion Webhooks cho event được hỗ trợ | Kiểm tra webhook event, workspace permissions và payload |
| Discord | Discord Gateway WebSocket cho bot/app được cấp quyền và intents phù hợp | Không phải API để đọc notification cá nhân tùy ý của mọi user |
| Zalo | Chỉ triển khai khi official API/toolkit cho đúng event và quyền được xác minh | Nếu không hỗ trợ, hiển thị Unsupported thay vì giả lập |
| macOS | Chỉ dùng notification/system interface được Apple cho phép | Không mặc định có API công khai để đọc toàn bộ notification của mọi app khác |
| Windows | Chỉ dùng notification listener/interface được Windows hỗ trợ và user cấp quyền | Khả năng đọc/điều khiển có giới hạn theo API và permission |

### Lưu ý về Composio hiện tại

Theo tài liệu Composio được kiểm tra ngày 03/11/2026:

- Tài liệu Triggers mô tả Slack, Notion và Outlook là ví dụ realtime.
- Gmail và Google Calendar được liệt kê trong nhóm polling trong hướng dẫn trigger.
- Composio changelog đã nêu giới hạn polling tối thiểu 15 phút cho một số Gmail triggers sử dụng Composio-managed OAuth từ ngày 15/04/2026; custom OAuth có thể có lựa chọn interval khác theo cấu hình/provider.

Các thông tin trên phải được kiểm tra lại tại thời điểm triển khai vì toolkit, trigger và plan có thể thay đổi. Không áp dụng một mức độ trễ cố định cho mọi tài khoản hoặc trigger.

## B3. Gmail — push flow đề xuất

```text
Gmail Mailbox Change
      |
      v
Gmail API watch
      |
      v
Google Cloud Pub/Sub
      |
      v
HTTPS Push Subscription
      |
      v
Integration Gateway
      |
      v
Decode Pub/Sub message
      |
      v
Gmail History API (startHistoryId)
      |
      v
Normalize changed message metadata
      |
      v
Deduplicate + durable queue
      |
      v
Desktop event stream
      |
      v
Attention Management -> Pet reaction
```

Implementation notes:

1. Tạo Google Cloud project và cấu hình Cloud Pub/Sub theo tài liệu Google.
2. Cấu hình topic và quyền publish cho Gmail push service account theo tài liệu hiện hành.
3. Gọi Gmail `users.watch` với label filter phù hợp.
4. Lưu `historyId` và thời điểm expiration.
5. Nhận Pub/Sub push message tại public HTTPS endpoint.
6. Acknowledge notification sau khi event đã được ghi bền vững/đưa vào queue.
7. Dùng Gmail History API để lấy thay đổi từ `startHistoryId` đến history hiện tại.
8. Chỉ lấy metadata hoặc preview tối thiểu theo scope và user setting.
9. Gia hạn watch trước khi hết hạn; tài liệu Google yêu cầu gọi watch ít nhất mỗi 7 ngày và khuyến nghị hàng ngày.
10. Có periodic reconciliation để phục hồi khi push event bị trễ hoặc mất.

Google nêu rằng push thường được phân phối trong vài giây nhưng vẫn có trường hợp trễ hoặc thất lạc; vì vậy cần reconciliation thay vì coi push là bảo đảm tuyệt đối.

Không dùng Composio Gmail polling và quảng cáo đó là realtime.

## B4. Google Calendar — push flow đề xuất

```text
Calendar Resource Change
      |
      v
Calendar API watch channel
      |
      v
HTTPS webhook notification
      |
      v
Validate channel/resource headers
      |
      v
Fetch changed resource / incremental sync
      |
      v
Normalize calendar event
      |
      v
Deduplicate + queue
      |
      v
Desktop event stream
```

Implementation notes:

1. Tạo watch channel cho resource được hỗ trợ.
2. Dùng HTTPS callback endpoint.
3. Validate channel ID, resource ID và token nếu cấu hình.
4. Xử lý `sync` notification riêng.
5. Notification thường là tín hiệu resource thay đổi, không phải toàn bộ event detail.
6. Fetch resource hoặc thực hiện incremental sync để lấy nội dung cần thiết.
7. Theo dõi expiration và tạo channel thay thế trước khi hết hạn.
8. Xử lý overlap giữa channel cũ và mới bằng idempotency/deduplication.

## B5. Microsoft Outlook — change notifications

Có thể dùng:

- Composio trigger realtime nếu đúng trigger hiện tại hỗ trợ.
- Microsoft Graph change notifications cho mailbox resources được hỗ trợ.

Quy trình tổng quát:

1. Xác định resource cần subscribe (ví dụ message hoặc event resource).
2. Yêu cầu permission tối thiểu.
3. Tạo Graph subscription với public HTTPS notification URL.
4. Xử lý validation handshake theo Microsoft Graph documentation.
5. Xác thực subscription/resource identity.
6. Nhận change notification.
7. Fetch resource detail qua Graph API khi payload chỉ là change signal.
8. Theo dõi expiration và renew subscription.
9. Xử lý lifecycle events, retry và missed notifications.

Không tuyên bố Microsoft Teams chat event được hỗ trợ chỉ vì Outlook Mail change notification hoạt động.

## B6. Slack — event delivery

Có thể dùng Composio realtime trigger hoặc Slack Events API.

Quy trình:

1. Xác định event type cần thiết.
2. Tạo Slack app và cấp scopes tối thiểu.
3. Đăng ký event subscription.
4. Cấu hình public HTTPS Request URL.
5. Xử lý URL verification và request signature theo tài liệu Slack hiện hành.
6. Trả acknowledgement nhanh.
7. Đưa event vào queue để xử lý tiếp.
8. Chuẩn hóa channel, sender, timestamp và message reference theo quyền được cấp.
9. Áp dụng deduplication và notification policy.

Không lấy toàn bộ channel history nếu chỉ cần event mới.

## B7. Notion, Discord, Zalo và nguồn khác

- Notion: dùng official webhook hoặc Composio trigger khi event cần thiết được hỗ trợ. Kiểm tra workspace authorization và event schema.
- Discord: nếu dùng Gateway, phải triển khai như Discord bot/application theo permissions và intents; không giả định có quyền nhận tất cả thông báo tài khoản cá nhân.
- Zalo: kiểm tra official API/toolkit và quyền thực tế trước khi cam kết. Nếu chỉ có action mà không có notification trigger, không đánh dấu realtime notifications.
- macOS/Windows: chỉ triển khai native notification interfaces được chính nền tảng hỗ trợ và cấp quyền. Không screen-scrape hay đọc cơ sở dữ liệu nội bộ trái phép.

## B8. Composio webhook and event handling

### Trigger setup

1. Discover toolkit hiện tại.
2. Retrieve trigger types và config schema.
3. Kiểm tra delivery mode của đúng trigger.
4. Kết nối tài khoản qua managed auth/Connect Link nếu phù hợp.
5. Tạo trigger instance cho connected account.
6. Đăng ký project webhook URL.
7. Lưu trigger ID và metadata.
8. Test bằng sự kiện mới từ ứng dụng nguồn.

Tạo trigger instance chỉ đăng ký subscription; phải cấu hình webhook destination để nhận event.

### Webhook security

- Dùng SDK `parse()`/`verifyWebhook()` hiện hành nếu phù hợp.
- Nếu verify thủ công, đọc đúng header, payload version và signing specification hiện tại.
- Giữ raw request body cho signature verification.
- Kiểm tra timestamp/replay tolerance.
- Dùng `webhook-id` hoặc stable event identifier làm idempotency key.
- Không log payload nhạy cảm.

Composio trigger delivery có thể là at-least-once. Webhook handler phải idempotent.

### Local development vs production

- `subscribe()`/WebSocket hoặc tunnel chỉ được dùng cho prototype/test theo hướng dẫn hiện hành.
- Production phải dùng webhook receiver an toàn hoặc đường delivery được hỗ trợ chính thức.
- `127.0.0.1:3721` không phải public webhook endpoint.
- Không mở cổng router của người dùng làm giải pháp mặc định.

## B9. Event contract trong ứng dụng

Dùng normalized event metadata tương tự:

```typescript
interface NormalizedNotification {
  id: string;
  sourceApplication: string;
  provider: string;
  connectedAccountId?: string;
  sourceEventId?: string;
  title?: string;
  bodyPreview?: string;
  category?: string;
  priority: 'critical' | 'important' | 'normal' | 'low';
  deliveryMode: 'realtime_push' | 'near_realtime_poll' | 'scheduled_sync' | 'native_os' | 'manual';
  sourceCreatedAt?: string;
  providerReceivedAt?: string;
  gatewayReceivedAt?: string;
  desktopReceivedAt?: string;
  renderedAt?: string;
  latencyMs?: number;
  deduplicationKey: string;
  sourceUrl?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, unknown>;
}
```

Không bắt buộc mọi provider phải gửi đủ mọi field. Dùng optional fields và validate schema.

Không gửi toàn bộ body nếu preview hoặc metadata là đủ.

## B10. Event reliability

Implement:

- Durable event queue.
- Idempotency.
- Deduplication.
- Retry with backoff.
- Dead-letter handling.
- Event ordering where provider supports sequence/cursor.
- Cursor/history reconciliation.
- Subscription renewal.
- Connection health check.
- Offline buffering.
- Reconnect and resume.

Không làm mất notification chỉ vì desktop app đang Hidden Mode hoặc tạm offline. Tuân thủ inbox/history retention mà user đã chọn.

## B11. Latency measurement and truthful UI

Record timestamps:

- `sourceCreatedAt`.
- `providerReceivedAt`.
- `gatewayReceivedAt`.
- `desktopReceivedAt`.
- `renderedAt`.

Calculate:

- Source-to-gateway latency.
- Gateway-to-desktop latency.
- Desktop-to-render latency.
- End-to-end observed latency.

Initial engineering targets (not provider SLA):

| Path | Initial target |
|---|---|
| Local native event to render | p95 ≤ 2 seconds where API permits |
| Push/webhook gateway to desktop render | p95 ≤ 5 seconds under healthy network conditions |
| Full source-to-render push path | p95 ≤ 10 seconds as an initial test objective |
| Polling/scheduled sync | Display actual provider interval; do not label realtime |

Report p50, p95, sample count, test period, network condition, provider path and OS.

A target that is not met must be reported, not hidden.

## B12. Failure handling and troubleshooting

### No event received

Check:

- Account connected.
- Required scopes granted.
- Correct trigger type selected.
- Trigger instance active.
- Webhook subscription active.
- Provider event type actually matches subscription.
- Provider event delivery mode.
- Gateway reachable over HTTPS.
- Signature verification result.
- Event routing user/account IDs.

### Event arrives late

Check:

- Realtime vs polling mode.
- Provider limits.
- Subscription renewal.
- Webhook delivery retries.
- Queue backlog.
- Desktop network connection.
- Polling interval.

Do not call it an animation delay if the provider event itself arrived late.

### Duplicate notifications

Check:

- Provider retry IDs.
- Source message/resource ID.
- Cross-provider duplicate path.
- Event replay.
- Idempotency persistence.

### Stale subscription

Check:

- Gmail watch expiration.
- Calendar channel expiration.
- Microsoft Graph subscription expiration.
- Composio trigger instance status.
- OAuth revocation/expiry.

## B13. End-to-end test procedure

For every connector claimed as realtime:

1. Connect an actual test account.
2. Verify exact trigger or subscription capability.
3. Record the source event creation time.
4. Create one new event in the source application.
5. Capture provider/webhook reception time.
6. Capture desktop reception time.
7. Capture rendered notification time.
8. Verify source application and event identity.
9. Verify emotion mapping.
10. Verify Attention Management behavior.
11. Verify no duplicate card.
12. Repeat with multiple events.
13. Disconnect network temporarily and restore it.
14. Check event recovery/reconciliation.
15. Revoke authorization and verify connection status.

For a polling connector, perform the same test but report the polling interval and observed delay. Do not pass the realtime acceptance gate.

## B14. Integration acceptance matrix

| Test | Expected result |
|---|---|
| OAuth/connect | User account connected and verified |
| Trigger discovery | Exact event type and schema documented |
| Realtime capability | Provider push is verified, not assumed |
| Webhook validation | Invalid signature rejected |
| Event normalization | Correct source, account, time and event ID |
| Idempotency | Duplicate deliveries do not create repeated cards |
| Latency | p50/p95 are measured |
| Offline/reconnect | Recovery follows provider cursor/reconciliation support |
| Focus/Hidden Mode | Event is queued/suppressed according to user policy |
| Disconnect | Trigger and access are disabled/revoked as supported |

---

# PHẦN C — HƯỚNG DẪN TRIỂN KHAI THEO THỨ TỰ

## C1. P0 — MVP

1. Audit repository, Three.js loop and existing animation implementation.
2. Complete Mèo Mochi model and actual animation clips.
3. Implement a single AnimationController with state transitions.
4. Test all available emotion and interaction transitions.
5. Build normalized notification event model.
6. Build Attention Management before adding many providers.
7. Implement Focus/Presence and quick controls.
8. Implement one local/native event path that the platform officially supports.
9. Choose one Composio trigger that is verified realtime, or use an official direct push API if the Composio trigger is polling.
10. Implement the Integration Gateway if cloud webhooks are required.
11. Measure event-to-render latency.
12. Test duplicate, retry, offline and reconnect behavior.

## C2. P1 — Product maturity

1. Complete Control Center integration diagnostics.
2. Add further providers one at a time.
3. Add provider-specific push mechanisms where justified.
4. Expand Boba, Cloud and Pip.
5. Add advanced animation variations and multi-monitor edge cases.
6. Perform macOS/Windows regression testing.

## C3. P2 — Optional

1. Cosmetic accessories.
2. Seasonal themes.
3. Extra animation collections.
4. Custom sound packs.
5. Optional local classification enhancements.

## C4. Required implementation records

For each animation and provider, record:

- Asset/connector name.
- Version.
- Supported capability.
- Actual delivery mode.
- Configuration.
- Permissions.
- Test environment.
- Test steps.
- Observed result.
- Latency.
- Known limitations.

---

# OFFICIAL REFERENCES

The following references are starting points. Re-check version and provider capability at implementation time.

## Composio

- Triggers overview: https://docs.composio.dev/docs/triggers
- Receiving events: https://docs.composio.dev/docs/setting-up-triggers/subscribing-to-events
- Creating triggers: https://docs.composio.dev/docs/setting-up-triggers/creating-triggers
- Trigger API: https://docs.composio.dev/reference/api-reference/triggers
- Trigger troubleshooting: https://docs.composio.dev/docs/setting-up-triggers/troubleshooting
- SDK trigger verification: https://docs.composio.dev/reference/sdk-reference/typescript/triggers
- Changelog: https://docs.composio.dev/reference/changelog

## Google

- Gmail push notifications: https://developers.google.com/workspace/gmail/api/guides/push
- Gmail synchronization: https://developers.google.com/workspace/gmail/api/guides/sync
- Google Calendar push notifications: https://developers.google.com/workspace/calendar/api/guides/push

## Microsoft

- Microsoft Graph change notifications: https://learn.microsoft.com/graph/change-notifications-overview
- Webhook delivery: https://learn.microsoft.com/graph/change-notifications-delivery-webhooks

## Other providers

- Slack Events API: https://api.slack.com/apis/events-api
- Notion Webhooks: https://developers.notion.com/reference/webhooks
- Discord Gateway: https://discord.com/developers/docs/topics/gateway

---

**Implementation rule:** Do not label an integration or animation as complete based on configuration files alone. Verify the actual runtime behavior, record evidence, and document any provider or hardware limitation.
