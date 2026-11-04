# 📦 Phát hành & chia sẻ file cài đặt

*Phiên bản 3.4.2 · Cập nhật 04/11/2026*

Tài liệu này dành cho người **build và chia sẻ** app. Người dùng cuối chỉ cần đọc [INSTALL.md](INSTALL.md).

---

## 1. Các file cài đặt

Các file nằm trong thư mục `dist/` của dự án:

| File | Dành cho | Dung lượng | SHA-256 |
|---|---|---|---|
| `Cute Pet Companion-3.4.2-arm64.dmg` | Mac chip Apple (M1/M2/M3/M4) | ~101 MB | `b6201dfa17b9f0e4737be5ba84ee7fc2a1383bd3bfc08e9e169f567bf2789b7d` |
| `Cute Pet Companion-3.4.2-x64.dmg` | Mac chip Intel | ~108 MB | `14fd1f3467360b16e0d8fca6199d117dba40cb1e2d626b1c4b968a4723ec5190` |
| `Cute Pet Companion Setup 3.4.2.exe` | Windows 10/11 64-bit | ~83 MB | `3f8916cf8491ba679ac7f46c56464f8b6c360c854a0dfc638fc2400017e47b4d` |

**Người nhận kiểm tra file tải về có đúng không:**
- macOS: `shasum -a 256 "Cute Pet Companion-3.4.2-arm64.dmg"`
- Windows (PowerShell): `Get-FileHash ".\Cute Pet Companion Setup 3.4.2.exe"`

Kết quả phải khớp với cột SHA-256 ở bảng trên.

> Các file `*-3.2.0*`, `*-3.3.0*`, `*-3.4.0*` và `*-3.4.1*` trong `dist/` là bản cũ. Đừng chia sẻ chúng. Từ 3.4.1, file cho Mac Intel có đuôi **`-x64`** (trước đây không có đuôi nên người dùng máy chip Apple hay tải nhầm).

---

## 2. Build lại file cài đặt

Cần **Node ≥ 22** (`~/.nvm/versions/node/v22.11.0/bin`) và Xcode Command Line Tools (để biên dịch `nc-bridge`).

```bash
npm test                                    # 75/75 phải pass
npm run dist:mac                            # 2 file .dmg đã ký (arm64 + x64)
npx electron-builder --win nsis --x64       # file .exe cho Windows (build được ngay trên máy Mac)
shasum -a 256 dist/*3.4.2*.dmg "dist/Cute Pet Companion Setup 3.4.2.exe"
```

- **Nâng phiên bản:** sửa `"version"` trong `package.json`. Tên file và màn hình *Cài đặt → Phiên bản* tự đổi theo. Mỗi lần gửi lại file đã thay đổi cho người khác, hãy **nâng phiên bản** (vd 3.4.2 → 3.4.3) để không lẫn với file cũ cùng tên.
- **Chữ ký macOS:**
  - `npm run dist:mac` tự chạy `scripts/sign-mac.sh`, ký app và trợ lý `nc-bridge` bằng chứng chỉ cục bộ trong `build/signing/`.
  - Chứng chỉ chỉ có trên máy build và **không được đưa lên git**. Hãy sao lưu thư mục này. Nếu mất chứng chỉ, bản sau sẽ có chữ ký khác, và người dùng phải cấp lại quyền Trợ năng một lần.
  - Nếu không có thư mục `build/signing/`, app vẫn được build nhưng không ký.
- **Kiểm tra chữ ký:** `codesign --verify --deep --strict "dist/mac-arm64/Cute Pet Companion.app"`

### Kiểm tra trước khi chia sẻ
- [ ] `npm test` đạt 75/75.
- [ ] Đã cài thử file `.dmg` mới trên máy mình và app mở được.
- [ ] Trong bộ cài không có dữ liệu riêng tư. Lệnh dưới đây không in ra gì là đạt:
  ```bash
  npx @electron/asar list "dist/mac-arm64/Cute Pet Companion.app/Contents/Resources/app.asar" | grep -iE "signing|\.pem|\.p12|secrets|settings\.json|inbox\.json|\.env"
  ```
- [ ] Đã cập nhật lại các mã SHA-256 ở mục 1.

Bộ cài **không** chứa khóa Composio, token, email, cài đặt hay Hộp thư của người build. Những thứ đó nằm trong `~/Library/Application Support/Cute Pet Companion/` của từng máy.

---

## 3. Chia sẻ

