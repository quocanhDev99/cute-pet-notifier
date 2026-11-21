# 00 — Audit hiện trạng & danh sách task (Character Production)

*Cập nhật: 21/11/2026 · đối chiếu code v3.6.0 · Phase P0 của `01_CHARACTER_PRODUCTION_MASTER_PLAN.md`.*

> **Thứ tự nguồn chuẩn:** `docs/BLUEPRINT.md` (V4.1, đặc biệt §8) → tài liệu này → các spec 01–12 trong thư mục này → `docs/guides/character/BLENDER_GUIDE.md`, `docs/guides/character/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md`. Khi mâu thuẫn, tài liệu đứng trước thắng.
>
> **Vị trí trong roadmap:** đây là **track song song**, không chặn Phase 4a–4c của Blueprint (§8.7, §12). Beta chạy bằng rig procedural; GLB/audio production thay vào khi đạt nghiệm thu mà không đổi semantic contract.

## 1. Hệ thống đang có (đừng tạo bản sao)

Các spec 01–13 nhắc tới "EmotionController", "AudioController", "event router", "asset manager". Trong code, các vai trò đó nằm ở những module dưới đây — **mở rộng các module này**, không tạo module song song.

| Vai trò trong spec | Module thật | Hiện trạng |
|---|---|---|
| Character manager (vòng đời) | `src/renderer/js/pet/pet-stage.js` — `setSpecies()`, `clearCharacter()`, `dispose()` | Đổi nhân vật hủy rig/GLB/FX đúng cách (`disposeObject`), có token chống nạp chồng. |
| AnimationController | `src/renderer/js/pet/animation-controller.js` (5 lớp: Base · Reaction · Interaction · Actions · Face) | Logic thuần, có test Node. Cross-fade từ pose đang blend, ưu tiên action, đổi mặt sau cú chớp mắt. **Chưa có** micro-behaviour (look-around, head tilt, weight shift, slow blink) và chuyển cảnh sleep enter/wakeup. |
| EmotionController | Quyết định cảm xúc: `src/core/emotion-engine.js` (main process). Pose: `emotion-poses.js`. Morph: `semantic-map.js` `DEFAULT_MORPH_MAP` | Không cần controller mới; 8 emotion ID chuẩn đã khóa trong `src/shared/emotion-constants.js`. |
| AudioController | **`src/renderer/js/audio-controller.js`** (từ v3.6.0, CP-05) dùng `SoundKit` làm âm dự phòng; `speak()` trong `renderer.js` (giọng hệ thống, opt-in) | Overlay và Control Center đều phát qua controller này. Có chặn theo chính sách, cooldown, không lặp liền, 3 kênh âm lượng, ưu tiên file `.ogg` của nhân vật. |
| Asset manager | `pet-stage.js` nạp `assets/pets/{id}/pet.json` + `model.glb`; `src/main/server.js` phục vụ `/assets/` và nhập GLB của người dùng (`/api/pets/:id/model`, ≤ 60 MB, kiểm magic glTF 2.0) | Lỗi nạp → quay về rig procedural, phát sự kiện `model`/`fallback`. Đã báo `glb-info` (bone tìm được, clip, morph, số tam giác). Chưa có checksum/version (Blueprint §8.6). |
| Event router | `src/renderer/js/renderer.js` (`showCard`, `onStageEvent`) ← IPC `notification:show` từ pipeline | Âm thanh/animation/cảm xúc được gọi trực tiếp tại chỗ, chưa qua một event contract chung. |
| Renderer | `PetStage` — Three.js `WebGLRenderer` (alpha, antialias, DPR ≤ 2, sRGB, ACES, exposure 1.0), render-on-demand, giới hạn 30 fps khi chỉ giữ tâm trạng, `pause()` khi Hidden/Gaming | **Chưa có** quality profile Low/Balanced/High (spec 02). |
| Mapping rig | `semantic-map.js` + `semanticMap`/`clipAliases`/`morphMap` trong `pet.json` | Đã đúng tinh thần spec 09 ("map tới semantic interface, không ép một bộ xương"). Từ v3.6.0 đã nhận tên clip của spec 03/07 (`idle_breathing`, `emotion_*`, `interaction_*`, `sleep_loop`). |
| Manifest | `assets/pet-manifest.json` (trạng thái từng nhân vật) + `assets/pets/{id}/pet.json` | Spec 12 → **mở rộng hai file này**, không tạo manifest thứ ba. |
| QA tự động | `test/animation-controller.test.mjs`, `test/pet-stage-frame.test.mjs`, `test/overlay.e2e.test.js` (overlay Electron thật) | Chỗ để gắn test nghiệm thu nhân vật. |

