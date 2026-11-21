# UI/UX JSON v2.0 — Audit & ánh xạ triển khai (v3.8.0)

*21/11/2026 · Đối chiếu từng mục của `uiux_spec.json` với code. Nguồn chuẩn khi mâu thuẫn: `docs/BLUEPRINT.md` V4.1.*

## 1. Design tokens (`design_tokens.json`)

| Token | Triển khai |
|---|---|
| colors (brandPrimary `#8B5CF6`, brandSecondary `#60A5FA`, text, border, success/warning/danger) | Theme **Oải hương** (`[data-theme="lavender"]` trong `src/control/control.css`, lớp "V5"). Là theme mặc định cho **bản cài mới** (`appearance.uiTheme = 'lavender'`); người dùng cũ giữ màu đang chọn. 5 theme còn lại vẫn có, dùng chung mọi token khác. |
| surfaceGlass `rgba(255,255,255,.76)` + glassBlur 18 | `--glass`, `.panel` / `.v5-card`: `backdrop-filter: blur(18px)` cho mọi theme (Đêm dùng kính tối). |
| radius sm/md/lg/xl/pill | `--r-sm 10 · --r-md 16 · --r-lg 22 · --r-xl 28 · --r-pill`. |
| spacing xs…3xl | `--sp-xs … --sp-3xl`. |
| typography (system-ui/Inter; h1 28/750; h2 20/700; body 14/500; caption 12/500) | `--font`, `.page-head h1`, `.home-head h1`, `body`. |
| motion fast/normal/slow 140/220/360 | `--dur-fast/normal/slow`; `prefers-reduced-motion` tắt mọi animation. |
| layout: windowMin 1080×720, sidebar 244, contentPadding 24, compactNotificationWidth 340 | `BrowserWindow minWidth/minHeight` (`src/main/index.js`), `.sidebar { width: 244px }`, `main` padding, `--card-w: 340px` trên overlay. |

## 2. Navigation (`navigation.json`)

| Mục | Route | Ghi chú |
|---|---|---|
| Trang chủ · Thú cưng · Thông báo · **Chế độ** · Hộp thư · Kết nối · Cài đặt | `#home` `#pet` `#notify` `#modes` `#inbox` `#connect` `#settings` | **Chế độ** là route mới. Link cũ `#notify/focus`, `#focus` tự chuyển sang `#modes`. Tab "Theo dõi" (nâng cao) giữ nguyên. |
| Footer: runtimeStatus · activePet · currentMode · doNotDisturb | Đã có sẵn trong sidebar | Không đổi hành vi. |

## 3. Screens (`screen_specs.json`)

| Màn hình | Đã làm | Chưa làm / khác spec (lý do) |
|---|---|---|
| **home** (11 khu vực) | Lời chào, đồng hồ (cập nhật mỗi giây), nút sáng/tối, khung bé lớn có nút chuyển bé + cảm xúc + tính cách + Vẫy/Vuốt ve/Đá, 6 chế độ nhanh (bấm là bật/tắt), thanh Pomodoro, chọn chế độ thông báo (2 ô), kiểu gắn (5 chip), hoạt động hôm nay (thông báo · việc cần xem · phút tập trung Pomodoro hôm nay), ứng dụng đã kết nối, cài đặt nhanh (DND, âm thanh, ẩn nội dung, giảm chuyển động), 2 thẻ thông báo gọn mẫu, thẻ gợi ý theo ngữ cảnh, thông báo gần đây. | "Thông báo" là số trong phiên chạy (pipeline chưa lưu thống kê theo ngày). "Tác vụ" = việc Jira/PR chưa đọc trong Hộp thư (app không có danh sách công việc riêng). Phút tập trung chỉ tính Pomodoro/Học tập. |
| **pets** | Bộ sưu tập 4 bé, xem trước có 8 cảm xúc + tương tác, panel "Tùy chỉnh": tính cách, kích thước, độ sinh động, âm thanh, nghe thử; danh sách tính cách đầy đủ (thu gọn); Người quen; đọc cảm xúc. | — |
| **notifications** | Chế độ nguồn (Hệ thống + Thú cưng / Thông báo Cute Pet), 5 kiểu gắn, thẻ, vị trí, xem thử; Tin nhắn; Ưu tiên. Quyền riêng tư nội dung ở Cài đặt → Nội dung thông báo. | Kiểu gắn `deliver` của spec = `courier` (giữ ID cũ). |
| **modes** | Lưới 6 chế độ + panel chi tiết từng chế độ (chính sách thông báo, âm thanh, chuyển động, hành vi bé; cấu hình Pomodoro; nhắc nghỉ + gợi ý; lịch yên tĩnh cho Ngủ); các chế độ khác (Họp, Chơi game, Thư giãn, Bình thường); Bé xuất hiện; Không làm phiền. | Focus/Work/Sleep **không có "duration"** (thời lượng tự tắt) — chưa có trong lõi; ghi là việc sau. |
| **mailbox** | Bộ lọc Tất cả / Tin nhắn / Công việc / Quan trọng / Chưa đọc; thêm **✓ Đã đọc** từng dòng; Mở nguồn; Xóa; Xếp nhóm. | **Lưu trữ (archive)** chưa có — Hộp thư chỉ có trạng thái đọc/chưa đọc. |
| **connections** | Ứng dụng của tôi; tìm kiếm; **chip danh mục** Hệ thống / Email / Lịch / Công việc / Chat / Lập trình; kết nối / gỡ / thiết lập / kiểm tra. | Danh mục lọc theo id ứng dụng đã biết; app lạ chỉ hiện ở "Tất cả". |
| **settings** | **Lưới 8 danh mục** (Giao diện, Nội dung thông báo, Âm thanh, Hoạt ảnh, Chung, Quyền riêng tư, Nâng cao, Giới thiệu) cuộn tới từng phần; Âm thanh (âm lượng chung + 3 kênh, tiếng thật, giọng nói, nghe thử); Hoạt ảnh (độ sinh động, giảm chuyển động, kích thước bé, kích thước thẻ, kiểu thẻ Gọn/Đầy đủ). | Kênh "ambient" chưa có (chưa có âm nền). |

