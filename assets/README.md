# Asset map

Giữ nguyên các đường dẫn runtime hiện đang được app và build scripts sử dụng.

```text
assets/
  pet-manifest.json             registry/status của pet
  pets/<pet-id>/                cấu hình và asset runtime theo pet
    pet.json
    model.glb                   tùy chọn
    sounds/                     âm thanh runtime đã tối ưu
  icons/                        icon app và system tray
  concepts/mobile-pets/         concept art tham khảo, không phải asset production
```

File nguồn và provenance nằm ở `../art/`, không nằm trong runtime asset. Không đổi tên `pets/`, `icons/` hoặc `pet-manifest.json` nếu chưa cập nhật runtime, tests, installer và mọi manifest liên quan.