## 2. Mâu thuẫn tìm thấy và quyết định

| # | Mâu thuẫn | Quyết định (theo Blueprint là nguồn chuẩn) |
|---|---|---|
| 1 | **Bản sắc nhân vật trong `CHARACTER_SAMPLE_VISUAL_REFERENCE.md` khác nhân vật đang chạy.** Tài liệu tả Mochi "cream-white, không phụ kiện", Boba "tai cụp, đuôi dài", Pip "charcoal-and-cream". Code (`species.js`): Mochi cam pastel có vằn, tai cụp kiểu Scottish Fold, nơ đỏ + chuông vàng; Boba corgi vàng mật ong, tai dựng, đuôi cộc, khăn xanh; Cloud trắng, tai dài chóp hồng đào, mầm cây xanh; Pip xanh slate pastel, bụng trắng, mỏ/chân cam, mũ len vàng. | **Giữ bản sắc hiện tại** (Blueprint §0 "stable character IDs", §8.1 "thống nhất với bản sắc Mochi, Boba, Cloud, Pip"). Đã sửa tài liệu tham chiếu và prompt theo nhân vật thật. Muốn đổi bản sắc thì phải là quyết định riêng, ghi vào nhật ký quyết định của Blueprint. |
| 2 | **Phong cách:** spec 02 + Blueprint §8.1 là *stylized-realism*; `BLENDER_GUIDE.md` §3–4 là *low-poly art toy / matte vinyl*. | Blueprint thắng: stylized-realism, chất liệu mềm tin được, không fur runtime nặng. Đã thêm ghi chú đầu §3–4 của BLENDER_GUIDE. Giới hạn kỹ thuật (tam giác, texture) của BLENDER_GUIDE vẫn dùng. |
| 3 | **"Google TTS"** (spec 08, 13). Thực tế app dùng `speechSynthesis` với giọng của hệ điều hành (Windows SAPI / macOS), chỉ đọc câu cố định (nhắc nghỉ, nhấc bổng, thả xuống), không đọc nội dung thông báo. | Đã sửa câu chữ. Theo Blueprint §8.5 giọng nói là opt-in: **từ v3.6.0 mặc định tắt cho bản cài mới** (`sounds.voice = false`); người dùng cũ giữ lựa chọn đã lưu. |
| 4 | **Kích thước QA 96/128/192/256 px** không khớp app. Chiều cao bé = 210 px (cỡ Vừa) × `petScale` 0,6–1,6; cỡ Nhỏ 170, Lớn 250; chế độ hiện diện Tối giản 120. Khoảng thật ≈ **72–400 px**. | QA theo 4 mức: **72** (Tối giản × 0,6), **126** (Vừa × 0,6), **210** (mặc định), **400** (Lớn × 1,6). |
| 5 | **Thư mục asset** spec 09 đề xuất `assets/characters/{id}/` gồm cả `.blend`, ảnh tham chiếu, audio master. `assets/**` được đóng gói nguyên vào installer, nên file nguồn sẽ làm phình bản cài. Runtime đang đọc `assets/pets/{id}/`. | Tách 2 nơi (spec 09 đã sửa): **`assets/pets/{id}/`** = chỉ file runtime được đóng gói; **`art/{id}/`** ở gốc repo = file nguồn, không đóng gói (khuyến nghị Git LFS cho `.blend`, `.wav`, ảnh lớn). |
| 6 | **Tên clip** trong spec (`emotion_happy`, `idle_breathing`, `interaction_pet`…) chưa được runtime nhận. | **Đã sửa (v3.6.0)**: thêm vào `DEFAULT_CLIP_ALIASES` + test. Clip chưa có trạng thái runtime: xem CP-06/CP-07. |
| 7 | `pet-manifest.json`: Cloud ghi `species: netherland_dwarf` (giống thỏ tai ngắn) nhưng nhân vật tai dài. Đường dẫn `assets/references/...`, `assets/sprites/...` không tồn tại. | Ghi nhận; sửa khi làm CP-10 (manifest schema). Không ảnh hưởng runtime. |
| 8 | `CHARACTER_VISUAL_AUDIO_MASTER_PROMPT.md` là bản cũ, gần trùng với `13_IMPLEMENTATION_MASTER_PROMPT.md` và thiếu chỉ dẫn cập nhật audit. | Đã bỏ bản cũ; dùng `13_IMPLEMENTATION_MASTER_PROMPT.md` làm master prompt duy nhất. |
| 9 | Spec 08 muốn chặn trùng âm thanh ở Mode B. | **Đã có** từ v3.6.0: `notifications.companionSound` (mặc định tắt) trong pipeline. AudioController (CP-05) phải giữ chính sách này. |

