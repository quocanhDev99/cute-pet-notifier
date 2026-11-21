# Tài liệu Cute Pet Companion

Mục này là bản đồ tài liệu. `BLUEPRINT.md` là nguồn chuẩn về phạm vi sản phẩm và quyết định kiến trúc; báo cáo mô tả trạng thái triển khai tại thời điểm ghi trong từng file.

## Bắt đầu từ đây

- [Blueprint hiện hành](BLUEPRINT.md)
- [Phát triển mobile, ưu tiên iOS](mobile-development/README.md)
- [Character production: audit và danh sách việc](character-production/00_AUDIT_AND_TASKS.md)
- [Tình trạng triển khai](reports/IMPLEMENTATION_STATUS.md)

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `product/notifications/` | Quyết định và đặc tả các chế độ thông báo |
| `design/` | UI/UX spec, UI/UX JSON v2, concept giao diện và gói export; xem [design index](design/README.md) |
| `character-production/` | Quy chuẩn nhân vật, animation, âm thanh, asset pipeline và QA |
| `guides/character/` | Blender, rigging và animation runtime |
| `guides/release/` | Cài đặt, build và phân phối |
| `mobile-development/` | Plan Flutter/iOS, notification concept và pet reference |
| `reports/` | Báo cáo triển khai, kiểm thử, hiệu năng, bảo mật và giới hạn |
| `archive/` | Blueprint phiên bản cũ để tra cứu; không phải đặc tả hiện hành |

## Quy ước đọc

- Đọc `BLUEPRINT.md` trước khi triển khai thay đổi sản phẩm.
- Dùng spec chuyên biệt để biết chi tiết; nếu có mâu thuẫn với blueprint thì blueprint hiện hành thắng.
- `design/concepts/` và `assets/concepts/` là concept/reference, không phải asset runtime.
- `assets/pets/` là asset runtime mà ứng dụng nạp. `art/` chứa file nguồn và provenance, không đóng gói vào bản cài.
- Không lưu bản sao của cùng một ảnh concept trong thư mục tài liệu; liên kết tới nguồn chuẩn dưới `assets/concepts/`.
