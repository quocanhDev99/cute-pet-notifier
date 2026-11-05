# 🐾 CUTE PET COMPANION — MASTER ARCHITECTURAL BLUEPRINT V3.7
## Smart Desktop Companion — Smart Notifications, Personalized Emotions & 3D Interactive Desktop Pet
*Document Version: 3.7.0 — Production Blueprint & Phase Completion Specification*
*Last Updated: 05/11/2026 · Target Platforms: macOS (Apple Silicon & Intel) & Windows 10/11*

---

> ### 📌 CẬP NHẬT TRỌNG TÂM PHIÊN BẢN V3.7.0 (05/11/2026)
> 1. **Familiar Contacts & Adaptive Relationship Intelligence (§5.3):** "👥 Người quen" chọn theo *ứng dụng → cuộc chat → thành viên* thay vì gõ tên; 11 mối quan hệ; quy tắc cho **một người** hoặc **cả nhóm chat**, gắn theo ứng dụng; hành vi riêng (ưu tiên / bình thường / nhẹ nhàng / chỉ Hộp thư); bật/tắt từng quy tắc.
> 2. **Khám phá danh sách chat:** Microsoft Teams qua **Microsoft Graph** (Composio Connect), Slack qua Web API; các app không có API (Zalo, Messenger, Telegram, iMessage) dùng **danh bạ tự học từ thông báo** (chỉ tên) + nhập tay. Bước ① tự **phát hiện app nhắn tin đã cài / đang chạy** trên máy (icon thật).
> 3. **Gợi ý "Hay nhắn nhất" & Xếp nhóm nhanh:** gợi ý người/nhóm nhắn nhiều chưa phân loại (chỉ gợi ý); xếp nhóm ngay từ **chuột phải vào thẻ thông báo** hoặc nút **👥 Xếp nhóm** trong Hộp thư.
> 4. **Giờ theo mối quan hệ & Bộ nhớ thích nghi:** mỗi quan hệ có giờ riêng / vẫn hiện trong giờ yên tĩnh / gom digest; bé tự điều chỉnh theo thói quen (chỉ metadata), có thể xem lại, tắt và xóa.
> 5. **Thứ tự ưu tiên mới trong engine (§6.3):** người > nhóm chat > quan hệ > ứng dụng > chung > mặc định — nằm trong `contact-rules.js` + `attention-engine.js`, không chỉ ở UI.
> 6. **Jira & Bitbucket đầy đủ hơn (§7.2–7.3):** thêm bình luận / @nhắc tên / cập nhật của người khác (Jira) và approve / yêu cầu sửa / bình luận trên PR của bạn (Bitbucket); trạng thái "đã thấy" lưu xuống đĩa nên khởi động lại không nuốt sự kiện.

> ### 📌 CẬP NHẬT TRỌNG TÂM PHIÊN BẢN V3.6.0
> 1. **Đồng bộ toàn diện với Master Development Prompt V3.6:** Chuẩn hóa 3 giá trị cốt lõi (*Smart Desktop Companion*, *Personalized Pet Experience*, *Comfortable Daily Usage*) và quy tắc Scope Control chống phình tính năng (Anti-bloat).
> 2. **Character Audio Identity (P0):** Xác lập bộ nhận diện âm thanh riêng biệt cho cả 4 nhân vật (*Mèo Mochi*, *Chó Boba*, *Thỏ Cloud*, *Chim cánh cụt Pip*) cùng hệ thống chống spam âm thanh (Sound Anti-Spam Priority).
> 3. **Contextual Emotion Engine & Basic Rule Studio (P0):** Phân tích ngữ cảnh nội bộ (On-device), 8 kịch bản cảm xúc quy chuẩn, nhóm quan hệ cục bộ (*partner*, *family*, *friends*, *colleagues*, *manager*), 4 cấp độ cường độ cảm xúc và ma trận giải quyết xung đột quy tắc.
> 4. **Notification Actionability & Deep Workflows (P0):** Chuẩn hóa Deep-linking, tích hợp Jira (phân biệt rạch ròi người giao việc từ changelog vs người báo cáo), quy trình Bitbucket PR Review & nút Approve xác thực API an toàn.
> 5. **Privacy Notification Architecture (P0):** Bốn chế độ hiển thị (*Full Content*, *Masked Content*, *Source Only*, *Fully Hidden*) tách biệt với Privacy phân loại cảm xúc; cơ chế Strict Privacy tuyệt đối không rò rỉ dữ liệu nhạy cảm vào log/inbox.
> 6. **Bảng Theo Dõi Tiến Độ Tự Động (Phase Completion Tracker):** Bổ sung mục riêng biệt theo dõi tiến độ chi tiết từ **Phase 0 đến Phase 14**, hiển thị minh bạch các giai đoạn đã hoàn thành `[x]`, đang thực hiện `[-]` và dự kiến `[ ]` dựa trên mã nguồn và kiểm thử thực tế.

---

# 🌟 1. ROLE, TẦM NHÌN & 3 GIÁ TRỊ CỐT LÕI (CORE VALUES)

## 1.1 Tầm nhìn Sản phẩm
**Cute Pet Companion** là ứng dụng desktop đa nền tảng (**macOS** & **Windows 10/11**) nâng tầm các thông báo hệ thống và công việc khô khan, gây áp lực thành những tương tác sống động, có ngữ cảnh và cảm xúc cùng người bạn thú cưng 3D ảo đồng hành ngay trên màn hình máy tính.

Ứng dụng cam kết mang lại 3 giá trị cốt lõi:

### A. Smart Desktop Companion (Người bạn Thông minh)
* Tiếp nhận thông báo tức thời từ các ứng dụng hàng ngày và công cụ làm việc.
* Trình diễn thông báo thông minh, tinh tế, không xâm phạm không gian làm việc.
* Mở chính xác ứng dụng gốc, luồng hội thoại chat, Jira issue hoặc Bitbucket Pull Request (Deep-linking).
* Hỗ trợ các thao tác thiết thực trực tiếp trên thẻ thông báo (Quick Actions, Approve, Snooze, Pin).
* Bảo vệ nghiêm ngặt nội dung nhạy cảm và thông tin cá nhân.
* Triệt tiêu hiện tượng mỏi thông báo (Notification Fatigue) và gián đoạn công việc không cần thiết.

### B. Personalized Pet Experience (Trải nghiệm Cá nhân hóa)
* **4 nhân vật độc bản:** Mèo Mochi, Chó Boba, Thỏ Cloud, Chim cánh cụt Pip.
* **Bản sắc âm thanh riêng biệt (Audio Identity):** Tiếng kêu và âm sắc đặc trưng cho từng nhân vật.
* **8 cảm xúc quy chuẩn (Canonical Emotions):** Phản ứng giàu biểu cảm, tự nhiên và mượt mà.
* **Bộ máy cảm xúc theo ngữ cảnh (Contextual Emotion Engine):** Phản ứng thích hợp với người gửi, nội dung và loại sự kiện.
* **Xưởng quy tắc cảm xúc (Emotion Rule Studio):** Cho phép người dùng tự do định nghĩa quy tắc cảm xúc mà không cần viết code.
* **Hoạt họa 3D mềm mại:** Chuẩn 60 FPS, hòa trộn động (cross-fade 0.18s–0.35s).
* **Tương tác vật lý xúc giác:** Vuốt ve xoa đầu, né tránh, kéo thả tự do trên màn hình và trạng thái bị nhấc bổng (`isGrabbed`).

### C. Comfortable Daily Usage (Thoải mái & Tôn trọng Người dùng)
* Chế độ Tập trung (Focus Mode), Chế độ Họp (Meeting Mode) và Giờ yên tĩnh (Quiet Hours).
* Ba trạng thái hiện diện linh hoạt: Toàn phần (Full), Tối giản (Minimal), Tàng hình (Hidden).
* Tùy biến âm thanh thông minh, chống dồn dập (anti-spam cooldown).
* Quản lý sự chú ý (Attention Management) lọc trùng, gom chùm và lưu Hộp thư (Inbox / Digest).
* Tiết kiệm tài nguyên phần cứng (CPU < 2%, RAM thấp, ngủ đông khi không hoạt động).
* Chính sách quyền riêng tư minh bạch, xử lý hoàn toàn cục bộ trên máy người dùng.

---

## 1.2 Nguyên Tắc Thành Công & Kiểm Soát Phạm Vi (Scope Control)

> [!IMPORTANT]
> **Product Success Principle:**
> Không tối đa hóa số lượng tính năng. Phải tối đa hóa:
> **Tính hữu ích thực tế · Độ tin cậy · Quyền kiểm soát của người dùng · Tính cá nhân hóa · Độ chính xác thông báo · Mức độ ít gián đoạn · Khả năng gắn bó lâu dài.**
>
> Mọi tính năng mới phải giải quyết một vấn đề có thật của người dùng. Tuyệt đối không triển khai tính năng chỉ vì nó thú vị về mặt kỹ thuật hay hào nhoáng bên ngoài.

### 10 Câu Hỏi Kiểm Soát Phạm Vi (Scope Control Checklist)
Trước khi bổ sung bất kỳ tính năng nào vào mã nguồn, kỹ sư bắt buộc phải trả lời:
1. Tính năng này giải quyết vấn đề cụ thể nào của người dùng?
2. Có module nào hiện có đã giải quyết một phần bài toán này chưa?
3. Có thể mở rộng module hiện có thay vì viết mới không?
4. Tính năng này có thực sự cần thiết cho giai đoạn P0 / MVP không?
5. Chi phí triển khai và bảo trì lâu dài là bao nhiêu?
6. Có phát sinh dependency hoặc hạ tầng mới nào không?
7. Có tạo thêm rủi ro về quyền hạn hệ thống hoặc rò rỉ dữ liệu riêng tư không?
8. Hiệu quả thành công sẽ được đo lường bằng số liệu thực tế nào?
9. Phiên bản tối thiểu khả thi (MVP implementation) là gì?
10. Những phần mở rộng nào phải dứt khoát hoãn lại cho P1 / P2?