## 3. Danh sách task

Trạng thái: ✅ xong · 🔜 làm tiếp · ⏳ chờ · ⛔ bị chặn (chờ asset từ bên ngoài).
Mã `CP-0x` là việc kỹ thuật làm được ngay, không cần asset; `CP-2x` cần họa sĩ/âm thanh.

| ID | Ưu tiên | Việc | Phụ thuộc | Module | Nghiệm thu | TT |
|---|---|---|---|---|---|---|
| CP-01 | P0 | Audit + đối chiếu tài liệu (file này) | — | docs | Mâu thuẫn có quyết định; spec trỏ đúng module thật | ✅ |
| CP-02 | P0 | Tên clip production → trạng thái runtime | — | `semantic-map.js` | Test `semantic map: production clip names…` | ✅ |
| CP-03 | P0 | Tách asset runtime (`assets/pets`) / nguồn (`art/`) | — | docs, `.gitattributes` khi có file đầu tiên | Installer không chứa `.blend`/`.wav` master | ✅ (quy ước) |
| CP-04 | P0 | Giọng nói TTS opt-in cho bản cài mới | — | `settings-store.js` | Mặc định `sounds.voice=false`; file cũ giữ giá trị | ✅ |
| CP-05 | P0 | ✅ **AudioController**: nâng `SoundKit` thành một controller. Hợp đồng sự kiện `{event, emotion, character, priority, source}`; cổng chính sách (tắt tiếng, Focus, Hidden, giờ yên tĩnh, Mode B); cooldown + không lặp liền một biến thể; kênh master/vocal/interaction/notification/ambient; ưu tiên file `assets/pets/{id}/sounds/*.ogg`, thiếu file thì dùng âm tổng hợp hiện tại; mọi lời gọi trực tiếp trong `renderer.js` đi qua controller | — | `sound.js`, `renderer.js`, `settings-store.js`, Control Center | Test Node cho gate/cooldown/no-repeat/fallback; e2e không lỗi script; người dùng không nghe khác biệt khi chưa có file | ✅ `test/audio-controller.test.mjs`, e2e giải mã cả 25 file trong Chromium |
| CP-06 | P1 | Micro-behaviour lúc rảnh: look-around, slow blink/double blink, head tilt, weight shift. Chọn có trọng số + cooldown + tắt khi Reduced Motion/Focus/Hidden/đang có thẻ | — | `animation-controller.js`, `emotion-poses.js`, alias `idle_look_around`… | Test Node: không chạy khi bị chặn, không lặp liền, không pop pose; rig procedural chạy được ngay | ✅ v3.6.0 — 5 hành vi (lookAround, headTilt, weightShift, slowBlink, doubleBlink); render chỉ chạy khi có hành vi, 30 fps |
| CP-07 | P1 | Chuyển cảnh ngủ: `sleep_enter` → `sleep_loop` → `sleep_wakeup` | CP-06 | `animation-controller.js` | Vào/ra Focus-ngủ không giật | ⏳ |
| CP-08 | P1 | Quality profile Low/Balanced(mặc định)/High: DPR, antialias, bóng, fps khi rảnh — trong một renderer | — | `pet-stage.js`, settings | Đo fps/CPU 3 mức trên máy tham chiếu | ⏳ |
| CP-09 | P1 | Script kiểm GLB cho họa sĩ: bone theo semantic map, clip khớp alias, morph, tam giác, kích thước file/texture, scale/hướng | CP-02 | `scripts/` | Chạy trên GLB mẫu, in báo cáo thiếu gì | ⏳ |
| CP-10 | P1 | Schema JSON cho `pet.json`/`pet-manifest.json` (thêm `assetVersion`, `checksum`, `audio[]`, `licenses[]`, `qa`) + test validate mọi file; sửa dữ liệu sai ở mục 2 #7 | — | `assets/`, `test/` | Test fail khi thiếu license/sai emotion ID; app vẫn chạy khi manifest lỗi | ⏳ |
| CP-12 | P1 | Hoàn thiện hình ảnh procedural theo stylized-realism: lông như nhung (sheen nhuộm theo màu lông, normal map sợi lông vẽ bằng canvas, bỏ clearcoat "nhựa"); mắt có mống mắt theo màu từng bé + con ngươi + highlight | — | `character-builder.js`, `species.js` (`iris`) | Ảnh chụp overlay thật 4 bé ở 126 px và 400 px; e2e vị trí/ôm thẻ vẫn đạt | ✅ v3.6.0 (bước đầu; GLB vẫn là CP-21) |
| CP-13 | P1 | **Look-At Mouse Constraint & Gaze Tracking**: Dõi mắt & nghiêng đầu theo con trỏ chuột mềm mại (damping/lerp) trong phạm vi gần; tự động trở về giữa khi chuột rời xa; tạm dừng khi có thẻ thông báo hoặc đang kéo thả | — | `pet-stage.js`, `animation-controller.js` | Thú cưng có phản xạ "nhìn thấy" người dùng, tăng tương tác sống động tức thì | ✅ v3.9.0 — bán kính 350 px, lerp 0,04/khung 60 fps (độc lập fps), về giữa sau 3 s / khi chuột rời xa; dừng khi kéo bé hoặc có thẻ (trừ "Ló đầu"); test `CP-13 look-at-mouse` |
| CP-14 | P1 | **Studio Rim Lighting & Eye Depth Polish**: Bổ sung đèn viền (rim light) ngược sáng tách khối khỏi nền desktop (sáng/tối); tăng độ tương phản mống mắt (iris cup) và đốm sáng giác mạc (specular catchlight) | — | `pet-stage.js`, `character-builder.js` | Thú cưng nổi bật, sâu mắt và ấm áp, không bị bệt màu trên wallpaper | 🟡 v3.9.0 — đèn viền vàng ấm từ phía sau (`rimStudio`); mống mắt + catchlight đã có từ CP-12 |
| CP-11 | P2 | Benchmark nhân vật (5 phút rảnh, 5 phút tương tác, 20 lần đổi nhân vật, Hidden/Focus, sleep/resume) — gộp với soak test Blueprint 4b | CP-08 | `scripts/` | Báo cáo CPU/RAM/fps; RAM không tăng dần khi đổi nhân vật | ⏳ |
| CP-20 | P1 | Gói brief Mochi cho họa sĩ: turnaround 4 hướng chuẩn, 8 cảm xúc + neutral, bảng màu theo `species.js`, ghi chú vật liệu, quy chuẩn Blender Quad topology | CP-01 | `art/cat_mochi/` | Duyệt silhouette ở 72/126/210/400 px, thoát khỏi cạm bẫy mesh AI thô | 🔜 |
| CP-21 | P1 | Mochi GLB pilot production (Retopology sạch, Armature riêng loài, Wiggle secondary physics tai/đuôi/chuông, 20 animation clips & morph targets chuẩn) | CP-09, CP-20 | `assets/pets/cat_mochi/model.glb` | Spec 11 + Blueprint §8.7; thay thế hoàn toàn khối procedural | 🔜 |
| CP-22 | P1 | Gói âm thanh cho **cả 4 bé** (bản đầu): 25 file từ Freesound, **toàn bộ CC0**, cắt + lọc + cân độ lớn + Opus 64 kb/s; nguồn/tác giả/xử lý ở `art/{id}/audio/SOURCES.json` | CP-05 | `assets/pets/*/sounds/`, `art/*/audio/` | Đủ nhóm 7 cảm xúc + pet + grab mỗi bé (test); không clip (đỉnh ≤ −1 dBFS); **chưa ai nghe duyệt bằng tai** (`humanListened: false`). Nguồn là bản preview 128 kb/s, chưa phải master 48 kHz/24-bit | 🟡 chờ nghe duyệt |
| CP-3x | P2 | Boba → Cloud → Pip theo pipeline Mochi đã chuẩn hóa | CP-21, CP-22 nghiệm thu | — | Như Mochi | ⏳ |

