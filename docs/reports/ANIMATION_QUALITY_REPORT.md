# ANIMATION_QUALITY_REPORT — Kiểm định độ mượt chuyển động

*Ngày đo: 03/11/2026 · Apple M2 · macOS 14.6.1 · Màn hình 1920×1080 @ 75 Hz · Electron 33.4.11 (Chromium) · three 0.187*
*Nhân vật: Mèo Mochi — **rig procedural** (chưa có `model.glb` production)*

## 1. Kiến trúc đã triển khai (Blueprint §5)
- **Một nguồn điều khiển duy nhất:** `src/renderer/js/pet/animation-controller.js` (logic thuần, test được bằng Node). `PetStage` chỉ đọc pose từ controller và vẽ ra.
- **5 lớp:** Base (`idle`/`sleeping`) → Reaction (8 cảm xúc) → Interaction (`grabbed`) → Action một lần (`pet`, `reject`, `kick`, `wave`, `jolt`, `land`, `pop`) → Face (mắt/miệng/FX). Secondary motion (tai, đuôi, chuông, pompom) được tính theo bounce và tốc độ kéo.
- **Profile chuyển tiếp:** startle/grab 0.18 s · pet 0.20 s · land 0.25 s · default 0.28 s · card 0.30 s · wake/sleep 0.35 s. Easing in-out-cubic. Khi đổi đích giữa chừng, chuyển tiếp mới bắt đầu **từ pose đang blend dở**.
- **Đổi biểu cảm mặt:** kiểu mắt/miệng là giá trị rời rạc, được đổi tại điểm giữa chuyển tiếp, sau một cú chớp mắt (độ mở mắt ≈ 0.08–0.09).
- **Bảo vệ delta-time:** `dt > 250 ms` (suspend/resume, tab bị treo) → `dt = 0`; các frame dài còn lại kẹp ở 50 ms. Sự kiện `powerMonitor.resume` reset đồng hồ render.
- **Ưu tiên:** tương tác do người dùng (kick/reject/pet/land) không bị action của thông báo chen ngang.
- **Reduced Motion:** theo setting hoặc OS (`prefersReducedMotion`), hoặc tự bật ở Deep Focus/Meeting/Gaming/Sleep. Chuyển tiếp ≥ 0.35 s, biên độ dao động ×0.2, bỏ `jolt`/`pop`, CSS tắt nghiêng 3D và rung thẻ.
- **Cách ly lỗi:** lỗi trong một frame được bắt và log (tối đa 1 lần/5 s), vòng render không dừng.
- **Fallback khi thiếu clip (GLB):** clip theo alias → morph target → pose procedural → idle, kèm sự kiện `fallback` để UI biết.

## 2. Ma trận chuyển trạng thái (đo trong runtime, 60 Hz mô phỏng)
Lệnh: chạy `AnimationController` thật, mỗi frame 1/60 s, đo bước nhảy lớn nhất mỗi frame của 12 tham số pose.

| Từ → Đến | Profile | Thời lượng | Số frame tới khi ổn định | Bước lớn nhất / frame ¹ | Tham số | Độ mở mắt lúc đổi mặt |
|---|---|---|---|---|---|---|
| idle → happy | default | 0.28s | 17 | 0.411 rad | armLx | 0.09 |
| happy → idle | default | 0.28s | 17 | 0.411 rad | armLx | 0.09 |
| idle → excited | default | 0.28s | 17 | 0.193 rad | armLx | 0.09 |
| idle → surprised | startle | 0.18s | 28 | 0.252 rad | earLift | — (mắt không đổi) |
| surprised → idle | default | 0.28s | 17 | 0.168 rad | earLift | — (mắt không đổi) |
| idle → thinking | default | 0.28s | 17 | 0.336 rad | armRx | — (mắt không đổi) |
| thinking → happy | default | 0.28s | 17 | 0.352 rad | armLx | 0.09 |
| idle → sleeping | sleep | 0.35s | 21 | 0.078 rad | armLz | 0.08 |
| sleeping → idle | wake | 0.35s | 21 | 0.078 rad | armLz | 0.08 |
| happy → angry | default | 0.28s | 17 | 0.260 rad | armLx | 0.09 |
| angry → sad | default | 0.28s | 17 | 0.195 rad | armRx | — (mắt không đổi) |
| love → surprised | startle | 0.18s | 28 | 0.461 rad | armLz | 0.09 |

