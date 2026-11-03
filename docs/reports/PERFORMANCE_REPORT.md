# PERFORMANCE_REPORT — CPU, RAM, FPS và độ trễ

*Ngày đo: 03/11/2026 · Apple M2 (8 lõi) · macOS 14.6.1 · 1920×1080 @ 75 Hz · Electron 33.4.11 · App chạy `npm start` (bản dev, chưa đóng gói)*

## 1. Lúc rảnh (idle)
Đo bằng `top -l 7 -s 10`: bỏ mẫu đầu, lấy trung bình 6 mẫu × 10 s. App chạy **không** bật `--remote-debugging-port`. Lúc đo: thú cưng resident, không có thông báo, chuột ở xa dock, Gateway adapter đang mở SSE.

| Tiến trình | CPU trung bình (% của 1 lõi) | RSS |
|---|---|---|
| Main (Electron) | 0.50 % | ≈ 87 MB |
| GPU | 0.57 % | ≈ 73 MB |
| Renderer (overlay) | 0.75 % | ≈ 42 MB |
| Network / utility | 0.00 % | ≈ 26 MB + 12 MB |
| **Tổng** | **≈ 1.8 % một lõi** (≈ 0.23 % tổng năng lực 8 lõi) | **≈ 240 MB** |

- **Vòng render WebGL lúc rảnh:** đếm qua CDP được **0 frame** trong các cửa sổ 10 s không có chuột (chỉ có các lần "thức dậy" ngắn khoảng 0.3–1.4 s để chớp mắt/vẫy tay, cách nhau 25–45 s).
- **Hidden / Gaming:** `PetStage.pause()` → **0 frame trong 3 s**, kể cả khi có sự kiện chuột.
- **Kết luận:** mục tiêu cũ "Idle CPU < 1 %" **đạt nếu tính theo toàn máy** (0.23 %), **chưa đạt nếu tính theo một lõi** (1.8 %). Phần còn lại là chi phí nền của Chromium/Electron (main + GPU + renderer) chứ không phải từ vòng render. Xem KNOWN_LIMITATIONS.

**Tối ưu đã làm trong lần cập nhật này:** handler `mousemove` cho sự kiện chuột chuyển tiếp từ OS trước đây gọi `requestAnimationFrame` cho **mọi** chuyển động chuột trên toàn màn hình. Giờ nó throttle theo thời gian (33 ms) và chỉ raycast khi chuột ở gần dock.

## 2. Lúc hoạt động
Xem ANIMATION_QUALITY_REPORT §3: **74.9 FPS** trung bình, frame time p50 13.3 ms / p95 14.3 ms, CPU mỗi frame p50 0.4 ms / p95 0.9 ms.

## 3. Độ trễ sự kiện → hiển thị (đo thật, N = 30 mỗi luồng)
- **Thời điểm render:** frame đầu tiên của phần trình diễn đã được vẽ (hai rAF sau khi chèn thẻ). Renderer báo ngược `renderedAt` để tính.
- **Thời điểm nguồn:** `sourceCreatedAt` do bên gửi đặt. Cùng một máy nên cùng đồng hồ.

| Luồng | Delivery mode | Chặng | p50 | p95 | max | n |
|---|---|---|---|---|---|---|
| Webhook nội bộ `POST /notify` | realtime_push (local) | nguồn → render | **22 ms** | **31 ms** | 415 ms ² | 30 |
| | | desktop nhận → render | 21 ms | 27 ms | 408 ms | 30 |
| Gateway (Composio V3 có chữ ký) → SSE → desktop | realtime_push | nguồn → render | **30 ms** | **76 ms** | 176 ms | 30 |
| | | gateway → desktop | 5 ms | 42 ms | 72 ms | 30 |
| | | desktop nhận → render | 21 ms | 27 ms | 27 ms | 30 |

² Một ngoại lệ ở mẫu đầu tiên sau khi khởi động (biên dịch shader / khởi tạo thẻ lần đầu). Ở một lần đo khác, thẻ đầu tiên sau khởi động mất 1.92 s, và ghi nhận "n=1 p50 459 ms" ngay sau khi khởi động lại.

**So với mục tiêu kỹ thuật ban đầu (Guide §B11):**
| Chặng | Mục tiêu p95 | Đo được | Kết luận |
|---|---|---|---|
| Sự kiện cục bộ → render | ≤ 2 s | 31 ms | ✅ |
| Gateway → render | ≤ 5 s | 27 ms (desktop→render) + 42 ms (gateway→desktop) | ✅ — **nhưng gateway chạy trên localhost, chưa đo qua Internet** |
| Nguồn → render qua push | ≤ 10 s | 76 ms (localhost) | ⚠️ Chưa đủ điều kiện kết luận: cần gateway HTTPS công khai + sự kiện thật từ Composio/Slack |

**Lưu ý về chế độ Courier:** thẻ mở ra sau khoảng **1.42 s** hoạt cảnh (chạy vào 0.9 s + trao thư 0.52 s). Phần này không tính vào latency, vì thú cưng đã bắt đầu phản ứng ngay ở frame đầu tiên.

## 4. Cách tái lập
```bash
npm start -- --remote-debugging-port=9333     # hoặc ./node_modules/.bin/electron . --remote-debugging-port=9333
# FPS: window.__cpcDiagnostics.frameStats() trong overlay (qua CDP)
# Latency: GET /api/state → pipeline.latency   (cần header X-Pet-Token)
```
Có thể đo trực tiếp trên Control Center: Dashboard → "Độ trễ đo thực tế", hoặc trang Kết nối ứng dụng (dòng 📈 dưới từng adapter).