**Đã làm (21/11/2026):** CP-05, CP-06, CP-12 và bản đầu của CP-22.

**Lộ trình & Plan triển khai tiếp theo (Chia 3 Giai đoạn rõ ràng):**
1. **Giai đoạn 1 — Runtime "Thổi hồn sống động" (Làm ngay trong code):**
   - **CP-13 (Look-At Mouse):** Thêm cơ chế dõi mắt và nghiêng đầu nhẹ theo con trỏ chuột để thú cưng "nhận biết" sự hiện diện của người dùng.
   - **CP-14 (Studio Rim Light & Eye Specular):** Thêm đèn viền ngược sáng và specular mắt giúp bé nổi bật lung linh trên màn hình desktop.
   - **CP-07 (Chuyển cảnh ngủ mượt):** `sleep_enter` ➔ `sleep_loop` ➔ `sleep_wakeup` không khựng giật.
   - **CP-08 (Quality Profiles):** Cấu hình Low / Balanced / High tối ưu hiệu năng.
2. **Giai đoạn 2 — Sản xuất Asset 3D Chuẩn Mực (Pilot Mèo Mochi):**
   - **Thoát khỏi bẫy AI Tripo thô:** Chỉ dùng AI làm base concept; bắt buộc qua Blender retopology để có lưới Quad sạch đẹp.
   - **Tạo biểu cảm Morph Targets & Rig lò xo:** Tạo các shape key mi mắt, khuôn miệng; gắn xương thứ cấp (Wiggle bones) cho tai cụp, đuôi và nơ chuông lắc lư tự nhiên theo quán tính.
   - **Nạp Mochi `model.glb` chính thức vào runtime:** Thay thế rig procedural hiện tại.
   - **Duyệt tai gói âm thanh CP-22:** Nghe thực tế 25 file âm thanh CC0, tinh chỉnh volume và cảm xúc.