### Quy Tắc Chống Phình Tính Năng (Anti-Bloat Rules)
* **Không tạo Engine thứ hai:** Tuyệt đối không viết thêm Emotion Engine 2, AudioManager 2, Notification Pipeline 2 hay Inbox 2.
* **Không biến thành Workflow Engine cồng kềnh:** Không xây dựng hệ thống lập trình trực quan phức tạp.
* **Không đẩy dữ liệu lên Cloud AI:** Phân loại cảm xúc và đọc nội dung phải hoàn toàn on-device; không gửi nội dung chat riêng tư lên Composio hay AI server.
* **Feature Freeze trong giai đoạn P0:** Không thiết kế lại giao diện không cần thiết, không mở rộng tích hợp ồ ạt khi P0 chưa ổn định.

---

# 🐾 2. THƯ VIỆN NHÂN VẬT & CHIẾN LƯỢC ASSET (PILOT-FIRST)

Ứng dụng sở hữu 4 nhân vật thú cưng với visual và tính cách bất biến:

```
+---------------------------------------------------------------------------------------------------------------+
| 🐱 MÈO MOCHI (cat_mochi)      - PILOT PRODUCTION | Scottish Fold tai cụp, kem & cam pastel, nơ đỏ chuông vàng       |
| 🐶 CHÓ BOBA  (dog_boba)       - PHASE 8 / P1     | Corgi chibi chân ngắn, vàng mật & trắng, bandana xanh chấm bi    |
| 🐰 THỎ CLOUD (bunny_cloud)    - PHASE 8 / P1     | Netherland Dwarf, trắng tuyết má đào, kẹp mầm cây non trên tai   |
| 🐧 PENGUIN PIP (penguin_pip)  - PHASE 8 / P1     | Cánh cụt baby dáng lê, lưng xanh đá phiến, bụng trắng, mũ len vàng|
+---------------------------------------------------------------------------------------------------------------+
```

### 2.1 Quy Tắc Pilot-First (Pilot-First Rule)
* **Mèo Mochi (`cat_mochi`)** là nhân vật pilot hoàn thiện đầu tiên, thiết lập chuẩn mực toàn bộ quy trình sản xuất asset:
  `Midjourney Reference → Meshy/Tripo Image-to-3D → Blender Rigging/Shapekeys → GLB Export → Three.js Runtime`.
* **Nguyên tắc "1 Mô hình / 8 Cảm xúc":** Mỗi nhân vật dùng **đúng 1 file `model.glb` duy nhất** chứa armature, bone hierarchy phù hợp với loài đó và các morph targets (shape keys) cho biểu cảm khuôn mặt. Tuyệt đối không xuất 32 file mesh độc lập cho 32 sắc thái cảm xúc!
* **Độc lập cấu trúc xương:** Không ép buộc cùng một cây xương (bone hierarchy) cho tất cả các loài vật khác nhau. Mỗi loài có rig giải phẫu thích hợp và được ánh xạ qua lớp giao tiếp chuẩn `semantic-map.js`.

### 2.2 Canonical Emotion Schema (8 Mã Cảm Xúc Chuẩn)
Hệ thống sử dụng duy nhất **8 mã cảm xúc chuẩn** trong toàn bộ runtime và rule engine:

| Canonical ID | Tên hiển thị (VI) | Display Name (EN) | Biểu cảm & Hành vi 3D | Morph Targets & Poses |
| :--- | :--- | :--- | :--- | :--- |
| **`happy`** | Vui vẻ | Happy | Mắt trăng khuyết cười tít, vẫy đuôi, tai giật nhẹ, nhún nhảy | `eyes: arcHappy`, `bounce: 0.25` |
| **`excited`** | Hào hứng | Excited | Mắt sáng sao lấp lánh, người chồm tới háo hức, hai tay vẫy | `eyes: star`, `cheek: 1.2` |
| **`love`** | Yêu thương | Love / Kudos | Má hồng đào, mắt trái tim, ôm má nũng nịu, tim 3D bay | `eyes: heart`, `blush: 1.0` |
| **`surprised`** | Bất ngờ | Surprised | Mắt tròn xoe, giật nảy mình, tai dựng đứng, há hốc mồm | `eyes: open`, `eyeScale: 1.35`, `jolt` |
| **`angry`** | Cáu kỉnh | Grumpy / Angry | Má phồng to, đầu lắc nguầy nguậy, chân dậm, bốc khói 💢 | `browAngle: 0.35`, `shake: 0.4` |
| **`sad`** | Buồn bã | Sad / Error | Mắt ầng ậng nước, tai cụp u sầu, gục đầu buồn rũ rượi | `tears: true`, `lean: -0.15` |
| **`thinking`** | Suy tư | Thinking | Đầu nghiêng 30°, một tay chống cằm, mắt nhìn lên trên | `pitch: 0.25`, `yaw: 0.3` |
| **`sleeping`** | Ngủ say | Sleeping / DND | Mắt nhắm nghiền, cuộn tròn người thở êm, chữ Zzz bay | `eyes: arcClosed`, `breathFreq: 0.6` |

> [!NOTE]
> Các trạng thái vận hành như **`idle`** (chờ nhàn rỗi), **`hidden`** (tàng hình), **`focused`** (tập trung) và **`isGrabbed`** (bị túm nhấc bổng) là **Runtime States**, hoàn toàn tách biệt với 8 Canonical Emotions. Khi thông báo bình thường kết thúc, thú cưng êm ái quay trở về trạng thái `idle`.

---

# 🎞️ 3. HỆ THỐNG HOẠT HỌA MƯỢT MÀ (SMOOTH ANIMATION SYSTEM — P0)

Hoạt họa mượt mà trong Three.js runtime là điều kiện tiên quyết.

### 3.1 Năm Tầng Quản Lý Chuyển Động (5 Animation Layers)
1. **Base Layer:** `idle` hoặc `sleeping` chạy tuần hoàn làm tư thế tham chiếu.
2. **Action / Emotion Layer:** Clip cảm xúc (`happy`, `surprised`, `angry`...) hoặc thao tác tương tác (`hold_card`, `kick`, `pet`, `grabbed`).
3. **Facial Morph Layer:** Shape keys / Morph targets điều khiển chớp mắt, nheo mắt cười, biến dạng miệng sau cú chớp mắt tự nhiên.
4. **Secondary Motion Layer:** Chuyển động phụ tự nhiên của tai gập, chóp đuôi và chuông cổ lắc lư theo gia tốc.
5. **Presentation & VFX Layer:** Thẻ thông báo thở nhịp nhàng (`--breath`), hiệu ứng hạt tim bay, dấu phẫn nộ `💢`, bóng đổ đàn hồi.

### 3.2 Quy Chuẩn Kỹ Thuật AnimationController
* **Cross-fading động (Dynamic Blending):** Chuyển đổi giữa các clip bằng khoảng thời gian thích ứng **0.18s – 0.35s** tùy thuộc tính chất hành động (không dùng một thời gian cứng nhắc cho mọi hành vi).
* **State Machine & Ưu tiên ngắt:** Sự kiện khẩn cấp (`surprised`) hoặc thao tác người dùng túm gáy (`isGrabbed`) có quyền ngắt ngay lập tức clip đang phát.
* **Delta-time Guard:** Kẹp chặn `dt = Math.min(0.05, delta)` để ngăn chặn tình trạng bước nhảy thời gian khổng lồ làm vỡ khung hình khi máy tính vừa mở nắp sau sleep.
* **Missing Clip Fallback:** Khi file `.glb` thiếu một animation clip cụ thể, controller tự động kích hoạt Procedural Fallback hoặc lùi về `happy`/`idle`, tuyệt đối không làm gãy render loop.
* **Reduced Motion:** Hỗ trợ tùy chọn Giảm Chuyển Động trong cài đặt hệ thống (kéo dài transition, giảm biên độ rung lắc).
* **Benchmark 60 FPS:** Đạt 60 FPS ổn định trên máy tham chiếu trong suốt quá trình phát hoạt họa. Đo đạc minh bạch FPS, Frame time (p50/p95), Dropped frames và mức tiêu thụ CPU.

---

# 🔊 4. BẢN SẮC ÂM THANH NHÂN VẬT (CHARACTER AUDIO IDENTITY — P0)

Mỗi nhân vật sở hữu một bản sắc âm thanh (Sound Identity) đặc trưng, không trùng lặp, tạo nên linh hồn cho người bạn desktop.

### 4.1 Bảng Nhận Diện Âm Thanh 4 Nhân Vật

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🐱 MÈO MOCHI — Soft & Expressive (Dịu dàng & Biểu cảm)                      │
│    • Signature: Tiếng meo nhẹ trong trẻo + âm chuông vàng leng keng thanh mảnh   │
│    • Happy: Meo ngắn lí lắc           • Excited: Meo kép ngân nga           │
│    • Love: Tiếng gừ gừ (purr) êm ái   • Surprised: Meo giật mình thất thanh  │
│    • Angry: Âm gầm gừ hờn dỗi cute   • Sad: Meo nhỏ sụt sùi u sầu           │
│    • Thinking: Tiếng rền trill tò mò  • Sleeping: Nhịp thở khẽ êm đềm       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🐶 CHÓ BOBA — Playful & Energetic (Tinh nghịch & Tràn đầy năng lượng)       │
│    • Signature: Tiếng sủa "gâu" ngắn ấm áp, phấn chấn                       │
│    • Happy: Gâu vui vẻ đuôi ngoáy      • Excited: Gâu đôi liên hồi háo hức   │
│    • Love: Tiếng rên nhẹ âu yếm       • Surprised: Tiếng ẳng giật nảy mình  │
│    • Angry: Tiếng gầm gừ hoạt hình cute• Thinking: Hít hà tò mò (sniff)      │
│    • Sleeping: Nhịp thở đều êm ấm                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🐰 THỎ CLOUD — Gentle & Delicate (Dịu dàng & Thanh thoát)                   │
│    • Signature: Tiếng chít (squeak) nhỏ xíu trong veo                       │
│    • Happy: Chít đôi nhẹ nhàng        • Excited: Tiếng chít cao trong sáng  │
│    • Love: Tiếng hít khẽ dễ thương    • Surprised: Chít ngắn giật mình       │
│    • Angry: Tiếng dậm chân thịch nhẹ  • Thinking: Thút thít suy nghĩ         │
│    • Sleeping: Thở êm ru như bông gòn                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🐧 PENGUIN PIP — Bright & Cheerful (Tươi vui & Lạc quan)                     │
│    • Signature: Tiếng "píp píp" đôi ríu rít ấm áp                            │
│    • Happy: Tiếng hót líu lo ngắn     • Excited: Píp dồn dập rộn rã         │
│    • Love: Tiếng huýt sáo nhẹ nhàng   • Surprised: Tiếng píp cao ngơ ngác    │
│    • Angry: Tiếng chuff trầm ngộ nghĩnh• Thinking: Nghiêng đầu tò mò        │
│    • Sleeping: Thở khẽ nhịp nhàng                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Kiến Trúc AudioManager Trung Tâm
Hệ thống âm thanh mở rộng từ `SoundKit` hiện tại, kết hợp giữa **Tổng hợp âm thanh Web Audio (Procedural Synthesis)** và **Tải file âm thanh bản quyền (`.mp3`/`.wav`)**:
* **Bộ quản lý ngữ cảnh Web Audio:** Sử dụng 1 `AudioContext` duy nhất, tự động resume khi có tương tác người dùng, tự động đình chỉ khi rảnh để không chiếm tài nguyên âm thanh hệ thống.
* **Cấp độ âm lượng phân tầng:**
  * Master Volume (Âm lượng tổng ứng dụng).
  * Notification Volume (Âm lượng thông báo).
  * Interaction Volume (Âm lượng tiếng kêu vuốt ve, kéo thả, nhấc bổng).
  * Per-character Volume (Âm lượng tinh chỉnh theo từng nhân vật).