¹ Đơn vị là đơn vị của tham số pose: góc tay/đầu tính bằng radian, `earLift`/`squash` không có thứ nguyên.

**Nhận xét:**
- **Thời lượng:** mọi chuyển tiếp nằm trong 0.18–0.35 s. Riêng `surprised` cần thêm frame vì action `jolt` 0.45 s chạy chồng lên.
- **Đổi mặt:** luôn xảy ra khi mắt gần nhắm (≤ 0.09), nên không có "nhảy mắt".
- **Biên độ lớn:** bước lớn nhất **0.41–0.46 rad/frame** ở những cú giơ tay biên độ lớn (idle↔happy giơ hai tay 2.45 rad trong 0.28 s, love→surprised 0.18 s). Pose vẫn liên tục và có easing, nhưng tốc độ đỉnh khá nhanh. Có thể nâng profile `default` lên 0.32–0.35 s nếu cảm giác còn "giật".
- **Test hồi quy:** `test/animation-controller.test.mjs` khẳng định không frame nào vượt 0.45 rad trong chuỗi 7 cảm xúc có đổi đích giữa chừng.

## 3. Hiệu năng runtime (overlay thật)
Đo bằng bộ đếm `PetStage.frameStats()` (khoảng thời gian giữa các frame rAF + thời gian CPU của `update` + `render`), trong khi phát lần lượt 8 cảm xúc với Billboard/Peeker/Courier:

| Chỉ số | Giá trị |
|---|---|
| Số frame mẫu | 2,999 |
| FPS trung bình | **74.9** (khóa theo vsync 75 Hz; mục tiêu 60 FPS ✅) |
| Frame time p50 / p95 | **13.3 ms / 14.3 ms** |
| 1% low | 69.4 FPS |
| CPU mỗi frame (update + render) p50 / p95 | 0.4 ms / 0.9 ms |
| Draw calls / tam giác (lúc có FX) | 55 / 49,242 |
| Lúc rảnh (không có chuyển động) | Vòng render **dừng hẳn** (0 frame) |
| Hidden / Gaming | `pause()` → **0 frame** kể cả khi rê chuột |

**GLB:** chưa có file production nên chưa đo kích thước và thời gian nạp. Code đã sẵn sàng ghi `loadMs`, `bytes`, `triangles` qua sự kiện `model` và `glb-info`.

## 4. Tiêu chí nghiệm thu (Guide §A6)

| Kiểm thử | Trạng thái | Bằng chứng |
|---|---|---|
| Idle loop | ✅ Đạt (procedural) | Thở/chớp mắt bằng hàm sin liên tục, không có điểm nối |
| Emotion transition | ✅ Đạt | Bảng §2, test "no pose pop" |
| Facial morph | ⚠️ Chưa test với GLB | Logic lerp trọng số có trong `updateGltf`. Chưa có model có shape key |
| Interaction | ✅ Đạt | Test grab/land, priority. Bé kết thúc về đúng trạng thái resident |
| Clip interruption | ✅ Đạt (procedural) / ⚠️ GLB chưa test | Controller là nguồn duy nhất. Với GLB, `syncClip` cross-fade theo profile |
| Suspend/resume | ✅ Đạt | Test `dt=3600 s → 0`, có handler `powerMonitor.resume` |
| Reduced Motion | ✅ Đạt | Test + CSS `body.reduced-motion` |
| Missing clip | ✅ Logic có, ⚠️ chưa chạy với GLB | `resolveClip`/`morphWeightsFor` có unit test |
| Runtime performance | ✅ 74.9 FPS avg, p95 14.3 ms | Bảng §3 |