3. **Giai đoạn 3 — Nhân rộng sang Chó Boba, Thỏ Cloud và Chim cánh cụt Pip:**
   - Triển khai theo đúng pipeline chuẩn của Mochi đã kiểm chứng thành công.

## 4. Bằng chứng nền

- Hiệu năng: `docs/reports/PERFORMANCE_REPORT.md`, `TEST_RESULTS.md` (Windows 11: thẻ vẽ khung đầu 23–33 ms sau listener; tâm trạng rảnh giới hạn 30 fps; Apple M2 bản arm64 ≈ 73 fps khi hoạt họa).
- Chưa có GLB production cho nhân vật nào (`KNOWN_LIMITATIONS` #1).
- Âm thanh: 25 file CC0 trong `assets/pets/*/sounds/` (≈ 170 KB tổng). Quy trình chọn: tìm trên Freesound với bộ lọc CC0 → xác nhận lại CC0 trên trang từng âm → loại theo phổ/tỷ lệ tín hiệu-nhiễu (bỏ file nhiễu nền, nghi giọng người, nghi đã bị méo) → cắt theo đường bao năng lượng, lọc thông dải, fade 6/40 ms → RMS phần có tiếng −18 dBFS cộng bù theo nhóm (purr/sniff nhỏ hơn), đỉnh ≤ −1 dBFS → Opus 64 kb/s.
