# 🐾 CUTE PET COMPANION — MASTER ARCHITECTURAL BLUEPRINT V3.2
## Smart 3D Desktop Companion — Smooth Animation, Real-Time Integrations & User-Centered UX
*Document Version: 3.2.0 — Final Production Blueprint & Architectural Specification*

> **Cập nhật V3.2.0:**
> * **Bỏ khung xương cứng cố định:** Mục kỹ thuật khung xương cố định trước đây đã được gỡ bỏ hoàn toàn. Chi tiết giải phẫu, rigging từng loài và quy trình xuất `.glb` được quản lý chuyên biệt tại [BLENDER_GUIDE.md](file:///Users/anhnguyen/Documents/PROGRAMING/cute-pet-notifier/docs/BLENDER_GUIDE.md) và [ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md](file:///Users/anhnguyen/Documents/PROGRAMING/cute-pet-notifier/docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md).
> * **Smooth Animation System (P0):** Chuẩn hóa bộ điều khiển AnimationController, phân lớp hoạt họa (Layers), kỹ thuật hòa trộn chuyển động (Cross-fading 0.18s–0.35s) và mục tiêu benchmark 60 FPS.
> * **Real-Time Integration Router (P0):** Tích hợp Composio + Native OS + Direct API + Custom Webhook; phân định rõ **Actions** và **Triggers**; tuyệt đối không gắn nhãn polling là realtime; mô hình Public HTTPS Gateway bảo vệ an toàn cổng nội bộ `127.0.0.1:3721`.
> * **Attention Management & Adaptive Presence (P0):** Chống mỏi thông báo, chế độ tàng hình khi họp/gaming, gom chùm tin nhắn, hộp thư Inbox và Digest.
> * **Tương tác vật lý phong phú:** Kéo thả tự do trên màn hình (Free Drag & Drop), trạng thái bị nhấc bổng (`isGrabbed`), 5 Theme đồ họa và Song ngữ Tiếng Việt 🇻🇳 / English 🇺🇸.

---

# 🌟 1. ROLE, TẦM NHÌN & 15 NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)

## 1.1 Tầm nhìn Sản phẩm
**Cute Pet Companion** là ứng dụng desktop đa nền tảng (**macOS** & **Windows 10/11**) biến các thông báo hệ thống khô khan, gây stress thành những tương tác sống động, có ngữ cảnh và cảm xúc cùng người bạn thú cưng 3D ảo sống ngay trên màn hình máy tính.

Ứng dụng kết hợp hài hòa:
* Thú cưng 3D hoạt họa mượt mà, phản ứng linh hoạt với ngữ cảnh làm việc.
* Quản lý sự chú ý thông minh, giảm thiểu tối đa hiện tượng phân tâm và stress thông báo.
* Tiếp nhận thông báo theo thời gian thực (Push-first) từ các ứng dụng hàng ngày qua Composio và Direct API.
* Tương tác vật lý thực tế: ôm giữ thẻ thông báo, phản ứng xúc giác vuốt ve, né tránh và la hét khi bị nhấc bổng kéo thả.

## 1.2 Mười Lăm Nguyên Tắc Bất Biến (Non-Negotiable Product Principles)
1. **Bảo tồn tính năng hoạt động:** Giữ vững và kế thừa các chức năng đã kiểm chứng của dự án.
2. **Kiến trúc mô-đun hóa cao:** Tách biệt tuyệt đối giữa 3D Rendering, Animation Controller, Emotion Engine, Attention Management, Notification Pipeline và Integration Providers.
3. **Chiến lược Pilot-First:** **Mèo Mochi (`cat_mochi`)** phải hoàn thiện 100% về visual, rig, morph và runtime animation trước khi sản xuất 3 nhân vật kế tiếp.
4. **Nguyên tắc "1 Mô hình / 8 Cảm xúc":** Tuyệt đối không tạo 32 file mesh độc lập! Mỗi nhân vật dùng đúng 1 mô hình `model.glb` duy nhất kết hợp armature, shape keys và animation clips.
5. **Độc lập Logic Cảm xúc:** Emotion Engine và Rule Classifier hoạt động hoàn toàn độc lập với nhân vật đang kích hoạt.
6. **Hoạt họa phải mượt trong Three.js runtime:** Mọi chuyển động phải mượt mà trong ứng dụng thực tế, không chỉ mượt trong phần mềm dựng hình Blender.
7. **Ưu tiên Push-First cho thông báo:** Tận dụng push event/webhook chính thức khi nhà cung cấp hỗ trợ.
8. **Tuyệt đối không gọi Polling là Realtime:** Cơ chế quét định kỳ (polling) phải được ghi nhãn minh bạch là `near_realtime_poll` hoặc `scheduled_sync`, đi kèm khoảng thời gian trễ thực tế.
9. **Kiểm soát gián đoạn trước khi mở rộng tích hợp:** Hoàn thiện Attention Management và Adaptive Presence trước khi kết nối thêm nhiều ứng dụng ngoài.
10. **Người dùng toàn quyền kiểm soát:** Cho phép người dùng tùy chỉnh trạng thái hiện diện (Full / Minimal / Hidden), âm thanh, tần suất và nguồn thông báo.
11. **Không gây áp lực tâm lý:** Tuyệt đối không dùng tin nhắn mang tính chất khiển trách, ép buộc vuốt ve, duy trì chuỗi điểm (streaks) hay phạt khi không tương tác.
12. **Nói không với tính năng giả:** Không tạo nút bấm giả lập, không mock trạng thái kết nối hoặc hiển thị preview giả tạo.
13. **Bảo mật token và API Key tuyệt đối:** Không bao giờ để lộ Shared Composio API Key hoặc OAuth secrets trong renderer code hay bộ cài desktop phân phối.
14. **Minh bạch vị trí xử lý dữ liệu:** Công khai rõ ràng nguồn nào xử lý cục bộ (Local), nguồn nào đi qua cổng trung gian đám mây (Cloud-mediated).
15. **Đo đạc hiệu năng bằng số liệu thực:** Báo cáo thời gian phản hồi, p50/p95 latency và FPS bằng kết quả đo thực tế, không đưa ra con số ước chừng.

---

# 🐾 2. THƯ VIỆN NHÂN VẬT & BỘ NHẬN DIỆN BẤT BIẾN

Ứng dụng hỗ trợ 4 nhân vật với bộ nhận diện bất biến qua mọi góc nhìn:

```
+---------------------------------------------------------------------------------------------------------+
| 🐱 MÈO MOCHI (cat_mochi)      - PILOT PRODUCTION | Scottish Fold tai cụp, kem & cam pastel, nơ đỏ chuông vàng |
| 🐶 CHÓ BOBA  (dog_boba)       - KẾ HOẠCH PH. 8  | Corgi chân ngắn, lông vàng mật & trắng tuyết, bandana xanh |
| 🐰 THỎ CLOUD (bunny_cloud)    - KẾ HOẠCH PH. 8  | Netherland Dwarf, trắng tuyết, má hồng, kẹp mầm cây xanh    |
| 🐧 PENGUIN PIP (penguin_pip)  - KẾ HOẠCH PH. 8  | Cánh cụt baby, lưng xanh đá phiến, bụng trắng, mũ len vàng |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 Mèo Mochi (`cat_mochi`) — Nhân vật Pilot Sản Xuất
* **Loài & Hình thể:** Chibi Scottish Fold tròn xoe múp míp, hai tai gập cụp sát đầu, thân tròn mềm dẻo như bánh mochi.
* **Màu sắc & Chất liệu:** Lông kem pha cam đào pastel, đệm chân hồng phấn; chất liệu matte vinyl toy cao cấp.
* **Phụ kiện:** Vòng cổ nơ ruy băng lụa đỏ thắm gắn một chiếc chuông vàng nhỏ xíu lắc leng keng.
* **Tính cách:** Đáng yêu, nũng nịu khi vuốt ve, nhưng cực kỳ xéo xắc khi bị làm phiền; la hét đòi buông ra khi bị nhấc bổng.

### 2.2 Chó Boba (`dog_boba`) — Kế hoạch Phase 8
* **Loài & Hình thể:** Corgi puppy chân ngắn mập ú, mông tròn to, tai to vểnh nhọn hình tam giác bo góc.
* **Màu sắc & Phụ kiện:** Vàng mật ong và trắng tuyết, đốm lông mày tròn hạt đậu trắng; khăn bandana chấm bi xanh ngọc.

### 2.3 Thỏ Cloud (`bunny_cloud`) — Kế hoạch Phase 8
* **Loài & Hình thể:** Netherland Dwarf trắng muốt như bông tuyết, đôi tai ngắn tròn chụm, má phúng phính.
* **Màu sắc & Phụ kiện:** Trắng tuyết phớt hồng đào; kẹp tóc mầm cây non nhỏ xíu trên tai trái.

### 2.4 Chim cánh cụt Pip (`penguin_pip`) — Kế hoạch Phase 8
* **Loài & Hình thể:** Cánh cụt baby dáng quả lê tròn lẳn, đôi cánh bơi ngắn múp míp, mỏ cam ngắn.
* **Màu sắc & Phụ kiện:** Lưng xanh đá phiến pastel, bụng trắng tinh; đội mũ len dệt kim màu vàng ấm áp.

---

# 🏷️ 3. QUY ƯỚC ASSETS & CANONICAL EMOTION SCHEMA

Hệ thống sử dụng **duy nhất 8 mã cảm xúc chuẩn (Canonical IDs)** trong toàn bộ mã nguồn:

| Asset Key | Canonical ID | Tên hiển thị (VI) | Display Name (EN) | Hành vi / Hoạt họa 3D | Morph Targets & Poses |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01_happy` | **`happy`** | Vui vẻ | Happy | Mắt trăng khuyết cười tít, vẫy đuôi, tai giật nhẹ, nhảy nhót | `eyes: arcHappy`, `bounce: 0.25` |
| `02_excited` | **`excited`** | Hào hứng | Excited | Mắt sáng sao lấp lánh, người chồm tới háo hức, hai tay vẫy | `eyes: star`, `cheek: 1.2` |
| `03_love` | **`love`** | Yêu thương | Love / Kudos | Má hồng ửng đào, mắt trái tim, ôm má nũng nịu, tim 3D bay | `eyes: heart`, `blush: 1.0` |
| `04_surprised` | **`surprised`** | Bất ngờ | Surprised | Mắt tròn xoe, giật nảy mình, tai dựng đứng, há hốc mồm | `eyes: open`, `eyeScale: 1.35`, `jolt` |
| `05_angry` | **`angry`** | Cáu kỉnh | Grumpy / Angry | Má phồng to, đầu lắc nguầy nguậy, chân dậm bình bịch, bốc khói | `browAngle: 0.35`, `shake: 0.4` |
| `06_sad` | **`sad`** | Buồn bã | Sad / Error | Mắt ầng ậng nước, tai cụp sâu u sầu, gục đầu buồn rũ rượi | `tears: true`, `lean: -0.15` |
| `07_thinking` | **`thinking`** | Suy tư | Thinking | Đầu nghiêng 30°, một tay chống cằm, mắt nhìn lên trên | `pitch: 0.25`, `yaw: 0.3` |
| `08_sleeping` | **`sleeping`** | Ngủ say | Sleeping / DND | Mắt nhắm nghiền, cuộn tròn người thở êm, chữ Zzz bay lơ lửng | `eyes: arcClosed`, `breathFreq: 0.6` |

> [!NOTE]
> Các trạng thái như `idle` (nhàn rỗi), `hidden` (tàng hình) và `focused` (chế độ tập trung) thuộc về hệ thống Hiện diện (Presence) và Vận hành (Runtime State), tách biệt hoàn toàn với 8 Canonical Emotion IDs.

### Ánh xạ Sự kiện Mặc định (Default Notification Event Mapping)
```text
TASK_DONE   (Build xong, tải file hoàn tất)     --> happy
NEW_PING    (Tin nhắn Slack/Zalo mới)           --> excited
KUDOS       (Lương về, khen thưởng, thả tim)     --> love
WARNING     (Pin yếu, CPU nóng, cảnh báo máy)   --> surprised
OVERDUE     (Deadline sát nút, sếp réo)         --> angry
ERROR       (Build lỗi, mất kết nối mạng)       --> sad
LOADING     (Đang đồng bộ dữ liệu)              --> thinking
IDLE_DND    (Chế độ Không làm phiền / Đêm)      --> sleeping
```

---

# 🎨 4. BỘ PROMPTS CHUẨN SẢN XUẤT 2D VÀ 3D

### 4.1 Master Reference Prompts (Tỷ lệ 1:1, Nền trắng, Đứng thẳng)
* **Mèo Mochi (`cat_mochi`):**
  ```text
  cute chibi Scottish Fold cat, round chubby body, cream and pastel orange fur, pink paw pads, wearing a red ribbon collar with a small gold bell, standing front view, neutral happy expression, 3D Pixar-inspired vinyl toy style, smooth matte texture, clean solid white background, consistent character proportions --ar 1:1 --no text --no watermark
  ```
* **Chó Boba (`dog_boba`):**
  ```text
  cute chibi Corgi puppy, stubby short legs, round body, golden honey and snow white fur, white bean-shaped eyebrows, wearing a light blue polka-dot bandana, standing front view, neutral happy expression, 3D Pixar-inspired vinyl toy style, smooth matte texture, clean solid white background, consistent character proportions --ar 1:1 --no text --no watermark
  ```
* **Thỏ Cloud (`bunny_cloud`):**
  ```text
  cute chibi Netherland Dwarf bunny, round plump body, snow white fur with peach-pink ear tips and rosy cheeks, wearing a small green sprout clip on the left ear, standing front view, neutral happy expression, 3D Pixar-inspired vinyl toy style, smooth matte texture, clean solid white background, consistent character proportions --ar 1:1 --no text --no watermark
  ```
* **Chim cánh cụt Pip (`penguin_pip`):**
  ```text
  cute chibi baby penguin, pear-shaped round body, short plump flippers, pastel slate-blue back and white belly, wearing a small yellow knitted beanie, standing front view, neutral happy expression, 3D Pixar-inspired vinyl toy style, smooth matte texture, clean solid white background, consistent character proportions --ar 1:1 --no text --no watermark
  ```

### 4.2 Four-View Turnaround Prompts (Tỷ lệ 16:9, 4 góc nhìn chuẩn kỹ thuật)
* **Mèo Mochi:**
  ```text
  character turnaround sheet of the exact same cute chibi Scottish Fold cat with cream and pastel orange fur, red ribbon collar and small gold bell, four consistent views: front view, left side view, right side view, back view, standing symmetrical idle stance, consistent body proportions, folded ears, 3D Pixar-inspired vinyl toy style, smooth matte texture, clean solid white background, professional character design, no text or labels --ar 16:9
  ```
*(Các nhân vật Boba, Cloud, Pip áp dụng cấu trúc turnaround tương ứng với đặc điểm mô tả).*

### 4.3 Meshy / Tripo Multi-View Image-to-3D Prompts
* **Mèo Mochi (`assets/pets/cat_mochi/model.glb`):**
  ```text
  A cute chibi Scottish Fold cat, round chubby proportions with folded ears, cream and pastel orange fur, pink paw pads, wearing a red ribbon collar with a small gold bell, smooth matte vinyl surface, Pixar-inspired stylized animated-film aesthetic, symmetrical neutral idle stance, clean geometry, simple deformation-friendly topology, low-poly game-ready character asset, optimized for real-time animation.
  ```
* **Shared Negative Prompt:**
  ```text
  no background elements, no floating particles, no text, no labels, no watermark, no thin disconnected whiskers, no disconnected parts, no extra limbs, no distorted proportions, no unnecessary accessories, no broken geometry
  ```

---

# 🎞️ 5. HỆ THỐNG HOẠT HỌA MƯỢT MÀ (SMOOTH ANIMATION SYSTEM — P0)

Hoạt họa mượt mà là yêu cầu cấp thiết hàng đầu (P0) của sản phẩm. Tuyệt đối không chỉ gọi `play()` một cách thô bạo mỗi khi cảm xúc thay đổi.

### 5.1 Các Lỗi Nghiêm Ngặt Phải Triệt Tiêu
1. **Pose Popping:** Đổi tư thế tức thời giữa hai clip khiến nhân vật bị giật cục.
2. **Abrupt Snap Transitions:** Kết thúc clip đột ngột quay về gốc mà không có easing.
3. **Clip Conflicts:** Hai animation điều khiển cùng một nhóm xương đồng thời gây rung giật.
4. **Foot Sliding:** Bàn chân trượt trên mặt sàn khi đang trong tư thế đứng yên.
5. **Morph Target Jumps:** Biểu cảm mắt, miệng nhảy cóc thay vì biến dạng mềm mại.
6. **Time-Jump Jitter:** Giật khung hình sau khi máy tính thức dậy từ chế độ Sleep hoặc ứng dụng bị Suspend.

### 5.2 Kiến Trúc Phân Lớp Hoạt Họa (Animation Layering)
Hệ thống quản lý chuyển động theo 5 tầng độc lập:
1. **Base Layer:** `idle` hoặc `sleeping` chạy ngầm làm tư thế tham chiếu.
2. **Action/Emotion Layer:** Các clip biểu cảm (`happy`, `angry`, `surprised`...) và thao tác tương tác (`hold_card`, `kick`, `pet`, `grabbed`).
3. **Facial Layer:** Shape keys / Morph targets điều khiển mắt chớp, miệng cười, má phồng uốn lượn.
4. **Secondary Motion Layer:** Chuyển động phụ tự nhiên của tai, đuôi, nơ chuông lắc lư theo gia tốc.
5. **Presentation & VFX Layer:** Thẻ thông báo thở (`--breath`), hạt tim bay, dấu `💢`, bóng đổ co dãn.

### 5.3 Bộ Điều Khiển Hoạt Họa Trung Tâm (Central AnimationController)
* **Cross-fading động (Dynamic Blending):** Hòa trộn giữa hai clip bằng `fadeIn()` và `fadeOut()` với khoảng thời gian thích ứng từ **0.18s đến 0.35s** tùy thuộc vào tính chất hành động.
* **State Machine & Priority Matrix:**
  * Khẩn cấp / Giật mình (`surprised`, `isGrabbed`): Ưu tiên ngắt ngay lập tức clip đang phát.
  * Tương tác vuốt ve (`pet`): Chèn đè mượt mà lên idle, sau đó tự động hòa trộn trả về trạng thái cũ.
* **Bảo vệ Delta-Time:** Kẹp chặn (Clamp) `dt = min(0.05, delta)` để ngăn chặn bước nhảy thời gian khổng lồ khi máy tính vừa mở nắp sau sleep.
* **An Toàn Khuyết Clip (Missing Clip Fallback):** Nếu file `.glb` thiếu một action (ví dụ chưa có `kick`), controller tự động dùng Procedural Fallback hoặc chuyển về `happy` an toàn, tuyệt đối không làm dừng render loop.
* **Mục Tiêu Benchmark:** Đạt **60 FPS** ổn định trên máy tham chiếu trong suốt quá trình phát animation; đo đạc và công bố rõ p50/p95 frame time.

---

# 🔌 6. KIẾN TRÚC TÍCH HỢP — COMPOSIO + NATIVE OS + DIRECT API

Hệ thống tích hợp đa kênh theo mô hình **Integration Provider Router**, không phụ thuộc cứng vào bất kỳ nhà cung cấp duy nhất nào.

```
       ┌────────────────────────────────────────────────────────┐
       │             INTEGRATION PROVIDER ROUTER                │
       └──────────────────────────┬─────────────────────────────┘
                                  │
    ┌─────────────────────────────┼────────────────────────────┐
    ▼                             ▼                            ▼
[Composio Provider]      [Native OS Provider]        [Direct API Provider]
(Slack, Notion, v.v.)    (macOS / Win Toast)        (Calendar, GitHub, Webhook)
    │                             │                            │
    └─────────────────────────────┼────────────────────────────┘
                                  ▼
                     [ Internal Event Normalizer ]
                                  │
                                  ▼
               [ Attention Gatekeeper & Rule Engine ]
                                  │
                                  ▼
               [ Desktop Notification Presentation ]
```

### 6.1 Phân Biệt Tuyệt Đối: Actions vs Triggers
* **Actions:** Các thao tác do người dùng chủ động khởi tạo (ví dụ: bấm nút "Tạo issue", "Gửi phản hồi"). Một toolkit có Actions **không đồng nghĩa** là có khả năng nhận thông báo.
* **Triggers:** Các sự kiện do ứng dụng bên ngoài phát ra khi có hoạt động mới (ví dụ: có tin nhắn Slack mới).

### 6.2 Chiến Lược Real-time Theo Từng Ứng Dụng

| Ứng dụng | Kênh ưu tiên Realtime | Đánh giá & Giới hạn kỹ thuật |
| :--- | :--- | :--- |
| **Slack** | Composio Realtime Trigger hoặc Slack Events API | Hoạt động push-first qua webhook/websocket chính thức. |
| **Microsoft Outlook** | Microsoft Graph Change Notifications | Cần quản lý vòng đời gia hạn subscription (lifecycle renewal). |
| **Microsoft Teams** | Graph Resource Change Events | Xác thực resource scopes cụ thể, không suy diễn từ Outlook. |
| **Gmail** | Gmail API Push + Google Cloud Pub/Sub | Tránh Composio managed polling (15 phút trễ); push báo thay đổi và sync History API. |
| **Google Calendar** | Google Calendar Push Notification Channel | Channel trả tín hiệu resource change; ứng dụng fetch chi tiết sự kiện. |
| **Notion** | Official Notion Webhooks / Verified Trigger | Xác thực quyền workspace và schema sự kiện. |
| **Discord** | Discord Gateway (Bot/App được cấp quyền) | Chỉ nghe trong server/kênh bot có mặt; không phải đọc tin nhắn riêng toàn máy. |
| **Zalo** | Official Zalo OA Webhook / Verified Toolkit | Chỉ hỗ trợ nếu có tài khoản và quyền chính thức; nếu không hiển thị `Unsupported`. |
| **macOS / Windows** | Native Notification Center Interfaces | Sử dụng API sanctioned; không screen-scraping hay can thiệp app khác. |

### 6.3 Chế Độ Phân Phối Sự Kiện (Delivery Modes)
* **`realtime_push`:** Sự kiện đẩy từ server đến desktop tức thì (Event-driven / Webhook / WebSocket).
* **`near_realtime_poll`:** Quét định kỳ ngắn (10s – 60s) kèm hiển thị rõ tần suất cho người dùng.
* **`scheduled_sync`:** Đồng bộ theo lịch (5 phút – 1 giờ).
* **`native_os`:** Bắt trực tiếp từ hệ điều hành.
* **`manual`:** Chỉ làm mới khi bấm nút Refresh.

### 6.4 Mô Hình Public HTTPS Gateway Bảo Vệ Desktop
Máy chủ nội bộ Desktop chỉ lắng nghe an toàn tại `http://127.0.0.1:3721`. **Tuyệt đối không bao giờ mở cổng localhost ra Internet.**

```text
External Application (Slack, Notion, Outlook...)
      │
      ▼
Composio / Provider Trigger Webhook
      │
      ▼
Public HTTPS Integration Gateway (Cloud Endpoint)
      │
      ├─ 1. Signature Verification (HMAC SHA-256)
      ├─ 2. Timestamp & Replay Attack Defense
      └─ 3. Idempotency Check (Chống trùng Event ID)
      │
      ▼
Durable Event Queue (Hàng đợi sự kiện an toàn)
      │
      ▼ (Authenticated Outbound WSS / SSE Channel)
Local Desktop Client (Cute Pet Companion)
      │
      ▼
Local Pipeline (:3721) ➔ Attention Engine ➔ 3D Pet
```

* **Desktop chủ động kết nối ra ngoài:** Client desktop khởi tạo đường truyền bảo mật (WebSocket/SSE) đến Gateway để nhận sự kiện, bảo vệ người dùng sau router/firewall mà không cần port forwarding.
* **Bảo vệ Secret:** Khóa API Composio của dự án chỉ lưu trên Gateway an toàn, không đóng gói trong file cài đặt máy người dùng.

---

# 🧠 7. QUẢN LÝ SỰ CHÚ Ý (ATTENTION MANAGEMENT ENGINE — P0)

Hệ thống chống mỏi thông báo bảo đảm ứng dụng không bao giờ trở thành kẻ làm phiền:

```
[ Sự kiện thông báo mới ]
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ATTENTION GATEKEEPER                                        │
│ • Kiểm tra Trùng lặp (Deduplication trong 30 giây)           │
│ • Kiểm tra Chế độ Tập trung (Focus / Meeting / Gaming)       │
│ • Kiểm tra Cooldown từng ứng dụng (Rate-limit 3 tin / 10s)   │
│ • Gom chùm tin tức (Burst Grouping thành 1 thông báo tổng)   │
└────────────────────────────────┬────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
        [ Đủ điều kiện hiện ]           [ Bị kìm hãm / DND ]
                 │                               │
                 ▼                               ▼
       Hiển thị thẻ 3D + Pet            Lưu vào Hộp thư Inbox
       theo cấp độ Ưu tiên              (Không pop-up, không chuông)
```

### 7.1 Bốn Cấp Độ Ưu Tiên (Priority Levels)
1. **Critical (Khẩn cấp):** Cảnh báo hệ thống, pin cạn kiệt, server sập ➔ Luôn được phép vượt rào làm phiền, kích hoạt hoạt họa giật mình (`surprised`).
2. **Important (Quan trọng):** Tin nhắn trực tiếp (DM), sếp réo, lịch họp trong 5 phút ➔ Hiển thị chuẩn.
3. **Normal (Bình thường):** Hoàn thành tác vụ, cập nhật thông thường ➔ Tuân theo cooldown.
4. **Low (Ít quan trọng):** Tin khuyến mãi, bản tin định kỳ ➔ Đưa thẳng vào Inbox hoặc Digest, không bật thẻ popup.

---

# 🌙 8. HIỆN DIỆN THÍCH ỨNG & CHẾ ĐỘ TẬP TRUNG (FOCUS MODES — P0)

### 8.1 Ba Trạng Thái Hiện Diện (Adaptive Presence)
* **Full Presence (Đồng hành Toàn phần):** Thú cưng ngồi góc màn hình, thở nhịp nhàng, dõi mắt theo chuột, đón nhận vuốt ve.
* **Minimal Presence (Tối giản):** Thú cưng ngủ cuộn tròn gọn gàng ở góc nhỏ, không cử động mạnh hay làm xao nhãng.
* **Hidden Mode (Tàng hình Hoàn toàn):** Ẩn toàn bộ giao diện thú cưng khi người dùng cần sự tập trung tuyệt đối.

### 8.2 Sáu Chế Độ Tập Trung (Focus Operating Modes)
* **Work Mode:** Lọc bỏ thông báo giải trí; thú cưng giữ vẻ nghiêm túc, chăm chỉ.
* **Deep Focus Mode:** Tắt toàn bộ âm thanh và hoạt họa giật mình; chỉ thông báo khẩn cấp mới được hiện.
* **Meeting Mode:** Thú cưng chuyển sang `sleeping`, tắt tiếng chuông và hiệu ứng.
* **Gaming Mode:** Tự động phát hiện ứng dụng toàn màn hình, hạ mức sử dụng CPU của WebGL xuống 0%.
* **Relax Mode:** Bật toàn bộ tương tác xúc giác, âm thanh vui tươi, chào đón cưng nựng.
* **Sleep Mode:** Giữ im lặng tuyệt đối theo khung giờ hẹn trước (Quiet Hours).

---

# 🖐️ 9. TƯƠNG TÁC VẬT LÝ, KÉO THẢ & TRẠNG THÁI BỊ NHẤC BỔNG

### 9.1 Kéo Thả Tự Do (Free Drag & Drop Desktop Positioning)
Người dùng có thể nhấn giữ chuột trái vào Mèo Mochi và di chuyển bé đi khắp mọi vị trí trên màn hình:
* Tự do đặt tại bất kỳ tọa độ `(x, y)` nào.
* Tự động lưu tọa độ vào `settings.appearance.customPosition`.
* Có nút **"↺ Đặt lại vị trí mặc định"** trong Control Center để đưa bé về lại dock góc màn hình.

### 9.2 Trạng Thái Bị Túm Gáy / Nhấc Bổng (`isGrabbed`)
Khi người dùng nhấn giữ chuột và kéo di chuyển, thú cưng lập tức kích hoạt phản ứng:
* **Mochi Scruff Stretch:** Thân mèo kéo dãn dọc đàn hồi (`scale.y: 1.18, scale.x: 0.9`).
* **Dangling Paws:** Hai chân sau lơ lửng đung đưa tự do theo quán tính chuyển động chuột.
* **Paw Flailing:** Hai chân trước giơ lên quạt nhẹ hốt hoảng tìm chỗ bám.
* **Startled Face & Bell Jingle:** Mắt mở to tròn xoe ngơ ngác, miệng chữ O; chiếc chuông vàng trên cổ rung lắc dữ dội phát ra tiếng kêu leng keng liên hồi.
* **Bong bóng thoại la hét hài hước:**
  * *Tiếng Việt:* *"Á á buông tui ra!"*, *"Sen nhấc tui đi đâu đấy?! 🙀"*, *"Thả tui ra mauuu! 🐾"*, *"Oái oái lơ lửng rồi!"*.
  * *English:* *"Ahhh put me down!"*, *"Where are you taking me?! 🙀"*, *"Unhand me, human! 🐾"*, *"Whoa I'm floating in mid-air!"*.
* **Tiếp đất êm ái (Landing Bounce):** Khi thả chuột, thú cưng tiếp đất với cú nhún nảy đàn hồi (`landing squash bounce`) và thở phào nhẹ nhõm: *"Phù, được tiếp đất rồi! 😌"*.

### 9.3 Tương Tác Xúc Giác & Thao Tác Thẻ
* **Xoa đầu (Head Petting):** Di chuột nhanh trên đỉnh đầu kích hoạt squash má, nheo mắt cười và bắn tim 3D.
* **Né tránh (Evasion):** Khi gặp thông báo khó chịu, thú cưng ngả người lùi sau né tránh chuột ("Tránh xa ra, đừng chạm vào tui!").
* **Đá bay thông báo (Kick Action):** Người dùng bấm "😒 Đá bay!" ➔ thú cưng tung cú đá xoay 360 độ đá văng thẻ thông báo khỏi màn hình.

---

# 🎨 10. GIAO DIỆN THẺ (5 THEMES) & ĐA NGÔN NGỮ (i18n)

### 10.1 Năm Bộ Giao Diện (Five Visual Themes)
1. **Cute Pastel (Mặc định):** Màu kem đào sữa ấm áp, viền 3D mềm mại phong cách Art Toy Pop Mart.
2. **Minimal White:** Trắng tinh khiết, viền mỏng hiện đại, tối giản cho bàn làm việc chuyên nghiệp.
3. **Dark Mode:** Tím than đậm huyền bí, chữ phát sáng dịu mắt, chống mỏi mắt ban đêm cho lập trình viên.
4. **Glassmorphism:** Hiệu ứng kính mờ phủ sương `backdrop-filter: blur(28px)`, viền phản chiếu ánh sáng sang trọng.
5. **Transparent Acrylic:** Nhựa acrylic trong suốt nhẹ tênh, nhìn xuyên qua các cửa sổ làm việc bên dưới.

### 10.2 Hệ Thống Song Ngữ (Dual Language Engine)
* Hỗ trợ đầy đủ **Tiếng Việt 🇻🇳** và **English 🇺🇸**.
* Chuyển đổi tức thì trong mục Cài đặt của Control Center, cập nhật ngay lập tức giao diện nút bấm thẻ và toàn bộ lời thoại của thú cưng.

---

# ⚙️ 11. TRUNG TÂM ĐIỀU KHIỂN DESKTOP (CONTROL CENTER — 10 PHÂN HỆ)

Duy trì địa chỉ cục bộ `http://127.0.0.1:3721` và cửa sổ Native Desktop Settings với 10 phân hệ hoàn chỉnh:
1. **Dashboard:** Tổng quan trạng thái thú cưng, Live 3D Stage, hàng đợi thông báo và độ trễ tích hợp.
2. **Pet Characters:** Chọn nhân vật (Mochi, Boba, Cloud, Pip), xem Live 3D Preview, nhập file `.glb`.
3. **Emotion & Personality:** 5 Preset tính cách, độ nhạy cảm xúc, tùy biến quy tắc Keyword & App Rules.
4. **Notifications:** Kiểu cầm thẻ (Billboard, Peeker, Courier), 5 Theme, kích cỡ, thời gian hiển thị.
5. **Attention Management:** Mức ưu tiên, khoảng thời gian giãn cách (cooldown), gom nhóm, bộ lọc tắt tiếng nguồn.
6. **Application Connections:** Quản lý kết nối Composio, Direct API, trạng thái xác thực và độ trễ thực tế.
7. **Appearance & Position:** Tùy chọn Kéo Thả Tự Do, nút đặt lại vị trí mặc định, khoảng cách viền, đa màn hình.
8. **Sounds & Animations:** Âm lượng, tiếng kêu (Meo, Gâu, Chíp, Píp), độ nhạy vuốt ve, chế độ Giảm Chuyển Động (Reduced Motion).
9. **Focus & Presence:** Chuyển đổi Full / Minimal / Hidden và 6 chế độ làm việc (Work, Focus, Meeting, Gaming, Relax, Sleep).
10. **Privacy & Settings:** Khởi động cùng hệ thống, chọn ngôn ngữ (VI / EN), bảo mật mã khóa OS Keychain và xóa lịch sử.

---

# 🚦 12. LỘ TRÌNH PHÁT TRIỂN & TIÊU CHUẨN NGHIỆM THU (PHASES & GATES)

### P0 — NỀN TẢNG MVP (BẮT BUỘC HOÀN THIỆN ĐẦU TIÊN)

| Giai đoạn | Mục tiêu kỹ thuật | Tiêu chuẩn nghiệm thu (Acceptance Gate) |
| :--- | :--- | :--- |
| **Phase 0** | Khảo sát kỹ thuật & Khả thi Tích hợp | Báo cáo kiến trúc, bảng năng lực tích hợp Composio/Direct API, giải pháp Gateway và mô hình bảo mật. |
| **Phase 1** | Pilot Mèo Mochi (`cat_mochi`) | Mô hình 3D thực tế, rig, 8 cảm xúc và các clip tương tác nạp ổn định vào Three.js runtime. |
| **Phase 2** | Smooth Animation Runtime + Emotion Engine | Central AnimationController hoạt động hoàn hảo; chuyển mượt 8 cảm xúc (cross-fade 0.18s–0.35s); không pose pop/jitter; đạt 60 FPS mục tiêu. |
| **Phase 3** | Attention Management Engine | Phân cấp ưu tiên, cooldown, deduplication, batching, hàng đợi Queue và hộp thư Inbox. |
| **Phase 4** | Adaptive Presence & Quick Controls | Chuyển đổi mượt Full / Minimal / Hidden và 6 Focus Modes; lệnh thủ công luôn có quyền ưu tiên cao nhất. |
| **Phase 5** | Notification Presentation & Drag & Drop | Billboard/Peeker/Courier, 5 Themes, kéo thả tự do, phản ứng nhấc bổng `isGrabbed` và không cản trở thao tác chuột máy tính. |
| **Phase 6** | Real-time Integration POC | Ít nhất 1 kênh native OS và 1 kênh Composio realtime trigger (hoặc Direct API push) chạy thực tế; đo đạc latency đầy đủ. |

> [!CRITICAL]
> **MVP Release Gate:**
> 1. Mèo Mochi chạy hoàn thiện.
> 2. Đầy đủ 8 cảm xúc quy chuẩn.
> 3. Hệ thống animation mượt mà (Smooth Animation Controller).
> 4. Bộ máy Emotion & Rule Classifier độc lập.
> 5. Quản lý sự chú ý (Attention Management) kiểm soát tốt spam.
> 6. Hiện diện thích ứng (Adaptive Presence) và Chế độ Tập trung (Focus Modes).
> 7. Trình diễn thông báo 3D và phản ứng xúc giác (Petting, Drag & Drop).
> 8. Tối thiểu 1 luồng sự kiện Native OS thật.
> 9. Tối thiểu 1 luồng sự kiện Realtime Push thật từ ứng dụng bên ngoài qua end-to-end test.
> 10. Đảm bảo toàn vẹn bảo mật, quyền riêng tư và hiệu năng CPU.

### P1 — PRODUCT MATURITY (TRIỂN KHAI SAU KHI MVP ĐẠT CHUẨN)
* **Phase 7:** Hoàn thiện toàn diện 10 phân hệ của Control Center.
* **Phase 8:** Mở rộng 3 nhân vật tiếp theo (Boba, Cloud, Pip) trên pipeline đã chứng minh.
* **Phase 9:** Mở rộng kết nối Slack, Outlook, Teams, Gmail, Calendar, Notion theo bảng năng lực đã kiểm chứng.
* **Phase 10:** Tự động hóa lịch biểu (Calendar-aware Focus) và tính năng Digest nâng cao.
* **Phase 11:** Khả năng tiếp cận (Accessibility), Reduced Motion hoàn chỉnh và kiểm thử hồi quy đa nền tảng.

### P2 — NÂNG CAO TÙY CHỌN (KHÔNG ĐƯỢC LÀM CHẬM MVP)
* **Phase 12:** Phụ kiện thời trang (Accessories), gói âm thanh và lời thoại tùy biến.
* **Phase 13:** Bộ giao diện theo mùa (Seasonal Themes).
* **Phase 14:** Phân loại thông báo bằng AI cục bộ (chỉ bật khi người dùng cấp quyền rõ ràng).

---

# 📊 13. QUY ĐỊNH BÁO CÁO NGHIỆM THU THỰC TẾ (EVIDENCE-BASED REPORTS)

Mọi đánh giá sau khi hoàn thành các giai đoạn phát triển phải được lập thành văn bản báo cáo chi tiết đặt tại thư mục `docs/reports/` bằng Tiếng Việt:

1. **`FINAL_IMPLEMENTATION_REPORT.md`:** Báo cáo tổng kết toàn diện kiến trúc trước/sau, luồng sự kiện, kết quả kiểm thử, độ trễ đo được, hướng dẫn cài đặt và các việc cần làm tiếp theo.
2. **`IMPLEMENTATION_STATUS.md`:** Bảng trạng thái chi tiết từng tính năng (`Completed`, `Partially Completed`, `Not Implemented`, `Blocked`, `Not Tested`, `Unsupported`).
3. **`TEST_RESULTS.md`:** Nhật ký và output thực tế của các lệnh kiểm thử tự động và thủ công.
4. **`ANIMATION_QUALITY_REPORT.md`:** Báo cáo kiểm định độ mượt chuyển động, FPS trung bình, p50/p95 frame time và kiểm tra ma trận chuyển trạng thái.
5. **`REALTIME_INTEGRATION_CAPABILITY_MATRIX.md`:** Bảng kiểm toán năng lực thực tế của từng ứng dụng (Actions, Triggers, Delivery Mode, Latency).
6. **`COMPOSIO_INTEGRATION_REPORT.md`:** Chi tiết tích hợp Composio SDK, OAuth flow, cấu hình webhook và xử lý sự kiện.
7. **`SECURITY_AND_PRIVACY_REPORT.md`:** Đánh giá an toàn cổng nội bộ, xác thực webhook HMAC, mã hóa token trong OS Keychain.
8. **`PERFORMANCE_REPORT.md`:** Báo cáo đo lường sử dụng RAM, CPU khi idle và active trên macOS/Windows.
9. **`KNOWN_LIMITATIONS.md`:** Danh sách công khai các hạn chế kỹ thuật chưa khắc phục để người dùng và đội ngũ nắm rõ.

> **Cam kết chất lượng:** Không tuyên bố tính năng đã hoàn thành khi chưa có kiểm thử thực tế. Không gọi nhà cung cấp là realtime nếu chỉ dùng cơ chế polling. Không tuyên bố animation mượt mà nếu chưa chạy thử trong Three.js runtime.