* **Tuyệt đối không can thiệp âm lượng OS:** Ứng dụng chỉ điều tiết GainNode nội bộ, không chỉnh Master Volume của máy tính.

### 4.3 Cơ Chế Chống Spam Âm Thanh (Sound Anti-Spam Priority)
Mỗi sự kiện thông báo chỉ được phát **đúng 1 âm thanh chủ đạo duy nhất**. Tuyệt đối không xếp chồng (stacking) làm đinh tai nhức óc người dùng.

Thứ tự ưu tiên phát âm thanh:
1. **Âm thanh chỉ định cụ thể do người dùng gán trong Rule Studio.**
2. **Âm thanh biểu cảm của nhân vật theo kết quả phân loại Emotion Engine.**
3. **Âm thanh Signature Sound mặc định của nhân vật.**
4. **Im lặng an toàn (Silent fallback).**

Bộ lọc chặn âm thanh:
* Bỏ qua âm thanh khi rơi vào Cooldown dồn dập (Burst Cooldown).
* Tắt tiếng hoàn toàn trong: Focus Mode, Meeting Mode, Quiet Hours, Strict Privacy Mode, Global Mute.
* Không tự ý xin quyền Microphone để dò tìm cuộc gọi; tôn trọng cờ trạng thái Meeting Mode do người dùng chọn hoặc tín hiệu lịch họp chính thức.

---

# 🧠 5. BỘ MÁY CẢM XÚC NGỮ CẢNH (CONTEXTUAL EMOTION ENGINE — P0)

Bộ máy cảm xúc hoạt động hoàn toàn cục bộ trên máy tính (On-device), tuyệt đối không gửi nội dung tin nhắn lên cloud để phân loại.

```
[ Thông báo chuẩn hóa (NormalizedNotification) ]
                       │
                       ▼
 1. Kiểm tra Quy tắc Người dùng Tự định nghĩa (Custom User Rule)
                       │ (Chưa khớp)
                       ▼
 2. Kiểm tra Nhóm Người gửi / Danh bạ (Sender / Contact Group Rule)
                       │ (Chưa khớp)
                       ▼
 3. Kiểm tra Loại Ứng dụng & Sự kiện (Application / Event Rule)
                       │ (Chưa khớp)
                       ▼
 4. Phân tích Cảm xúc Nội dung Cục bộ (Local Mood Reader: Emoji + VI/EN Keyword)
                       │ (Chưa khớp / Độ tin cậy thấp)
                       ▼
 5. Cảm xúc Mặc định theo Tính cách Nhân vật (Personality Default: idle / happy)
```

### 5.1 Đầu Vào Ngữ Cảnh Cho Phép (Authorized Metadata Inputs)
* Tên ứng dụng nguồn (`appId`, `appName`).
* Định danh và tên người gửi (`senderId`, `senderName`).
* Nhóm quan hệ do người dùng gán (`contactGroup`).
* Loại sự kiện (`eventType`: tin nhắn mới, giao việc, PR review, build hoàn tất...).
* Tính chất trò chuyện: Kênh chung, tin nhắn riêng 1-1, hay được nhắc tên (@mention).
* Mức độ ưu tiên (`priority`: Critical, Important, Normal, Low).
* Metadata dự án/kho mã nguồn (Jira Project, Bitbucket Repo).
* Tiêu đề và nội dung tin nhắn: **Chỉ phân tích khi người dùng cho phép rõ ràng trong Privacy Settings.** Khi bật Strict Privacy, nội dung bị bỏ qua hoàn toàn.

### 5.2 Mười Bốn Kịch Bản Cảm Xúc Khởi Đầu (14 Core Scenarios)
Tất cả các kịch bản bắt buộc ánh xạ về **đúng 8 Canonical Emotion IDs**:

| Tình huống / Ngữ cảnh | Canonical Emotion | Diễn giải phản ứng của bé |
| :--- | :--- | :--- |
| Rủ đi cafe / trà sữa / ăn uống | **`excited`** | Mắt sáng sao, háo hức muốn đi quẩy |
| Tin nhắn từ Người yêu / Vợ chồng | **`love`** | Má ửng hồng, mắt trái tim, ôm má nũng nịu |
| Tin nhắn từ Gia đình / Bố mẹ | **`happy`** | Vui vẻ ấm áp, vẫy đuôi nhẹ nhàng |
| Bạn bè thân thiết chào hỏi | **`happy`** | Mắt trăng khuyết cười tít đón chào |
| Có Jira task mới được giao | **`thinking`** | Nghiêng đầu, chống cằm tập trung nghiên cứu |
| Việc khẩn / Deadline sát nút | **`thinking`** hoặc **`angry`** | Lo lắng suy tư hoặc cau mày bốc khói theo setting |
| Yêu cầu review Pull Request Bitbucket | **`thinking`** | Đăm chiêu đọc mã nguồn hỗ trợ đồng nghiệp |
| Pull Request được đối tác Approve | **`happy`** | Vui mừng vì công sức được ghi nhận |
| CI/CD Build thành công | **`excited`** | Nhảy nhót ăn mừng deploy thành công |
| CI/CD Build thất bại / Lỗi hệ thống | **`sad`** | Buồn bã, tai cụp u sầu chia sẻ nỗi đau bug |
| Sắp đến giờ họp / Nhắc lịch sự kiện | **`thinking`** | Chuẩn bị tinh thần tham gia cuộc họp |
| Nhận lời khen, thưởng nóng, Kudos | **`love`** | Hạnh phúc bắn tim 3D ngập tràn |
| Thông báo thường nhật, cập nhật nền | **`idle`** | Giữ thái độ bình thản, không làm phiền thị giác |

### 5.3 Người Quen & Mối Quan Hệ (Familiar Contacts & Relationship Intelligence)
Hệ thống **không bao giờ tự ý suy đoán** ai là người yêu, gia đình, sếp hay đồng nghiệp, và không phân tích nội dung trò chuyện để đoán quan hệ. Người dùng chủ động chỉ cho bé; bé chỉ **gợi ý** và **ghi nhớ metadata** khi được phép.

**A. Mười một mối quan hệ** (`CONTACT_GROUPS`, `src/core/chat-filter.js`):

| Mã | Nhãn | Mặc định |
| :--- | :--- | :--- |
| `partner` | 💕 Người yêu / Vợ chồng | cảm xúc `love` |
| `family` | 👨‍👩‍👧 Gia đình | `happy` |
| `relatives` | 👨‍👩‍👦 Người thân | `happy` |
| `close_friends` | 👫 Bạn thân | `excited` |
| `friends` | 🤝 Bạn bè | `happy` |
| `manager` | 💼 Sếp / Quản lý | `thinking`, ưu tiên `important` |
| `colleagues` | 👨‍💻 Đồng nghiệp | `thinking` |
| `teacher` | 🎓 Thầy cô | `thinking` |
| `important` | ⭐ Quan trọng | ưu tiên `important`, vượt cooldown |
| `other` | ✏️ Khác (tên quan hệ tự đặt) | — |
| `ignored` | 🔕 Bỏ qua | thẳng vào Hộp thư |

**B. Quy tắc người quen** (`settings.contacts[]`): `{ id, name, kind: person|chat, app|null, targetId|null, group, label, emotion|null (tự động theo quan hệ), attention: auto|important|normal|silent|inbox, enabled, createdAt, updatedAt }`. Trùng (cùng app + loại + tên) được gộp, bản sau thắng.
* `kind: person` khớp người gửi (trường `sender`, dòng "Tên: …" của tin nhóm, tiêu đề chat 1-1, hoặc người trong tiêu đề hoạt động "X @mentioned you").
* `kind: chat` khớp **cả nhóm chat** (tiêu đề cuộc chat; với thông báo hoạt động thì lấy tên nhóm từ tiền tố nội dung).
* `app` giới hạn quy tắc trong một ứng dụng ("Mẹ" trên Messenger ≠ "Mẹ" trên Zalo). So khớp chính xác, không phân biệt dấu.

**C. Nguồn danh sách chat cho bộ chọn** (bước ① ứng dụng → ② cuộc chat / thành viên → ③ quan hệ + cảm xúc + hành vi):
* **Ứng dụng trên máy** (`src/main/messaging-apps.js`): dò app nhắn tin đã cài / đang chạy (danh sách tiến trình + đường dẫn cài đặt, icon thật qua QuickLook) — không đọc gì bên trong app.
* **API chính thức** (`src/integrations/chat-sources.js`): *Teams* — Microsoft Graph `/me/chats` (không `$expand`, 25–50 chat/trang), tên chat 1-1 qua `$batch` `/chats/{id}/members`, thành viên nhóm tải khi mở; *Slack* — `conversations.list/members`, `users.info`. Chỉ tên & id, không bao giờ đọc tin nhắn hay `lastMessagePreview`. Danh sách (chỉ tên) lưu `chat-sources-cache.json`, mở tức thì, làm mới nền sau 5 phút. Trạng thái trung thực: `ready · not_connected · unsupported · permission · error`.
* **Danh bạ tự học** (`src/core/contact-directory.js`): với Zalo, Messenger, Telegram, iMessage… (không có API danh sách chat cho tài khoản cá nhân) — học app, tên chat, 1-1/nhóm, tên người gửi, số tin theo ngày (14 ngày), số tin quan trọng. **Không lưu nội dung.** Không học khi nội dung bị ẩn (Privacy ≠ full) hoặc khi tắt `privacy.learnContacts`.
* Bộ chọn gộp mục trùng (cùng loại + cùng tên), gộp thành viên trùng ("Nhuc" → "Nhuc Nguyen" khi chỉ có một người khớp), lọc *Chat / Cuộc họp / Tất cả*, tìm không dấu kể cả thành viên, phím ↑↓ Enter Esc, cuộn vô hạn.

