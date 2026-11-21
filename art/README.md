# Character source art

`art/` lưu file nguồn và provenance phục vụ sản xuất nhân vật. Các nội dung ở đây không được đóng gói vào installer.

```text
art/
  <pet-id>/audio/SOURCES.json    nguồn, license và thông tin xử lý âm thanh
  <pet-id>/audio/source/         file âm thanh gốc đã thu thập
  _tools/                        script tìm, phân tích và xử lý âm thanh
```

File âm thanh runtime đã xử lý nằm ở `assets/pets/<pet-id>/sounds/`. Mô hình Blender, texture nguồn, turnaround và preview production cũng thuộc `art/<pet-id>/` khi được tạo. Dùng Git LFS cho file nguồn lớn khi cần.

Xem [character asset pipeline](../docs/character-production/09_CHARACTER_ASSET_PIPELINE.md) và [audio design spec](../docs/character-production/08_CHARACTER_AUDIO_DESIGN_SPEC.md).
