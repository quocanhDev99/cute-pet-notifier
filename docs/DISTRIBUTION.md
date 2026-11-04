# 📦 Phát hành & chia sẻ file cài đặt

*Phiên bản 3.4.0 · Cập nhật 04/11/2026*

Tài liệu này dành cho người **build và chia sẻ** app. Người dùng cuối chỉ cần đọc [INSTALL.md](INSTALL.md).

---

## 1. Các file cài đặt

Các file nằm trong thư mục `dist/` của dự án:

| File | Dành cho | Dung lượng | SHA-256 |
|---|---|---|---|
| `Cute Pet Companion-3.4.0-arm64.dmg` | Mac chip Apple (M1/M2/M3/M4) | ~101 MB | `e41f1d6747859eb995895aa92000ba48f3330589f5c41e9864ffcaa16bbd709d` |
| `Cute Pet Companion-3.4.0.dmg` | Mac chip Intel | ~108 MB | `3f11a43a8f44576752e20e5f697c5a3810b0a7ad071be6e3f7c684750318e192` |
| `Cute Pet Companion Setup 3.4.0.exe` | Windows 10/11 64-bit | ~83 MB | `0eb4aee34da8f09ad7b0569ea30b65f763a12c0020e5303a0c1b131423e410af` |

**Người nhận kiểm tra file tải về có đúng không:**
- macOS: `shasum -a 256 "Cute Pet Companion-3.4.0-arm64.dmg"`
- Windows (PowerShell): `Get-FileHash ".\Cute Pet Companion Setup 3.4.0.exe"`

Kết quả phải khớp với cột SHA-256 ở bảng trên.

> Các file `*-3.2.0*` và `*-3.3.0*` trong `dist/` là bản cũ. Đừng chia sẻ chúng.

---

## 2. Build lại file cài đặt

Cần **Node ≥ 22** (`~/.nvm/versions/node/v22.11.0/bin`) và Xcode Command Line Tools (để biên dịch `nc-bridge`).

```bash
npm test                                    # 73/73 phải pass
npm run dist:mac                            # 2 file .dmg đã ký (arm64 + x64)
npx electron-builder --win nsis --x64       # file .exe cho Windows (build được ngay trên máy Mac)
shasum -a 256 dist/*3.4.0*.dmg "dist/Cute Pet Companion Setup 3.4.0.exe"
```

- **Nâng phiên bản:** sửa `"version"` trong `package.json`. Tên file và màn hình *Cài đặt → Phiên bản* tự đổi theo.
- **Chữ ký macOS:**
  - `npm run dist:mac` tự chạy `scripts/sign-mac.sh`, ký app và trợ lý `nc-bridge` bằng chứng chỉ cục bộ trong `build/signing/`.
  - Chứng chỉ chỉ có trên máy build và **không được đưa lên git**. Hãy sao lưu thư mục này. Nếu mất chứng chỉ, bản sau sẽ có chữ ký khác, và người dùng phải cấp lại quyền Trợ năng một lần.
  - Nếu không có thư mục `build/signing/`, app vẫn được build nhưng không ký.
- **Kiểm tra chữ ký:** `codesign --verify --deep --strict "dist/mac-arm64/Cute Pet Companion.app"`

### Kiểm tra trước khi chia sẻ
- [ ] `npm test` đạt 73/73.
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
2. *Tag:* `v3.4.0` · *Title:* `Cute Pet Companion 3.4.0`.
3. Kéo **3 file** ở mục 1 vào ô *Attach binaries*.
4. Phần mô tả: dán mẫu ở mục 4 bên dưới.
5. Bấm **Publish release**, rồi gửi link trang release cho người dùng.

Nếu repo đang **private**, chỉ người được mời vào repo mới tải được. Muốn chia sẻ rộng thì dùng cách 2, hoặc đổi repo sang public.

Nếu đã cài GitHub CLI (`brew install gh` rồi `gh auth login`), có thể đăng bằng lệnh:
```bash
gh release create v3.4.0 "dist/Cute Pet Companion-3.4.0-arm64.dmg" "dist/Cute Pet Companion-3.4.0.dmg" \
  "dist/Cute Pet Companion Setup 3.4.0.exe" --title "Cute Pet Companion 3.4.0" --notes "Hướng dẫn cài đặt: docs/INSTALL.md"
```

### Cách 2: Google Drive / OneDrive (nhóm nhỏ)
1. Tải 3 file lên một thư mục.
2. Bấm **Chia sẻ** → *Bất kỳ ai có đường liên kết* → quyền **Người xem**.
3. Gửi link kèm mẫu hướng dẫn ở mục 4.

---

## 4. Mẫu tin nhắn gửi người nhận

> **Cute Pet Companion 3.4.0** 🐾. Thú cưng 3D thay thông báo của máy tính.
>
> **Tải đúng file:**
> - Mac chip Apple: `…-arm64.dmg`
> - Mac Intel: `….dmg`
> - Windows: `…Setup 3.4.0.exe`
>
> **macOS**
> 1. Mở file `.dmg`, kéo app vào **Applications**.
> 2. Lần đầu mở: **chuột phải vào app → Mở → Mở**. Nếu báo "app bị hỏng", mở Terminal chạy:
>    `xattr -dr com.apple.quarantine "/Applications/Cute Pet Companion.app"`
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
| Cảnh báo lần đầu mở | Có. App ký bằng chứng chỉ tự ký, chưa notarize với Apple | Có (SmartScreen). Chưa ký Authenticode |
| Quyền cần cấp | Trợ năng (một lần). Bản cập nhật sau giữ nguyên quyền | Truy cập thông báo |
| Trạng thái kiểm thử | Đã chạy thật trên macOS 14 (Apple M2) | **Chưa chạy thử trên máy Windows thật** |
| Kết nối Gmail / Jira / Bitbucket | Mỗi người tự dùng khóa Composio của mình | như macOS |

Muốn máy khác mở app **không còn cảnh báo**: cần tài khoản Apple Developer (99 USD/năm) để ký "Developer ID" và notarize, và chứng chỉ ký code cho Windows. Phần này chưa làm.