### Cách 1: GitHub Releases (khuyến nghị)
1. Mở `https://github.com/quocanhDev99/cute-pet-notifier/releases/new`.
2. *Tag:* `v3.4.2` · *Title:* `Cute Pet Companion 3.4.2`.
3. Kéo **3 file** ở mục 1 vào ô *Attach binaries*.
4. Phần mô tả: dán mẫu ở mục 4 bên dưới.
5. Bấm **Publish release**, rồi gửi link trang release cho người dùng.

Nếu repo đang **private**, chỉ người được mời vào repo mới tải được. Muốn chia sẻ rộng thì dùng cách 2, hoặc đổi repo sang public.

Nếu đã cài GitHub CLI (`brew install gh` rồi `gh auth login`), có thể đăng bằng lệnh:
```bash
gh release create v3.4.2 "dist/Cute Pet Companion-3.4.2-arm64.dmg" "dist/Cute Pet Companion-3.4.2-x64.dmg" \
  "dist/Cute Pet Companion Setup 3.4.2.exe" --title "Cute Pet Companion 3.4.2" --notes "Hướng dẫn cài đặt: docs/INSTALL.md"
```

### Cách 2: Google Drive / OneDrive (nhóm nhỏ)
1. Tải 3 file lên một thư mục.
2. Bấm **Chia sẻ** → *Bất kỳ ai có đường liên kết* → quyền **Người xem**.
3. Gửi link kèm mẫu hướng dẫn ở mục 4.

---

## 4. Mẫu tin nhắn gửi người nhận

> **Cute Pet Companion 3.4.2** 🐾. Thú cưng 3D thay thông báo của máy tính.
>
> **Tải đúng file:**
> - Mac chip Apple (M1/M2/M3/M4): `…-arm64.dmg`. **Đừng** dùng file `-x64` trên máy này: bé sẽ chạy chậm, giật
> - Mac Intel: `…-x64.dmg`
> - Windows: `…Setup 3.4.2.exe`
> - Không rõ chip gì: menu  → *Giới thiệu về máy Mac này* → dòng *Chip*
>
> **macOS**
> 1. Mở file `.dmg`, kéo app vào **Applications**.
> 2. Lần đầu mở, macOS báo *"Apple could not verify…"*. Bấm **Done** (đừng bấm *Move to Trash*), rồi làm **một** trong hai cách:
>    - **Cài đặt hệ thống → Quyền riêng tư & Bảo mật** → kéo xuống → **Open Anyway / Vẫn mở** → nhập mật khẩu → mở lại app.
>    - Hoặc mở Terminal chạy: `xattr -dr com.apple.quarantine "/Applications/Cute Pet Companion.app"`
> 3. Trong app: **🔌 Kết nối → Mở Cài đặt** → bật **Cute Pet Companion** trong *Trợ năng*.
>
> **Windows** *(bản thử nghiệm)*
> 1. Chạy file `.exe`.
> 2. Nếu thấy màn hình xanh SmartScreen: bấm **More info → Run anyway**.
>
> Hướng dẫn đầy đủ: `docs/INSTALL.md`.

---

## 5. Người nhận cần biết
| | macOS | Windows |
|---|---|---|
| Cảnh báo lần đầu mở | Có: *"Apple could not verify…"*. Mở qua **Quyền riêng tư & Bảo mật → Open Anyway** hoặc lệnh `xattr`. Từ macOS 15 không còn mở được bằng chuột phải | Có (SmartScreen). Chưa ký Authenticode |
| Quyền cần cấp | Trợ năng (một lần). Bản cập nhật sau giữ nguyên quyền | Truy cập thông báo |
| Trạng thái kiểm thử | Đã chạy thật trên macOS 14 (Apple M2) | **Chưa chạy thử trên máy Windows thật** |
| Kết nối Gmail / Jira / Bitbucket | Mỗi người tự dùng khóa Composio của mình | như macOS |

Muốn máy khác mở app **không còn cảnh báo**: cần tài khoản Apple Developer (99 USD/năm) để ký "Developer ID" và notarize, và chứng chỉ ký code cho Windows. Phần này chưa làm.

### Bỏ hẳn cảnh báo "Apple could not verify…"
Cần **Apple Developer Program** (99 USD/năm):
1. Tạo chứng chỉ **Developer ID Application** và ký app với *hardened runtime* + entitlements của Electron.
2. Gửi file `.dmg` lên Apple notarize (`xcrun notarytool submit … --wait`).
3. Chạy `xcrun stapler staple` để gắn vé notarize vào DMG.

Lưu ý: khi đổi sang chứng chỉ Developer ID, chữ ký của app thay đổi, nên người dùng cũ phải cấp lại quyền Trợ năng **một lần**.