## 4. Components (`component_specs.json`)

| Component | Triển khai |
|---|---|
| **notificationCard.compact** | `compactCardHtml()` trong `src/renderer/js/renderer.js` + CSS `.card.compact`: rộng 340 (Nhỏ 300 / Lớn 380), padding 14, header = icon + tên app + cảm xúc + giờ + 🦶 + ✕, tiêu đề 1 dòng, nội dung 2 dòng, ≤ 2 nút (Mở + Đã đọc / Approve / Nghỉ ngay + Hoãn), bỏ dòng gợi ý, footer chỉ có khi cần. Mặc định `notifications.cardLayout = 'compact'`; `expanded` = thẻ cũ. |
| notificationCard.lifecycle approach → attach → peek → react → rest → release | Như `NOTIFICATION_MODE_REDESIGN_SPEC.md` §1 #4 (dùng hold/clip có sẵn, không thêm controller). |
| dismiss: allowCloseButton | Nút ✕ trên header. **allowSwipe** chưa làm (kéo thẻ dễ nhầm với kéo bé). |
| **petAttachment** cling (mặc định) / peek / resting / deliver | `cling`, `resting` mới (`PRESENTATION_MODES`, `HOLD_POSES`, khung "ló đầu" của PetStage: −0,52 / −0,6). Bé ở **góc trên** của thẻ, **phía sau** thẻ (z-index), nên không bao giờ che chữ/nút — có test e2e. Thẻ rộng hơn bé tự trượt vào trong màn hình, **bé không bị đẩy đi**. Bản cài mới mặc định `cling`. |
| animationPolicy: cooldown, noImmediateRepeat, reducedMotion | Âm thanh: AudioController (cooldown, không lặp liền). Hoạt ảnh lúc rảnh: AnimationController (CP-06). Reduced Motion: có. |
| quickModeTile / petCard / connectedAppChip | `.v5-tile` (icon, nhãn, mô tả, trạng thái bật), `.pet-showcase`, `.v5-chip` (icon, tên, chấm trạng thái). |

## 5. Behavior & accessibility

- Global policies (DND, Focus, Reduced Motion, Mute, Privacy, không trùng âm thanh Mode B): giữ nguyên trong lõi, UI chỉ đọc/ghi settings.
- `hiddenContentNeverStored`: không đổi (privacy projection trước mọi sink).
- `fallbackWithoutPetAnimation`: thẻ luôn hiện kể cả khi pet/GLB lỗi (không đổi).
- Accessibility: `:focus-visible` rõ cho mọi phần tử, nút chỉ có icon có `aria-label` (✕, 🦶, ‹ ›, sáng/tối), `role="switch"`/checkbox thật cho công tắc, `prefers-reduced-motion`. Độ tương phản chữ chính `#242044` trên nền kính trắng ≈ 15:1, chữ phụ `#777493` ≈ 4,6:1 (đạt AA cho chữ thường).

## 6. Kiểm chứng