**D. Gợi ý "Hay nhắn nhất":** người / nhóm có nhiều tin nhất 7 ngày qua mà chưa có quy tắc → nút *Xếp nhóm* điền sẵn bước ③. Chỉ gợi ý, không bao giờ tự tạo quy tắc.

**E. Xếp nhóm nhanh:** chuột phải vào **thẻ thông báo** → menu "👤 X là… / 👥 Cả nhóm Y là…" (đủ 11 quan hệ + gỡ); nút **👥 Xếp nhóm** trên dòng Hộp thư. Không cần mở Control Center.

**F. Giờ theo mối quan hệ** (`settings.relationships[group]`): `quietEnabled + quietStart/quietEnd` (ngoài giờ → Hộp thư, lý do `relationship_hours`), `afterHours` (vẫn hiện trong giờ yên tĩnh toàn cục), `digest` (luôn gom vào Hộp thư, `relationship_digest`). Hành vi riêng của một người luôn thắng quy tắc của quan hệ.

**G. Bộ nhớ thích nghi** (`privacy.adaptiveMemory`, mặc định bật, chỉ metadata): người gửi có ≥ 5 tin và ≥ 50 % quan trọng theo *nội dung* → ưu tiên `important`; nhóm ≥ 40 tin/ngày → hiện nhẹ nhàng, không kêu. Học từ mức ưu tiên của nội dung (không tự học từ quyết định của chính nó), không bao giờ ghi đè quy tắc người dùng; hiển thị "Bé nhận thấy…", tắt được, xóa bằng "🧹 Quên danh sách đã gặp" (không đụng quy tắc, kết nối hay tin nhắn gốc).

### 5.4 Cường Độ Biểu Cảm (Emotion Intensity Levels)
* **Level 0 (Không phản ứng):** Chỉ hiện thẻ thông báo tĩnh, thú cưng giữ nguyên tư thế nhàn rỗi.
* **Level 1 (Nhẹ nhàng):** Biến dạng nhẹ cơ mặt (chớp mắt, mỉm cười khẽ), không đổi tư thế toàn thân.
* **Level 2 (Vừa phải - Mặc định):** Đổi biểu cảm khuôn mặt và cử động thân thể nhẹ nhàng.
* **Level 3 (Mãnh liệt):** Hoạt họa toàn thân đầy đủ kèm hiệu ứng VFX (bắn tim, khói phẫn nộ, nhảy tưng bừng).

---

# 🎛️ 6. XƯỞNG QUY TẮC CẢM XÚC CƠ BẢN (BASIC EMOTION RULE STUDIO — P0)

Tích hợp trực tiếp trong Control Center, cho phép người dùng tùy chỉnh phản ứng của thú cưng mà không cần chạm vào code.

### 6.1 Điều Kiện Quy Tắc (Conditions)
Người dùng có thể kết hợp các điều kiện:
* **Ứng dụng nguồn:** Slack, Jira, Bitbucket, Teams, Mail, Calendar, System...
* **Người gửi / Định danh:** Tên hiển thị, email hoặc username.
* **Nhóm quan hệ:** `partner`, `family`, `friends`, `colleagues`, `manager`...
* **Loại sự kiện:** Task mới, PR review, tin nhắn trực tiếp, cảnh báo pin...
* **Từ khóa nội dung (Keywords):** Hỗ trợ Tiếng Việt (có dấu & không dấu) và Tiếng Anh.
* **Mức độ ưu tiên:** Critical, Important, Normal, Low.

### 6.2 Hành Động Quy Tắc (Actions)
Khi điều kiện thỏa mãn, người dùng cấu hình:
* **Cảm xúc áp dụng:** 1 trong 8 Canonical Emotions.
* **Cường độ biểu cảm:** Level 0 đến Level 3.
* **Âm thanh đi kèm:** Tắt tiếng, Signature sound, hoặc âm cảm xúc tương ứng.
* **Cách trình diễn:** Kiểu ôm bảng (Billboard), Ló đầu (Peeker), hoặc Đưa thư (Courier).
* **Khả năng hiển thị thẻ:** Bình thường, chỉ lưu Inbox, hoặc bỏ qua hoàn toàn.

### 6.3 Thứ Tự Giải Quyết Xung Đột (Conflict Resolution Hierarchy)
Khi một thông báo thỏa mãn nhiều quy tắc, bộ máy giải quyết theo thứ tự ưu tiên giảm dần:
1. **Quy tắc ghi đè cụ thể của người dùng (Explicit User Override / Custom Rule).**
2. **Quy tắc riêng của một người (Person Rule)** — vd. sếp nhắn trong nhóm đồng nghiệp vẫn được đối xử như sếp.
3. **Quy tắc của nhóm chat (Group-Chat Rule).**
4. **Quy tắc theo mối quan hệ (Relationship Policy)** — giờ riêng, digest, vẫn hiện ngoài giờ.
5. **Quy tắc ứng dụng & loại sự kiện (App & Event Rule).**
6. **Quy tắc thông báo chung / phân tích cảm xúc nội dung cục bộ (General Rules / Content Mood).**
7. **Hành vi mặc định theo tính cách nhân vật (Default Personality Preset).**

Bộ nhớ thích nghi (§5.3 G) chỉ áp dụng khi **không** có quy tắc 2–4. Người quen thắng cả bộ lọc chat "Chỉ khi liên quan đến tôi". Thực thi trong engine: `src/core/contact-rules.js → contactPolicy()` → `AttentionEngine.decide()`; tin nhắn khẩn cấp (`critical`) vẫn vượt mọi lớp như trước.

> [!CAUTION]
> **Quyền Tối Thượng Của Riêng Tư & Tập Trung:**
> Tuyệt đối không một quy tắc cảm xúc nào được phép vượt mặt:
> * Chế độ Bảo Mật Tuyệt Đối (Strict Privacy).
> * Tắt tiếng toàn cục (Global Mute).
> * Chế độ Tập Trung / Họp (Focus / Meeting Mode).
> * Chế độ Tàng Hình (Hidden Mode).

---

# 🔗 7. TÍNH HÀNH ĐỘNG CỦA THÔNG BÁO & WORKFLOWS (P0)

Ứng dụng không biến thành một hệ thống workflow cồng kềnh, mà tập trung giải quyết xuất sắc các thao tác tức thời, thiết thực nhất cho lập trình viên và nhân viên văn phòng.

### 7.1 Deep-Linking Đích Thực (Authentic Deep Links)
Mọi thông báo có nguồn gốc rõ ràng bắt buộc phải mở **chính xác mục tiêu**, không mở trang chủ chung chung:
* **Jira:** Mở thẳng URL `https://*.atlassian.net/browse/{ISSUE_KEY}`.
* **Bitbucket:** Mở thẳng trang Pull Request `https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}`.
* **Slack / Teams:** Mở thẳng kênh hoặc cuộc trò chuyện chat cụ thể.
* **Lịch họp:** Mở thẳng link Google Meet / Teams / Zoom đã được kiểm tra an toàn.
* **Nguyên tắc an toàn URL:** Xác thực giao thức HTTPS và tên miền hợp lệ trước khi gọi lệnh mở của hệ điều hành (`shell.openExternal`). Tuyệt đối không tự suy diễn hoặc dựng URL giả mạo.

### 7.2 Thông Báo Công Việc Jira (Jira Work Notifications)
* **Thông tin hiển thị:** Issue Key, Tiêu đề tóm tắt, Tên dự án, Người được giao (Assignee), Người tạo (Reporter), Trạng thái hiện tại và Độ ưu tiên.
* **Phân biệt chuẩn xác Người Giao Việc (Assigned By):**
  Hệ thống trích xuất người giao việc từ **Lịch sử thay đổi (Issue Changelog)** của Jira.
  > [!IMPORTANT]
  > **Tuyệt đối không đồng nhất Reporter là Người Giao Việc!** Nếu issue được tạo ra đã gán sẵn cho người dùng hoặc không có lịch sử gán, thẻ hiển thị trung thực: *"Người giao: không có thông tin"*.
* **Hành động chính:** Bấm nút **"↗ Mở Issue"** mở tức thì trang chi tiết trên Jira.
* **Hoạt động trên việc liên quan tới bạn (V3.7):** JQL `(assignee | reporter | watcher = currentUser()) AND updated >= -3d` qua `/rest/api/3/search/jql`; với mỗi việc vừa đổi: bình luận mới của người khác → *"💬 X bình luận KEY"*, có @nhắc bạn trong ADF → *"📣 X nhắc bạn ở KEY"* (ưu tiên `important`), không có bình luận → *"✏️ X cập nhật KEY"* từ changelog. Bỏ qua thay đổi của chính bạn và thay đổi trạng thái/người giao trên việc của bạn (đã có thẻ riêng).
* **Giới hạn trung thực:** chuông thông báo trên web là trung tâm thông báo chung của Atlassian — **không có API công khai**; app tái tạo các sự kiện quan trọng qua API chính thức.

