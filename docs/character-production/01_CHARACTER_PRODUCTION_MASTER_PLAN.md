# Character Production Master Plan

> **Read first:** `00_AUDIT_AND_TASKS.md` (audit, decisions, task IDs CP-xx). Source-of-truth order: `docs/BLUEPRINT.md` V4.1 §8 → 00 → these specs → BLENDER_GUIDE / ANIMATION guide.
>
> **Roadmap position:** a parallel track. It does not gate the desktop beta (Blueprint §8.7, §12): the beta ships the current procedural rigs; production GLB/audio replace them when they pass acceptance, without changing the semantic contract.

## Objective
Raise Cute Pet Companion's four characters to a consistent premium stylized-realism quality standard, with richer visuals, animation, personality, audio and interaction. Mochi is the pilot and production reference.

## Principles
- Audit before implementation; extend existing controllers and systems.
- Premium Stylized Realism; avoid photorealism and costly runtime fur.
- Small-overlay readability at the sizes the app really renders: 72, 126, 210 (default) and 400 px pet height (see 00 §2 #4).
- Character identity comes from visual design, movement, expressions and audio—not generic TTS.
- Notifications remain non-intrusive; audio is policy-gated.
- Complete Mochi before productionizing Boba, Cloud and Pip.

## Phases & Phased Implementation Plan (Kế hoạch 3 Giai đoạn Triển khai)

### 📌 Giai đoạn 1: Runtime "Thổi Hồn Sống Động" (Quick Wins trong Code — Không cần đợi 3D Artist)
Mục tiêu: Đập tan cảm giác "robot bất động / screensaver vô hồn" ngay trên Three.js runtime hiện có.
1. **Look-At Mouse Constraint (CP-13):**
   - Nội suy chuyển động hướng đầu và ánh mắt hướng về phía con trỏ chuột (`lerp(0.04)`) khi chuột ở cự ly gần (<350px).
   - Tự động quay về hướng chính diện khi chuột ra xa hoặc không cử động trong 3 giây.
   - Ngắt ngay khi có thông báo hiển thị hoặc khi người dùng bắt đầu kéo thả (`isGrabbed`).
2. **Kích hoạt Hành vi Vi mô Ngẫu nhiên (CP-06):**
   - Đan xen tự nhiên 5 micro-behaviours: `lookAround` (đảo mắt), `headTilt` (nghiêng đầu tò mò), `weightShift` (đổi chân trụ), `slowBlink` / `doubleBlink` (chớp mắt chậm/kép).
   - Đảm bảo có cooldown, không lặp lại cùng một hành vi liền kề, tôn trọng cờ Reduced Motion.
3. **Ánh sáng Studio & Chiều sâu Đôi mắt (CP-14):**
   - Thêm đèn viền ngược sáng (**Studio Rim Light**) tách khối nhân vật nổi bật trên mọi hình nền desktop (kể cả wallpaper tối lẫn sáng).
   - Tăng độ sâu giác mạc (specular catchlight) và mống mắt (iris concave) để mắt có "đốm sáng lung linh" thay vì tròng đen lì.
4. **Chuyển cảnh Giấc ngủ Êm ái (CP-07):**
   - Xây dựng state machine chuyển cảnh 3 pha: `sleep_enter` ➔ `sleep_loop` ➔ `sleep_wakeup`, không cắt đột ngột.

### 📌 Giai đoạn 2: Sản Xuất Asset 3D Chuẩn Mực (Pilot Mèo Mochi — Thoát bẫy AI Tripo Thô)
Mục tiêu: Đưa Mèo Mochi trở thành nhân vật mẫu đạt chuẩn đồ họa cao cấp (Stylized Realism).
1. **Quy trình Concept & Base Mesh sạch:**
   - Dùng Midjourney tạo bộ Turnaround 4 hướng chuẩn kỹ thuật (Front, Side, Back, 3/4) với tỷ lệ đầu/thân bất biến theo `species.js`.
   - Tripo3D / Meshy chỉ dùng làm phôi thô (Base Mesh), **tuyệt đối không đưa mesh AI thô vào runtime**.
2. **Blender Retopology & UV Unwrapping:**
   - Đi lại lưới Quad sạch đẹp, tạo Edge Loops chuẩn quanh mắt, khóe miệng, tai và khớp chân để khi chuyển động không bị co dúm.
   - Tạo Texture PBR sạch: Diffuse không bake bóng giả, Normal map sợi lông mịn, Roughness/Sheen map nhung mềm.
3. **Facial Blendshapes & Rig lò xo đàn hồi (Wiggle Secondary Physics):**
   - Tạo Morph Targets cho 8 cảm xúc chuẩn: mi mắt chớp bất đối xứng, miệng cười, má phồng, cau mày.
   - Gắn xương phụ với tính toán vật lý đàn hồi (Spring physics) cho 2 tai cụp, đuôi và chiếc chuông vàng lắc leng keng.
4. **Xuất GLB & Nạp vào Three.js Runtime (CP-21):**
   - Xuất file chuẩn `assets/pets/cat_mochi/model.glb` (<8MB, nén Draco/Meshopt).
   - Kiểm thử nạp thực tế qua `pet-stage.js`, thay thế hoàn toàn khối hình học procedural.
5. **Duyệt tai thực tế Gói Âm thanh CC0 (CP-22):**
   - Nghe kiểm tra 25 file âm thanh CC0, tinh chỉnh volume, triệt tiêu tiếng click/pop.

### 📌 Giai đoạn 3: Nhân Rộng Sang Boba, Cloud và Pip
1. Áp dụng toàn bộ quy chuẩn và toolchain đã hoàn thiện từ Pilot Mochi sang:
   - **Chó Boba (`dog_boba`):** Chú trọng độ nảy mông, vểnh tai tam giác, khăn bandana đung đưa.
   - **Thỏ Cloud (`bunny_cloud`):** Tai dài mềm rũ nhẹ, kẹp mầm cây nhún nhảy.
   - **Chim cánh cụt Pip (`penguin_pip`):** Dáng quả lê lạch bạch, cánh bơi ngắn vẫy nhẹ.
2. Hoàn thiện bộ manifest bản quyền, QA benchmark FPS trên cả macOS và Windows.

## Task record
Each task must include ID, scope, dependencies, priority, files/modules affected, deliverable, verification, acceptance criteria, status and risks.

## Constraints
- Preserve Blueprint V4.1, canonical emotion IDs **and each character's current visual identity** (palette, ears, tail, accessory in `src/renderer/js/pet/species.js`) unless an approved change is recorded in the Blueprint decision log.
- `idle`, `hidden`, `focused` remain presence/runtime states, not emotions.
- Do not duplicate AnimationController, emotion engine, audio (SoundKit → AudioController, CP-05), asset loading, event routing or renderer. The real module for each role is listed in 00 §1.
- Do not expand notification features as part of this track except required integration and regression.
- Make changes incrementally and report blockers before making architecture-changing assumptions.