- `npm test`: unit + e2e overlay thật — thêm kiểm tra **cling/resting × 2 phía × 2 cỡ** (bé ở góc trên của thẻ, mép thẻ cắt qua thân bé, thẻ nằm trên bé), và bé không bị dời khi thẻ rộng hơn ở sát mép màn hình.
- Ảnh chụp Control Center thật (server thật + state giả) cho 7 màn hình; ảnh overlay thẻ gọn với Mochi/Boba.
- **Chưa kiểm trên máy thật**: hiệu ứng kính mờ trên Windows/macOS thật (GPU khác nhau), Control Center ở cửa sổ 1080×720 tối thiểu.


## 7. Đối chiếu `MASTER_UIUX_SPEC_V2.md` (v3.9.0)

| Mục spec | Trạng thái | Ghi chú |
|---|---|---|
| §1 Tokens (kính `rgba(255,255,255,.78)` + blur 18, viền kính, bóng `0 8px 24px -6px rgba(139,92,246,.12)`, nền blob tím/xanh/đào, chữ `#242044/#777493/#9D9AA6`, card 20 px, tile 16 px) | ✅ | Lớp "MASTER" cuối `control.css`. |
| §1.2 / §2.1 Cửa sổ 1120 × 740 (min 1080 × 700), bo 24–28 px | 🟡 | Kích thước ✅. Bo góc cửa sổ do hệ điều hành vẽ (Windows 11 tự bo); app không đổi khung cửa sổ gốc. |
| §2.2 Sidebar: logo chân mèo tím, "Cute Pet / Companion" + `v2.0`, đúng 6 tab, badge Hộp thư tím nhạt, `🟢 Đang chạy` phát sáng | ✅ | Màn **Chế độ** không còn trên sidebar, vẫn mở từ "Chi tiết" ở Trang chủ. Thẻ bé / chế độ / DND ở chân sidebar đã bỏ theo concept (DND còn ở Chế độ và menu khay). |
| §3 Trang chủ 3 khu vực | ✅ | Lời chào, pill ngày giờ có ☀️ (bấm: sáng/tối), khung 3D có **bục tròn**, ‹ ›, tên, "{tính cách} · {cảm xúc} · Đồng hành", 4 chấm; lưới 3×2 (🎯🍅🍵📖💻💤, tên tiếng Anh + chú thích); 2 thẻ chọn nguồn; Hoạt động hôm nay (Thông báo / Tác vụ / Tập trung — số thật, không phải số mẫu 8/5/2h30). |
| §3.3 "Hệ thống + Thú cưng" active | ⏸️ | **Khác spec theo yêu cầu trước của chủ dự án**: Mode 1 tạm tắt, thẻ hiện nhãn "Sắp ra mắt" (`COMPANION_MODE_AVAILABLE`). |
| §4.1 Thú cưng | ✅ | Avatar tròn, khung 3D, panel Thái độ / Kích thước % / Độ sinh động x / Âm thanh. |
| §4.2 Thông báo | ✅ | 3 kiểu (Ôm bảng mặc định cho bản cài mới, Ló đầu, Đưa thư) với ảnh tư thế thật; Bám góc / Tựa cằm chỉ hiện khi đang dùng. 3 công tắc: Hiệu ứng động (= Giảm chuyển động đảo ngược), Âm thanh của bé, Click xuyên. |
| §4.3 Hộp thư | ✅ | 4 bộ lọc con nhộng, dòng có icon app + tiêu đề + tóm tắt + giờ, nút `✓ Đánh dấu đã đọc tất cả`. |
| §4.4 Kết nối | ✅ | Badge `Đã kết nối (N)`, `+ Thêm ứng dụng`, công tắc từng app = **nhận thông báo** (tắt → `attention.mutedApps`, tin vào Hộp thư, không mất), `+ Thêm ứng dụng khác` (viền nét đứt). |
| §4.5 Cài đặt | ✅ | 4 nút theme tròn (✓ trên theme đang dùng; theme cũ Đào hồng/Hoàng hôn chỉ hiện khi đang chọn), Chung (ngôn ngữ, khởi động cùng máy, giảm chuyển động), âm lượng (mặc định 70 % cho bản cài mới). Các mục khác (nội dung thẻ, âm thanh chi tiết, hoạt ảnh, riêng tư, nâng cao) giữ phía dưới. |
| §5.1 Thẻ 340 px, nút chính tím + nút phụ viền mảnh | ✅ | |
| §5.2 Chuỗi 6 bước | ✅ | Minh họa bằng tư thế thật (Thông báo → Hiển thị). |
| CP-13 / CP-14 | ✅ / 🟡 | Xem `00_AUDIT_AND_TASKS.md`. |