### 7.3 Quy Trình Duyệt Pull Request Bitbucket (Bitbucket PR Review)
* **Thông tin hiển thị:** Tiêu đề PR, Tên kho mã nguồn (Repository), Mã PR (#ID), Tác giả, Người đánh giá, Nhánh nguồn ➔ Nhánh đích.
* **Nút Approve Xác Thực Trực Tiếp (Direct API Approve):**
  * Gọi trực tiếp API chính thức `POST /repositories/{ws}/{repo}/pullrequests/{id}/approve`.
  * Quản lý định danh PR an toàn trong Main Process, từ chối mọi mã định danh giả mạo.
  * Chỉ hiển thị *"✓ Đã approve"* khi API trả về mã thành công HTTP 200/201.
  * Phân định rạch ròi giữa **Approve** và **Merge**: Thao tác Approve **tuyệt đối không tự động gộp (merge)** pull request.
  * Bị ẩn hoàn toàn khi người dùng bật chế độ ẩn nội dung riêng tư.
* **Hoạt động trên PR của bạn (V3.7):** `/workspaces/{ws}/pullrequests/{me}` (endpoint `/pullrequests/{user}` cũ đã bị Bitbucket khai tử) so với ảnh chụp lần trước → *"✅ X đã approve"*, *"⛔ X yêu cầu sửa"* (`important`), *"💬 X bình luận PR của bạn"*. Bỏ qua bình luận của chính bạn.
* **Không mất sự kiện khi khởi động lại:** trạng thái "đã thấy" (chỉ id, mốc thời gian, bộ đếm) lưu ở `userData/composio-seen.json`; trước đây mỗi lần khởi động lại đều ghi mốc lại và bỏ qua thay đổi trong khoảng đó.

### 7.4 Hành Vi Thao Tác Trên Thẻ Thông Báo
Mỗi thẻ thông báo hỗ trợ đầy đủ các thao tác cơ bản:
* **Mở (Open):** Điều hướng tới ứng dụng hoặc trang web gốc.
* **Đóng (Dismiss):** Cho thẻ biến mất êm dịu, thú cưng trở về tư thế `idle`.
* **Hoãn lại (Snooze):** Đưa thông báo vào hàng đợi để nhắc lại sau 10 phút.
* **Ghim (Pin):** Giữ thẻ hiển thị trên màn hình cho tới khi người dùng tự tay đóng.
* **Tắt tiếng nhanh (Mute):** Tắt tiếng nhanh người gửi hoặc ứng dụng vừa phát thông báo.
* **Sửa nhanh cảm xúc (Quick Emotion Correction):** Cho phép người dùng chỉnh lại cảm xúc của bé nếu thấy phản ứng chưa chính xác.

> [!NOTE]
> **04/11/2026 — Hoãn, Ghim, Tắt tiếng nhanh và Sửa nhanh cảm xúc đã được gỡ khỏi thẻ theo yêu cầu người dùng** (thẻ gọn hơn). Thay thế: tắt tiếng app trong Cài đặt → Thông báo, tắt tiếng người gửi bằng nhóm 🔕 Bỏ qua (Người quen), chỉnh cảm xúc bằng Quy tắc tùy chỉnh hoặc Người quen.

---

# 🔒 8. BẢO MẬT & BẢO VỆ DỮ LIỆU RIÊNG TƯ (PRIVACY ARCHITECTURE — P0)

Quyền riêng tư là nền tảng cốt tử của sản phẩm. Người dùng luôn nắm toàn quyền quyết định dữ liệu nào được phép hiển thị trên màn hình và dữ liệu nào được phép lưu lại.

### 8.1 Bốn Chế Độ Hiển Thị Thông Báo (Privacy Display Modes)

| Chế độ | Nội dung trên thẻ 3D | Lưu trữ trong Hộp thư Inbox / History |
| :--- | :--- | :--- |
| **`full_content` (Mặc định)** | Đầy đủ tên ứng dụng, người gửi, tiêu đề, nội dung và các nút thao tác | Lưu trữ đầy đủ nội dung để xem lại |
| **`masked` (Mặt nạ)** | Tên app + tiêu đề che dạng ký tự đầu (`H••• s•••`), nội dung bị ẩn | Nội dung bị che mờ trong lịch sử |
| **`source_only` (Chỉ nguồn)** | *"Tin nhắn mới từ Slack"* / *"Thông báo mới từ Jira"*; không hiện nội dung | Chỉ lưu thời gian và nguồn ứng dụng |
| **`anonymous_source_only` (Ẩn danh)** | *"Bạn có thông báo mới"*; ẩn hoàn toàn tên app, người gửi và nội dung | Chỉ lưu vết số lượng thông báo ẩn danh |

### 8.2 Nguyên Tắc "Quy Tắc Chặt Hơn Sẽ Thắng" (Stricter Policy Wins)
* Chế độ riêng tư hiệu lực là chế độ **nghiêm ngặt hơn** giữa Cài đặt toàn cục và Danh sách ứng dụng riêng tư (`privacy.hiddenApps`).
* Một cài đặt riêng lẻ của ứng dụng không bao giờ được phép nới lỏng chế độ bảo mật toàn cục đã bật.
* **Nút gạt tức thì:** Lối tắt *"🙈 Ẩn nội dung thông báo"* có sẵn trên Khay hệ thống (System Tray) và menu chuột phải của thú cưng để che nhanh khi chuẩn bị chia sẻ màn hình.

### 8.3 Chế Độ Bảo Mật Tuyệt Đối (Strict Privacy)
Khi kích hoạt Chế độ Bảo mật Tuyệt đối:
* Tắt hoàn toàn việc phân tích nội dung tin nhắn (`body analysis = disabled`).
* Tắt tính năng trích xuất mã OTP / mật mã.
* Tuyệt đối không lưu trữ nội dung tin nhắn vào file cấu hình, bộ nhớ đệm hay Hộp thư Inbox trên đĩa.
* Làm sạch toàn bộ nhật ký ghi log (Redacted Logs), loại bỏ mọi chuỗi nhạy cảm.
* **Quy tắc bất biến:** Thú cưng tuyệt đối không bao giờ đọc to nội dung thông báo qua giọng nói (Text-to-Speech) trong bất kỳ trường hợp nào!

---

# 🧠 9. QUẢN LÝ SỰ CHÚ Ý & HIỆN DIỆN THÍCH ỨNG (ATTENTION MANAGEMENT — P0)

Hệ thống bảo đảm người bạn thú cưng luôn mang lại niềm vui, không bao giờ biến thành nguồn cơn gây xao nhãng.

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

### 9.1 Bốn Mức Độ Ưu Tiên (Priority Levels)
1. **Critical (Khẩn cấp):** Cảnh báo hệ thống, pin cạn kiệt, server sập ➔ Luôn được phép hiển thị, kích hoạt giật mình (`surprised`).
2. **Important (Quan trọng):** Tin nhắn trực tiếp 1-1, sếp nhắn, nhắc lịch họp trước 5 phút ➔ Hiển thị chuẩn.
3. **Normal (Bình thường):** Hoàn thành công việc thường nhật ➔ Tuân theo cooldown dồn dập.
4. **Low (Ít quan trọng):** Khuyến mại, bản tin cập nhật nền ➔ Chuyển thẳng vào Inbox, không pop-up.

### 9.2 Ba Trạng Thái Hiện Diện (Adaptive Presence)
* **Full Presence (Toàn phần):** Thú cưng ngồi góc màn hình, thở êm ái, dõi mắt theo chuột, đón nhận vuốt ve.
* **Minimal Presence (Tối giản):** Thú cưng ngủ cuộn tròn gọn gàng ở góc nhỏ, không cử động mạnh.
* **Hidden Mode (Tàng hình):** Ẩn hoàn toàn giao diện khi người dùng cần tập trung cao độ.

### 9.3 Sáu Chế Độ Tập Trung (Focus Operating Modes)
* **Work Mode:** Lọc bỏ thông báo giải trí; thú cưng giữ vẻ nghiêm túc, chăm chỉ.
* **Deep Focus Mode:** Tắt toàn bộ âm thanh và hoạt họa giật mình; chỉ thông báo khẩn cấp mới được hiện.
* **Meeting Mode:** Thú cưng chuyển sang `sleeping`, tắt tiếng chuông và hiệu ứng.
* **Gaming Mode:** Tự động phát hiện ứng dụng toàn màn hình, hạ mức sử dụng CPU của WebGL xuống 0%.
* **Relax Mode:** Bật toàn bộ tương tác xúc giác, âm thanh vui tươi, chào đón cưng nựng.
* **Sleep Mode (Quiet Hours):** Giữ im lặng tuyệt đối theo khung giờ hẹn trước qua đêm.

### 9.4 Hộp Thư Bắt Kịp (Catch-up Inbox & Digest)
Khi thoát khỏi Focus Mode hoặc Meeting Mode, ứng dụng **tuyệt đối không phát lại dồn dập toàn bộ thông báo đã lỡ**. Thay vào đó:
* Lưu trữ an toàn trong một Hộp thư Inbox duy nhất (`src/core/inbox-store.js`).
* Cung cấp bản tóm tắt **Catch-up Digest** phân loại khoa học: Liên hệ quan trọng, Công việc khẩn cấp, Sự kiện lập trình và Thông báo thường nhật.

---

# 🖐️ 10. TƯƠNG TÁC VẬT LÝ, KÉO THẢ & TRẠNG THÁI BỊ NHẤC BỔNG

### 10.1 Kéo Thả Tự Do (Free Drag & Drop Desktop Positioning)
Người dùng có thể nhấn giữ chuột trái vào Mèo Mochi và di chuyển bé đi khắp mọi vị trí trên màn hình:
* Tự do đặt tại bất kỳ tọa độ `(x, y)` nào trên desktop.
* Tự động lưu tọa độ vào `settings.appearance.customPosition`.
* Cung cấp nút **"↺ Đặt lại vị trí mặc định"** trong Control Center để đưa bé về lại dock góc màn hình.

### 10.2 Trạng Thái Bị Túm Gáy / Nhấc Bổng (`isGrabbed`)
Khi người dùng nhấn giữ chuột và kéo di chuyển, thú cưng lập tức kích hoạt phản ứng sinh động:
* **Mochi Scruff Stretch:** Thân mèo kéo dãn dọc đàn hồi (`scale.y: 1.18, scale.x: 0.9`).
* **Dangling Paws:** Hai chân sau lơ lửng đung đưa tự do theo quán tính chuyển động chuột.
* **Paw Flailing:** Hai chân trước giơ lên quạt nhẹ hốt hoảng tìm chỗ bám.
* **Startled Face & Bell Jingle:** Mắt mở to tròn xoe ngơ ngác, miệng chữ O; chiếc chuông vàng trên cổ rung lắc dữ dội phát ra tiếng kêu leng keng liên hồi.
* **Bong bóng thoại la hét hài hước (Song ngữ):**
  * *Tiếng Việt:* *"Á á buông tui ra!"*, *"Sen nhấc tui đi đâu đấy?! 🙀"*, *"Thả tui ra mauuu! 🐾"*, *"Oái oái lơ lửng rồi!"*.
  * *English:* *"Ahhh put me down!"*, *"Where are you taking me?! 🙀"*, *"Unhand me, human! 🐾"*, *"Whoa I'm floating in mid-air!"*.
* **Tiếp đất êm ái (Landing Bounce):** Khi thả chuột, thú cưng tiếp đất với cú nhún nảy đàn hồi mềm mại (`landing squash bounce`) kèm tiếng thở phào: *"Phù, được tiếp đất rồi! 😌"*.

### 10.3 Tương Tác Xúc Giác & Thao Tác Thẻ
* **Xoa đầu (Head Petting):** Di chuột nhanh trên đỉnh đầu kích hoạt squash má, nheo mắt cười và bắn tim 3D.
* **Né tránh (Evasion):** Khi gặp thông báo khó chịu, thú cưng ngả người lùi sau né tránh chuột ("Tránh xa ra, đừng chạm vào tui!").
* **Đá bay thông báo (Kick Action):** Người dùng bấm *"😒 Đá bay!"* ➔ thú cưng tung cú đá xoay 360 độ đá văng thẻ thông báo khỏi màn hình.

---

# 🎨 11. GIAO DIỆN THẺ (5 THEMES) & ĐA NGÔN NGỮ (i18n)

### 11.1 Năm Bộ Giao Diện Trình Diễn (5 Visual Themes)
1. **Cute Pastel (Mặc định):** Màu kem đào sữa ấm áp, viền 3D mềm mại phong cách Art Toy Pop Mart.
2. **Minimal White:** Trắng tinh khiết, viền mỏng hiện đại, tối giản cho không gian làm việc chuyên nghiệp.
3. **Dark Mode:** Tím than đậm huyền bí, chữ phát sáng dịu mắt, chống mỏi mắt ban đêm cho lập trình viên.
4. **Glassmorphism:** Hiệu ứng kính mờ phủ sương `backdrop-filter: blur(28px)`, viền phản chiếu ánh sáng sang trọng.
5. **Transparent Acrylic:** Nhựa acrylic trong suốt nhẹ tênh, nhìn xuyên qua các cửa sổ làm việc bên dưới.

### 11.2 Hệ Thống Song Ngữ (Dual Language Engine)
* Hỗ trợ đầy đủ **Tiếng Việt 🇻🇳** và **English 🇺🇸**.
* Chuyển đổi tức thì trong Cài đặt của Control Center, cập nhật ngay lập tức giao diện nút bấm thẻ và toàn bộ lời thoại của thú cưng.

---

# 🔌 12. KIẾN TRÚC TÍCH HỢP NHIỀU NGUỒN (INTEGRATION ROUTER)

Hệ thống tích hợp đa kênh theo mô hình **Integration Provider Router**, không phụ thuộc cứng vào bất kỳ nhà cung cấp duy nhất nào:

```
       ┌────────────────────────────────────────────────────────┐
       │             INTEGRATION PROVIDER ROUTER                │
       └──────────────────────────┬─────────────────────────────┘
                                  │
    ┌─────────────────────────────┼────────────────────────────┐
    ▼                             ▼                            ▼
[Composio Provider]      [Native OS Provider]        [Direct API Provider]
(Slack, Jira, Bitbucket)  (macOS / Win Toast)        (Calendar, GitHub, Webhook)
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

### 12.1 Phân Định Tuyệt Đối: Actions vs Triggers
* **Actions:** Các thao tác do người dùng chủ động khởi tạo (ví dụ: bấm nút "Tạo issue", "Approve PR"). Một toolkit có Actions **không đồng nghĩa** là có khả năng nhận thông báo thời gian thực.
* **Triggers:** Các sự kiện do ứng dụng bên ngoài phát ra khi có hoạt động mới (ví dụ: có tin nhắn Slack mới).

### 12.2 Chế Độ Phân Phối Sự Kiện Minh Bạch (Delivery Modes)
* **`realtime_push`:** Sự kiện đẩy từ server đến desktop tức thì qua WebSocket / SSE.
* **`near_realtime_poll`:** Quét định kỳ ngắn (mặc định 2 phút với Jira, Bitbucket, Gmail qua Composio) kèm nhãn minh bạch thời gian trễ cho người dùng. Phản hồi lớn của Composio chỉ trả `data_preview` (bản rút gọn) — client phải xin ít dữ liệu hơn (ít trường / trang nhỏ) thay vì coi bản rút gọn là đầy đủ.
* **`scheduled_sync`:** Đồng bộ theo lịch hẹn trước.
* **`native_os`:** Bắt trực tiếp từ Trung tâm Thông báo hệ điều hành.
* **`manual`:** Chỉ làm mới khi bấm nút Refresh.

### 12.3 Mô Hình Public HTTPS Gateway Bảo Vệ Desktop
Máy chủ nội bộ Desktop chỉ lắng nghe an toàn tại `http://127.0.0.1:3721`. **Tuyệt đối không bao giờ mở cổng localhost ra Internet.**
* **Client desktop chủ động kết nối ra ngoài:** Kết nối bảo mật (Outbound WSS/SSE) tới Gateway công khai để nhận sự kiện.
* **Bảo vệ Secret:** Toàn bộ OAuth client secrets và webhook signing keys chỉ lưu trên Gateway an toàn, không đóng gói trong file cài đặt máy người dùng.

---

# ⚙️ 13. TRUNG TÂM ĐIỀU KHIỂN DESKTOP (CONTROL CENTER — 10 PHÂN HỆ)

Duy trì địa chỉ cục bộ `http://127.0.0.1:3721` và cửa sổ Native Desktop Settings với 10 phân hệ hoàn chỉnh:
1. **Dashboard:** Tổng quan trạng thái thú cưng, Live 3D Stage, hàng đợi thông báo và độ trễ tích hợp.
2. **Pet Characters:** Chọn nhân vật (Mochi, Boba, Cloud, Pip), xem Live 3D Preview, nạp file `.glb`; panel **👥 Người quen** (§5.3: ứng dụng → cuộc chat → quan hệ/cảm xúc/hành vi, Hay nhắn nhất, danh sách người quen, giờ theo quan hệ, bộ nhớ).
3. **Emotion & Personality:** 5 Preset tính cách, độ nhạy cảm xúc, tùy biến quy tắc Keyword & App Rules.
4. **Notifications:** Kiểu cầm thẻ (Billboard, Peeker, Courier), 5 Theme, kích cỡ, thời gian hiển thị.
5. **Attention Management:** Mức ưu tiên, khoảng thời gian giãn cách (cooldown), gom nhóm, bộ lọc tắt tiếng nguồn.
6. **Application Connections:** Quản lý kết nối Composio, Direct API, trạng thái xác thực và độ trễ thực tế.
7. **Appearance & Position:** Tùy chọn Kéo Thả Tự Do, nút đặt lại vị trí mặc định, khoảng cách viền, đa màn hình.
8. **Sounds & Animations:** Âm lượng, tiếng kêu (Meo, Gâu, Chít, Píp), độ nhạy vuốt ve, chế độ Giảm Chuyển Động (Reduced Motion).
9. **Focus & Presence:** Chuyển đổi Full / Minimal / Hidden và 6 chế độ làm việc (Work, Focus, Meeting, Gaming, Relax, Sleep).
10. **Privacy & Settings:** Khởi động cùng hệ thống, chọn ngôn ngữ (VI / EN), bảo mật mã khóa OS Keychain và xóa lịch sử.

---

# 📊 14. TIẾN ĐỘ THỰC HIỆN & BẢNG THEO DÕI CÁC PHASE (PHASE COMPLETION TRACKER)

Phần này theo dõi chính xác và trung thực tiến độ triển khai của toàn bộ dự án từ **Phase 0 đến Phase 14**, phân loại theo các cấp độ ưu tiên **P0 (Cốt lõi MVP)**, **P1 (Trưởng thành sản phẩm)** và **P2 (Nâng cao tùy chọn)**.

Quy ước trạng thái:
* `[x] HOÀN THÀNH (Completed)`: Đã có mã nguồn hoạt động, có unit/integration test xác nhận, không có lỗi chặn.
* `[-] MỘT PHẦN / ĐANG LÀM (In Progress / Partially Completed)`: Đã có khung kiến trúc hoặc chạy được với dữ liệu nội bộ/procedural, đang chờ kiểm thử tài khoản live hoặc hoàn thiện UI mở rộng.
* `[ ] CHƯA THỰC HIỆN (Pending)`: Thuộc kế hoạch giai đoạn tiếp theo, chưa triển khai mã nguồn.

---

### BẢNG TỔNG HỢP TIẾN ĐỘ THEO PHASE

| Phase | Phân loại | Tên giai đoạn | Trạng thái | Module / File phụ trách | Bằng chứng kiểm thử & Ghi chú thực tế |
| :---: | :---: | :--- | :---: | :--- | :--- |
| **Phase 0** | **P0** | **Khảo Sát Hiện Trạng & Kiểm Toán Mã Nguồn** | `[x]` | `docs/reports/*`, `IMPLEMENTATION_STATUS.md` | Hoàn thành kiểm toán toàn bộ module, lập 9 báo cáo kỹ thuật minh bạch |
| **Phase 1** | **P0** | **Nền Tảng Âm Thanh Cốt Lõi (Core Audio)** | `[x]` | `src/renderer/js/sound.js`, `settings-store.js` | Procedural Web Audio 4 nhân vật (meow, woof, squeak, chirp), 8 cảm xúc, cooldown, mute |
| **Phase 2** | **P0** | **Bộ Máy Cảm Xúc Ngữ Cảnh (Contextual Emotion Engine)** | `[x]` | `src/core/mood-reader.js`, `src/core/emotion-engine.js` | 5 tầng phân loại, 5 preset tính cách, đọc emoji + từ khóa VI/EN, bảo vệ ReDoS (41/41 test pass) |
| **Phase 3** | **P0** | **Xưởng Quy Tắc Cảm Xúc Cơ Bản (Basic Rule Studio)** | `[x]` | `src/control/control.js`, `src/core/emotion-engine.js` | Tạo/sửa/xóa quy tắc app, từ khóa, kiểm thử độ nhạy trực tiếp trong Control Center |
| **Phase 4** | **P0** | **Thông Báo Hành Động & Quyền Riêng Tư (Workflows & Privacy)** | `[x]` | `src/core/privacy.js`, `src/integrations/*`, `nc-deeplink.js` | 4 mức Privacy, Jira changelog assigner, Bitbucket PR review & unit test approve (75/75 pass) |
| **Phase 5** | **P0** | **Quản Lý Chú Ý & Hoạt Họa Mượt Mà (Attention & Animation)** | `[x]` | `src/core/attention-engine.js`, `animation-controller.js` | 4 ưu tiên, cooldown 3 tin/10s, Focus modes, blend 0.18s–0.35s, 60 FPS (74.9 FPS đo thực tế) |
| **Phase 6** | **P1** | **Người Quen & Mối Quan Hệ (Familiar Contacts & Relationship Intelligence)** | `[x]` | `chat-filter.js`, `contact-rules.js`, `contact-directory.js`, `integrations/chat-sources.js`, `main/messaging-apps.js`, `attention-engine.js`, `control.js` | 11 quan hệ; quy tắc người / nhóm chat / theo app; Teams Graph (467 chat thật, 05/11/2026) + Slack + danh bạ tự học; Hay nhắn nhất; xếp nhóm nhanh từ thẻ & Hộp thư; giờ theo quan hệ; ưu tiên người > nhóm > quan hệ (106/107 test pass — 1 lỗi Windows có từ trước) |
| **Phase 7** | **P1** | **Rule Studio Nâng Cao & Giả Lập Cảm Xúc (Emotion Simulator)** | `[-]` | `src/control/control.js`, `src/control/index.html` | Đã có bộ test câu thoại và thanh chỉnh độ nhạy; đang hoàn thiện giả lập tương tác 3D trực tiếp |
| **Phase 8** | **P1** | **Trích Xuất Thông Minh & Thao Tác Nhanh (Smart Payloads)** | `[-]` | `src/adapters/ics-parser.js`, `src/core/privacy.js` | Trích xuất link họp an toàn; Jira/Bitbucket deep links; đang chờ module copy OTP an toàn |
| **Phase 9** | **P1** | **Mở Rộng Thư Viện Âm Thanh (Audio Asset Packs)** | `[ ]` | `assets/pets/*/sounds/` | Đang dùng Procedural Web Audio chất lượng cao; chờ nạp gói file âm thanh `.mp3` studio |
| **Phase 10**| **P1** | **Nâng Cấp Digest & Mở Rộng Ứng Dụng (Advanced Digest)** | `[-]` | `src/core/inbox-store.js` | Hộp thư Inbox bền vững qua khởi động lại, gom nhóm cơ bản; đang hoàn thiện phân nhóm 4 mục chi tiết |
| **Phase 11**| **P2** | **YouTube Pet Video Frame (Khung Video Thu Nhỏ)** | `[ ]` | *Đã gỡ bỏ theo yêu cầu người dùng ngày 04/11/2026* | Giữ ở danh mục tùy chọn P2; không triển khai trong MVP để đảm bảo gọn nhẹ |
| **Phase 12**| **P2** | **Bộ Nhớ Cảm Xúc Thông Minh (Smart Emotion Memory)** | `[-]` | `src/core/contact-directory.js`, `contact-rules.js` | Đã có bộ nhớ thích nghi theo người gửi/nhóm (chỉ metadata, xem lại/tắt/xóa được) + gợi ý "Hay nhắn nhất"; chưa có gợi ý quy tắc từ lịch sử sửa cảm xúc |
| **Phase 13**| **P2** | **Hồ Sơ Tính Cách Theo Khung Giờ (Daily Personality Profiles)**| `[ ]` | `src/core/settings-store.js` | Kế hoạch P2: Chuyển đổi tự động hồ sơ Ngày làm việc / Buổi tối thư giãn |
| **Phase 14**| **P2** | **Tùy Biến Nâng Cao & Chủ Đề Theo Mùa (Seasonal Themes)** | `[-]` | `src/renderer/css/style.css`, `src/control/control.css` | Đã có 5 Visual Themes hoàn chỉnh; các phụ kiện trang trí theo mùa sẽ bổ sung ở P2 |

---

### CHI TIẾT CHECKLIST TỪNG PHASE

#### 🔹 P0 — CỐT LÕI SẢN PHẨM (MUST COMPLETE FIRST)

- [x] **Phase 0: Khảo Sát Hiện Trạng & Kiểm Toán Mã Nguồn (Existing Implementation Audit)**
  - [x] Rà soát toàn bộ kiến trúc và các module hiện hữu trong `src/core`, `src/renderer`, `src/adapters`.
  - [x] Lập danh mục phân loại trạng thái: Working, Partially Working, Not Tested, Missing.
  - [x] Xác lập 9 báo cáo nghiệm thu minh bạch tại `docs/reports/`.
  - [x] Loại bỏ triệt để các đề xuất trùng lặp module hoặc viết lại không cần thiết.

- [x] **Phase 1: Nền Tảng Âm Thanh Cốt Lõi (Core Audio Foundation)**
  - [x] Xây dựng bộ tổng hợp âm thanh Web Audio đa âm sắc `SoundKit` trong `src/renderer/js/sound.js`.
  - [x] Cấp âm sắc nhận diện riêng biệt cho cả 4 nhân vật: `meow` (Mochi), `woof` (Boba), `squeak` (Cloud), `chirp` (Pip).
  - [x] Ánh xạ âm thanh đầy đủ cho 8 Canonical Emotions và các hành vi tương tác (`purr`, `pop`, `bell`, `whoosh`, `hmph`).
  - [x] Kiểm soát âm lượng Master, Preview âm thanh, Mute và ngăn ngừa chồng chéo âm thanh (Sound Anti-Spam).

- [x] **Phase 2: Bộ Máy Cảm Xúc Ngữ Cảnh (Contextual Emotion Engine)**
  - [x] Tích hợp `mood-reader.js` phân tích emoji, từ khóa Tiếng Việt (có/không dấu) và Tiếng Anh hoàn toàn cục bộ.
  - [x] Xử lý từ phủ định ("không ổn", "chưa được"), từ khuếch đại ("!!!", CAPSLOCK) và ngưỡng nhạy (low, medium, high).
  - [x] Tích hợp `emotion-engine.js` phân tầng 5 cấp độ và 5 preset tính cách (Sweet, Sarcastic, Grumpy, Calm, Playful).
  - [x] Đạt 41/41 unit tests pass, chống tấn công ReDoS regex.

- [x] **Phase 3: Xưởng Quy Tắc Cảm Xúc Cơ Bản (Basic Emotion Rule Studio)**
  - [x] Giao diện quản lý quy tắc trực quan trong tab *Cảm xúc & Tính cách* của Control Center.
  - [x] Hỗ trợ cấu hình quy tắc theo Ứng dụng nguồn và Từ khóa tùy chọn.
  - [x] Ô thử nghiệm độ nhạy cảm xúc theo thời gian thực (Live Sentiment Tester).
  - [x] Cơ chế giải quyết xung đột: Quy tắc người dùng luôn có quyền ưu tiên cao nhất so với preset mặc định.

- [x] **Phase 4: Thông Báo Hành Động & Quyền Riêng Tư (Actionable Notifications & Privacy)**
  - [x] Tích hợp 4 chế độ Privacy hiển thị (`full_content`, `masked`, `source_only`, `anonymous_source_only`).
  - [x] Kiểm soát bảo mật qua một điểm kiểm duyệt duy nhất `src/core/privacy.js`; không rò rỉ dữ liệu nhạy cảm vào log hay đĩa.
  - [x] Tích hợp Jira: Phân tích đúng changelog để tìm người giao việc thật, không đoán mò từ reporter; deep-link tới issue.
  - [x] Tích hợp Bitbucket: Trích xuất PR chờ review, unit test duyệt PR an toàn qua API chính thức.
  - [x] Thao tác trên thẻ: Mở / Đóng / Đá bay / Approve. *Snooze, Ghim, Tắt nhanh, Sửa nhanh cảm xúc (§7.4) đã làm rồi **gỡ bỏ theo yêu cầu người dùng ngày 04/11/2026** (thấy không cần thiết). Tắt tiếng app vẫn làm được trong Cài đặt → Thông báo; tắt tiếng người gửi qua nhóm 🔕 Bỏ qua; sửa cảm xúc qua Quy tắc tùy chỉnh.*
  - [x] Thái độ quyết định phản ứng (`mood.followAttitude`, mặc định bật theo yêu cầu người dùng 04/11/2026): mọi thông báo được đón bằng cảm xúc của thái độ đã chọn; chỉ quy tắc tùy chỉnh, người quen và `forceEmotion` ghi đè. Độ ưu tiên vẫn tính theo cảm xúc **nội dung** (`contentEmotion`), không theo thái độ.

- [x] **Phase 5: Quản Lý Chú Ý & Hoạt Họa Mượt Mà (Attention & Smooth Animation)**
  - [x] Bộ lọc Attention Gatekeeper: Bỏ trùng trong 30s, Cooldown 3 tin/10s, gom chùm tin nhắn dồn dập.
  - [x] Hỗ trợ 4 cấp độ ưu tiên, 6 Focus Modes và 3 trạng thái Hiện diện (Full, Minimal, Hidden).
  - [x] Central AnimationController 5 tầng, hòa trộn động 0.18s–0.35s, chống nhảy pose, kẹp chặn delta-time khi sleep resume.
  - [x] Đạt 74.9 FPS trung bình trên màn hình tham chiếu, 0 FPS khi nhàn rỗi, CPU < 2%.

---

#### 🔸 P1 — TRƯỞNG THÀNH SẢN PHẨM (PERSONALIZATION & MATURITY)

- [x] **Phase 6: Người Quen & Mối Quan Hệ (Familiar Contacts & Relationship Intelligence)**
  - [x] Phân loại tin nhắn riêng 1-1, nhắc tên (@mention), @all trong `chat-filter.js`; tiêu đề hoạt động ("X @mentioned you", "forwarded a message", "reacted…") được tách đúng người gửi và nhóm.
  - [x] 11 mối quan hệ (§5.3 A); quy tắc cho một người hoặc cả nhóm chat, gắn theo ứng dụng; cảm xúc + hành vi riêng; bật/tắt; sửa; xóa; tìm & sắp xếp danh sách người quen.
  - [x] Bộ chọn ứng dụng → cuộc chat → thành viên (chọn nhiều): app đã cài/đang chạy (icon thật), Teams qua Microsoft Graph, Slack Web API, danh bạ tự học cho app không có API; gộp mục trùng; lọc Chat/Cuộc họp; tìm không dấu; cuộn vô hạn.
  - [x] Gợi ý "Hay nhắn nhất" (chỉ gợi ý) và xếp nhóm nhanh từ thẻ thông báo (chuột phải) và Hộp thư.
  - [x] Giờ theo mối quan hệ, vẫn hiện ngoài giờ, gom digest — tích hợp Attention Engine, Focus Mode, Quiet Hours.
  - [x] Thứ tự §6.3 trong engine: người > nhóm chat > quan hệ > ứng dụng > chung > mặc định; người quen thắng bộ lọc "chỉ tin dành cho tôi".
  - [x] Riêng tư: chỉ lưu tên/metadata, không học khi nội dung bị ẩn, tắt được, "Quên danh sách đã gặp" có xác nhận. Báo cáo: `docs/reports/FAMILIAR_CONTACTS_REPORT.md`.
  - [ ] Dịch tiếng Anh cho panel mới; kiểm thử Slack API với bot token thật.

- [-] **Phase 7: Rule Studio Nâng Cao & Giả Lập Cảm Xúc (Advanced Rules & Simulator)**
  - [x] Bộ thử nghiệm cảm xúc từ chuỗi văn bản mẫu trong Control Center.
  - [ ] Hỗ trợ điều kiện kết hợp logic AND/OR và sao chép quy tắc (Duplicate Rule).
  - [ ] Khung giả lập hiển thị trực tiếp phản ứng hoạt họa 3D và âm thanh tương ứng với payload mẫu.

- [-] **Phase 8: Trích Xuất Thông Minh & Thao Tác Nhanh (Smart Payloads & Quick Actions)**
  - [x] Trích xuất URL phòng họp từ file lịch iCal và sự kiện lịch an toàn.
  - [x] Deep link trực tiếp tới Jira Issue và Bitbucket PR.
  - [ ] Cơ chế trích xuất mã OTP một chạm (One-click Copy) không lưu vào bộ nhớ đệm và chỉ copy khi bấm nút.

- [ ] **Phase 9: Mở Rộng Thư Viện Âm Thanh (Audio Asset Packs)**
  - [x] Bản sắc âm thanh tổng hợp Web Audio riêng cho 4 nhân vật hoạt động mượt mà.
  - [ ] Nạp gói file âm thanh tự nhiên thu âm chuyên biệt (`.mp3`/`.wav`) cho Chó Boba, Thỏ Cloud và Chim cánh cụt Pip.

- [-] **Phase 10: Nâng Cấp Hộp Thư Digest & Mở Rộng Ứng Dụng (Advanced Digest & Apps)**
  - [x] Hộp thư Inbox lưu trữ bền vững qua các lần tắt mở ứng dụng.
  - [ ] Tự động tổng hợp Digest phân nhóm 4 mục: Liên hệ ưu tiên, Việc khẩn cấp, Sự kiện dev, Thông báo nền.

---

#### 🔹 P2 — NÂNG CAO TÙY CHỌN (OPTIONAL ENHANCEMENTS)

- [ ] **Phase 11: Khung Video Thú Cưng YouTube (YouTube Pet Video Frame)**
  - [x] Đã gỡ bỏ khỏi phiên bản v3.4.0 theo yêu cầu người dùng ngày 04/11/2026 để đảm bảo ứng dụng nhẹ nhàng, tập trung.
  - [ ] Lưu trữ mã nguồn dự phòng; chỉ xem xét kích hoạt lại khi có yêu cầu đặc biệt từ người dùng.

- [-] **Phase 12: Bộ Nhớ Cảm Xúc Thông Minh (Smart Emotion Memory)**
  - [x] Bộ nhớ thích nghi theo người gửi / nhóm chat từ metadata (tần suất, mức quan trọng theo nội dung), xem lại "Bé nhận thấy…", tắt và xóa được.
  - [ ] Ghi nhận phản hồi sửa cảm xúc của người dùng cục bộ.
  - [ ] Chủ động đề xuất quy tắc mới khi phát hiện hành vi điều chỉnh lặp lại (luôn hỏi ý kiến người dùng trước khi lưu).

- [ ] **Phase 13: Hồ Sơ Tính Cách Theo Khung Giờ (Daily Personality Profiles)**
  - [ ] Hẹn giờ tự động chuyển trạng thái tính cách theo nhịp sinh học (Work, Relax, Quiet).

- [-] **Phase 14: Tùy Biến Nâng Cao & Chủ Đề Theo Mùa (Advanced Customization & Seasonal)**
  - [x] 5 Theme visual đỉnh cao (Cute Pastel, Minimal White, Dark Mode, Glassmorphism, Acrylic).
  - [x] Tương tác vật lý xúc giác: Vuốt ve xoa đầu, né tránh, đá bay thẻ, kéo thả tự do và nhấc bổng la hét.
  - [ ] Bộ phụ kiện nón len Noel, hoa mai Tết, bí ngô Halloween cho thú cưng theo mùa.

---

### TIÊU CHUẨN NGHIỆM THU PHÁT HÀNH (P0 RELEASE GATE)

Ứng dụng chỉ được phát hành chính thức bản v3.7.0 khi đạt trọn vẹn 10 tiêu chuẩn:
1. **Toàn vẹn tính năng hiện hữu:** Tất cả các chức năng đã xây dựng ở các phiên bản trước được kế thừa trọn vẹn, không gãy đổ.
2. **Bản sắc âm thanh 4 nhân vật:** Tiếng kêu của Mochi, Boba, Cloud, Pip tách bạch, rõ nét, không lỗi âm thanh.
3. **Mèo Mochi hoàn thiện:** Nhân vật pilot hoạt động trơn tru với đầy đủ 8 cảm xúc quy chuẩn.
4. **Bộ máy cảm xúc ngữ cảnh hoạt động chuẩn xác:** Phản ứng đúng với các kịch bản mẫu (rủ cafe, người yêu nhắn, việc mới, build lỗi).
5. **Xưởng quy tắc cơ bản hoạt động:** Người dùng thêm, sửa, xóa quy tắc trực tiếp trên Control Center và có hiệu lực tức thì.
6. **Thao tác Jira & Bitbucket đáng tin cậy:** Mở đúng link issue, phân biệt đúng người giao việc, nút Approve PR an toàn.
7. **Kiểm soát bảo mật & quyền riêng tư nghiêm ngặt:** Chế độ ẩn thông tin hoạt động hoàn hảo, không rò rỉ dữ liệu nhạy cảm vào log.
8. **Quản lý sự chú ý chống spam hiệu quả:** Bỏ trùng, cooldown và gom nhóm hoạt động ổn định khi nhận bão thông báo.
9. **Hoạt họa 3D mượt mà đạt chuẩn 60 FPS:** Không pose pop, không giật cục khi chuyển trạng thái, tự hồi phục sau khi máy tính sleep.
10. **Đo đạc kiểm thử minh bạch:** Toàn bộ test tự động vượt qua (hiện 106/107 — còn 1 test trạng thái Windows listener hỏng từ trước, phải sửa trước khi phát hành), hiệu năng CPU và RAM được kiểm chứng thực tế.

---

# 📊 15. QUY CHUẨN BÁO CÁO NGHIỆM THU (EVIDENCE-BASED REPORTS)

Tất cả các đánh giá kỹ thuật và kết quả đo đạc bắt buộc phải được lập thành văn bản báo cáo chi tiết đặt tại thư mục `docs/reports/` bằng Tiếng Việt:

1. **`FINAL_IMPLEMENTATION_REPORT.md`:** Báo cáo tổng kết toàn diện kiến trúc trước/sau, thay đổi mã nguồn, kết quả kiểm thử, độ trễ và hướng dẫn vận hành.
2. **`IMPLEMENTATION_STATUS.md`:** Bảng trạng thái chi tiết từng tính năng (`Completed`, `Partially Completed`, `Not Implemented`, `Not Tested`, `Unsupported`).
3. **`TEST_RESULTS.md`:** Nhật ký và output thực tế của toàn bộ các lệnh kiểm thử tự động và kiểm thử thật với tài khoản kết nối.
4. **`ANIMATION_QUALITY_REPORT.md`:** Báo cáo đo đạc FPS trung bình, p50/p95 frame time, kiểm tra chuyển trạng thái cross-fade và phục hồi sau sleep.
5. **`AUDIO_IDENTITY_REPORT.md`:** Báo cáo bản sắc âm thanh, kết quả thử nghiệm Web Audio synthesis và cơ chế chống chồng chéo âm thanh.
6. **`CONTEXTUAL_EMOTION_ENGINE_REPORT.md`:** Báo cáo độ chính xác phân loại cảm xúc theo 14 kịch bản và ma trận giải quyết xung đột quy tắc.
7. **`NOTIFICATION_ACTIONS_REPORT.md`:** Báo cáo chi tiết luồng xử lý Jira (người giao vs người tạo), Bitbucket PR Review và quy trình xác thực API Approve.
8. **`PRIVACY_VERIFICATION_REPORT.md`:** Báo cáo kiểm định an toàn chuỗi nhạy cảm (Synthetic Secret Marker test) qua 4 chế độ hiển thị.
9. **`PERFORMANCE_REPORT.md`:** Báo cáo tiêu thụ RAM, CPU khi idle (0 frame) và khi render active trên cả macOS và Windows.
10. **`KNOWN_LIMITATIONS.md`:** Danh sách công khai các giới hạn kỹ thuật chưa khắc phục để người dùng và đội ngũ phát triển nắm rõ.
11. **`FAMILIAR_CONTACTS_REPORT.md`:** Người quen & mối quan hệ — mô hình dữ liệu, thứ tự ưu tiên, nguồn danh sách chat, quyền riêng tư, kiểm thử, giới hạn.

---

> [!TIP]
> **Cam Kết Chất Lượng Tuyệt Đối:**
> * Không bao giờ tuyên bố tính năng đã hoàn thành nếu chưa có kiểm thử thực tế chứng minh.
> * Không gắn nhãn polling là realtime.
> * Không tuyên bố hoạt họa mượt mà nếu chưa chạy thử nghiệm thực tế trong Three.js runtime.
> * Luôn giữ vững 3 giá trị: **Hữu Ích (Useful) — Cá Nhân Hóa (Personal) — Tôn Trọng Người Dùng (Respectful)**.
