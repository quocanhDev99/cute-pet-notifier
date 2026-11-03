# Tạo lại icon app

Icon được render bằng chính engine 3D của app (Mèo Mochi, biểu cảm `idle`), rồi ghép lên nền pastel bo góc theo lưới icon macOS (khung 824/1024, bo 185 px).

1. Chạy app với cổng debug và mở Control Center:
   `./node_modules/.bin/electron . --remote-debugging-port=9333`, sau đó chạy thêm một lần `./node_modules/.bin/electron .` để mở cửa sổ.
2. Build script: `npx esbuild scripts/make-icon/render-icon.js --bundle --format=iife --outfile=/tmp/render-icon.bundle.js`
3. Inject bundle vào trang `http://127.0.0.1:3721/` qua CDP và gọi
   `window.renderIcon('idle', { camZ: 6.2, lookY: 0.98, scale: 0.9, dy: 8 })`. Hàm trả về PNG 1024×1024 (data URL).
4. Lưu thành `build/icon.png`, rồi tạo các bản còn lại:
   ```bash
   mkdir -p /tmp/AppIcon.iconset
   for s in 16 32 128 256 512; do sips -z $s $s build/icon.png --out /tmp/AppIcon.iconset/icon_${s}x${s}.png; sips -z $((s*2)) $((s*2)) build/icon.png --out /tmp/AppIcon.iconset/icon_${s}x${s}@2x.png; done
   iconutil -c icns /tmp/AppIcon.iconset -o build/icon.icns
   sips -z 256 256 build/icon.png --out assets/icons/icon-256.png
   sips -z 512 512 build/icon.png --out assets/icons/icon-512.png
   sips -z 32 32 build/icon.png --out assets/icons/tray-color.png
   ```
