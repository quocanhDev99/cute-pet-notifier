# 🎨 HƯỚNG DẪN THIẾT KẾ MÔ HÌNH 3D, RIGGING & XUẤT FILE GLB TỪ BLENDER
## Blender 3D Modeling, Rigging, Morph Targets & glTF 2.0 Export Specification
*Tài liệu kỹ thuật sản xuất 3D cho dự án Cute Pet Companion — Phiên bản 3.2.0*

> **Liên kết kỹ thuật quan trọng:**
> * Quy chuẩn kiến trúc tổng thể: [BLUEPRINT.md](file:///Users/anhnguyen/Documents/PROGRAMING/cute-pet-notifier/docs/BLUEPRINT.md)
> * Quy trình chi tiết Three.js Animation Runtime & Real-time Integration: [ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md](file:///Users/anhnguyen/Documents/PROGRAMING/cute-pet-notifier/docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md)

---

# 🌟 1. TỔNG QUAN & NGUYÊN TẮC CỐT LÕI

Cute Pet Companion hỗ trợ nạp mô hình 3D sản xuất thực tế theo chuẩn công nghiệp **glTF 2.0 Binary (`.glb`)**.

### 1.1 Nguyên Tắc "1 Nhân vật / 1 File Mesh Duy nhất"
* **Tuyệt đối không tạo 32 file mesh 3D độc lập cho 8 cảm xúc!**
* Mỗi nhân vật được đóng gói trong **đúng 1 file `model.glb` duy nhất**, tích hợp sẵn:
  1. **Base Mesh & Materials:** Khối đa giác hoàn chỉnh, vật liệu PBR Art Toy matte vinyl.
  2. **Character-Specific Armature (Rig):** Bộ xương phù hợp với giải phẫu riêng của từng loài.
  3. **Shape Keys (Morph Targets):** Điều khiển biểu cảm mắt, miệng, má biến dạng mềm mại.
  4. **Animation Actions (Clips):** Các clip chuyển động cho 8 cảm xúc chuẩn và tương tác xúc giác.

### 1.2 Không Áp Đặt Bộ Xương Cứng Cho Mọi Loài
> [!IMPORTANT]
> Khối giải phẫu của 4 nhân vật hoàn toàn khác nhau:
> * **Mèo Mochi (`cat_mochi`):** Thân tròn lùn, tai cụp sát đầu, đuôi mềm uốn lượn, nơ chuông lủng lẳng.
> * **Chó Boba (`dog_boba`):** Chân ngắn mập, mông to lắc lư, tai to vểnh nhọn, khăn bandana.
> * **Thỏ Cloud (`bunny_cloud`):** Tai dài dựng đứng gập mở, đuôi bông tròn xoe, kẹp mầm cây.
> * **Chim cánh cụt Pip (`penguin_pip`):** Dáng quả lê không đuôi, hai cánh bơi ngắn bẹt, mỏ cứng đóng mở.
> 
> **Quy tắc:** Artist được tự do thiết kế cấu trúc xương phù hợp nhất với hình thể từng con vật. Runtime Three.js sẽ ánh xạ thông qua **Semantic Group Mapping** (`root`, `body`, `head`, `limbs`, `ears`, `tail`, `accessories`), không ép buộc tên bone cố định trong lõi động cơ.

---

# 📁 2. VỊ TRÍ VÀ QUY CÁCH TỔ CHỨC FILE TRONG DỰ ÁN

Các file mô hình 3D hoàn thiện từ Blender được đặt trong thư mục gói nhân vật chuẩn:

```text
assets/
└── pets/
    ├── cat_mochi/
    │   ├── model.glb        <-- 3D Production Model chuẩn của Mèo Mochi
    │   ├── pet.json         <-- Metadata, tỷ lệ scale và semantic bone mapping
    │   └── thumbnail.png    <-- Ảnh đại diện hiển thị trong Control Center
    ├── dog_boba/
    │   ├── model.glb
    │   ├── pet.json
    │   └── thumbnail.png
    ├── bunny_cloud/
    │   ├── model.glb
    │   └── pet.json
    └── penguin_pip/
        ├── model.glb
        └── pet.json
```

* **Ưu tiên nạp mô hình:** Runtime sẽ kiểm tra nếu có file `model.glb` trong thư mục nhân vật thì sẽ nạp và chuyển sang dùng WebGL Skeletal Mesh; nếu chưa có sẽ tự động dùng Procedural Parametric Rig làm fallback an toàn (không bao giờ gây crash ứng dụng).
* **Mô hình do người dùng tùy biến:** Người dùng có thể kéo thả file `.glb` bất kỳ vào tab **Thú cưng** trong Control Center (`http://127.0.0.1:3721`), file sẽ được lưu tại `userData/pets/{id}/model.glb` và tự động ghi đè file mặc định.

---

# 🛠️ 3. TIÊU CHUẨN KỸ THUẬT 3D MESH (LOW-POLY ART TOY SPECS)

Để ứng dụng luôn duy trì **60 FPS** mượt mà trên desktop mà không gây tốn pin hay nóng máy:

| Thông số kỹ thuật | Tiêu chuẩn bắt buộc | Ghi chú & Khuyến nghị |
| :--- | :--- | :--- |
| **Số lượng đa giác (Polycount)** | **5,000 – 18,000 Triangles** | Tối đa không vượt quá 25,000 tris. Khử các mặt khuất bên trong thân. |
| **Topology** | **Quad-dominant, Edge loops sạch** | Đặt 2-3 vòng edge loop quanh các khớp uốn cong (cổ, nách, đùi, gốc tai). |
| **Chiều cao chuẩn (Scale)** | **1.5 – 2.0 Blender Units (meters)** | Tương ứng kích thước khoảng 1.85 units trong Three.js runtime. |
| **Trục hướng (Orientation)** | **Mặt hướng +Z (Front View)** | Trục **+Y** hướng lên trên (Up), trục **+X** hướng sang phải (Right). |
| **Gốc tọa độ (Origin Point)** | **(0, 0, 0) tại đáy chân** | Đặt pivot đáy chân ngay trên mặt sàn `Z = 0` để pet đứng vững trên taskbar. |
| **Modifiers** | **Phải Apply trước khi export** | Apply toàn bộ Mirror, Subdivision Surface, Solidify; chỉ giữ lại Armature modifier. |

---

# 🎨 4. CHẤT LIỆU & VẬT LIỆU PBR (MATTE VINYL TOY FINISH)

Phong cách mỹ thuật chủ đạo là **Blind Box / Vinyl Art Toy** (tương tự đồ chơi sưu tầm Pop Mart, nhân vật hoạt hình Pixar mini):

### 4.1 Thiết lập Shader Principled BSDF
* **Base Color:** Gam màu pastel ấm áp theo nhận diện nhân vật (Ví dụ Mochi: màu kem `#FFF2DF` và cam đào `#FFB48A`).
* **Roughness:** **`0.45 – 0.60`** (tạo bề mặt mịn màng, hơi lì, tán xạ ánh sáng mềm mại kiểu nhựa vinyl cao cấp).
* **Metallic:** **`0.0 – 0.05`** (vật liệu phi kim loại cho thân lông, tai, chân).
* **Subsurface Scattering (Tùy chọn):** `Weight: 0.05 – 0.1` với màu phớt hồng đào nhẹ ở viền tai và má để tạo cảm giác da thịt mềm mại như bánh mochi.
* **Chiếc chuông vàng của Mèo Mochi:**
  * Base Color: Vàng kim `#F5C842`
  * Metallic: **`0.85 – 0.95`**
  * Roughness: **`0.20 – 0.30`** (bóng bẩy, bắt sáng lấp lánh).

### 4.2 Textures & UV Mapping
* Trải UV cân đối, không chồng lấn (non-overlapping UVs).
* Kích thước texture tối ưu: **`1024 x 1024 px`** hoặc tối đa `2048 x 2048 px`.
* Định dạng texture nhúng: PNG hoặc WebP tối ưu dung lượng (file `.glb` xuất xưởng không nên vượt quá 5MB).

---

# 🦴 5. CẤU TRÚC KHUNG XƯƠNG & SEMANTIC BONE MAPPING

Không ép buộc tên xương phải giống hệt nhau, nhưng Artist nên tuân theo quy ước đặt tên chuẩn dưới đây để Semantic Mapper trong code tự động nhận diện:

```text
Root (Gốc tại 0,0,0)
 └── Spine / Body (Thân trên, điều khiển nhịp thở và độ uốn)
      ├── Chest (Lồng ngực)
      │    ├── Arm_L / Shoulder_L -> Paw_L (Tay trái)
      │    ├── Arm_R / Shoulder_R -> Paw_R (Tay phải)
      │    └── Neck -> Head (Đầu)
      │         ├── Ear_L (Tai trái)
      │         ├── Ear_R (Tai phải)
      │         └── Accessory_Bell (Chuông cổ)
      ├── Leg_L -> Foot_L (Chân trái)
      ├── Leg_R -> Foot_R (Chân phải)
      └── Tail_01 -> Tail_02 (Đuôi uốn lượn)
```

### Bảng Ánh Xạ Nhóm Chuyển Động (Semantic Groups):

| Semantic Group | Bộ phận đại diện | Nhiệm vụ hoạt họa trong Runtime Three.js |
| :--- | :--- | :--- |
| **`root`** | Gốc nhân vật | Nhảy nhót, nhấc bổng lơ lửng, dịch chuyển vị trí. |
| **`body` / `spine`** | Thân và ngực | Nhịp thở phập phồng (Breathing), nhún nhảy (Bounce), xoay người. |
| **`head`** | Đầu và cổ | Dõi mắt nhìn theo con trỏ chuột (`lookAtScreenPoint`), nghiêng đầu suy tư. |
| **`limbs_front`** | Hai chân trước / cánh | Ôm giữ bảng thông báo (`hold_card`), vẫy tay chào, quơ quào khi bị nhấc bổng. |
| **`limbs_hind`** | Hai chân sau | Dậm chân khi tức giận (`stomp`), tung cú đá văng thẻ (`kick`), đung đưa theo quán tính. |
| **`ears`** | Đôi tai | Cụp xuống u sầu (`sad`), dựng đứng giật mình (`surprised`), vẫy nhẹ định kỳ. |
| **`tail`** | Đuôi | Vẫy tít mù khi vui (`happy`, `excited`), cụp đuôi u sầu, lắc nhẹ khi nhàn rỗi. |
| **`accessories`** | Nơ, chuông, mũ, khăn | Rung lắc độc lập theo gia tốc chuyển động (Secondary Motion). |

---

# 👀 6. SHAPE KEYS / MORPH TARGETS (BIỂU CẢM KHUÔN MẶT 3D)

Để khuôn mặt nhân vật thể hiện trọn vẹn 8 cảm xúc sinh động mà không bị giật hay méo hình, hãy tạo các Shape Keys trong Blender:

### 6.1 Danh mục Shape Keys Khuyến nghị

| Tên Shape Key trong Blender | Tác dụng biến dạng | Cảm xúc ứng dụng |
| :--- | :--- | :--- |
| **`eye_happy`** | Mắt cong hình vầng trăng khuyết cười tít | `happy`, `love`, khi được xoa đầu vuốt ve. |
| **`eye_blink`** | Nhắm nghiền hai mắt hoàn toàn | Nhịp chớp mắt tự nhiên định kỳ (Blink), `sleeping`. |
| **`eye_wide`** | Mắt mở to tròn xoe 130% | `surprised`, khi bị túm gáy nhấc bổng (`isGrabbed`). |
| **`eye_squint`** | Nheo mắt liếc xéo sắc sảo | `angry`, `side-eye` nghi ngờ, né tránh không cho chạm. |
| **`mouth_smile`** | Miệng mở cười tươi nhẹ nhàng | `happy`, `love`. |
| **`mouth_open`** | Miệng tròn chữ O ngơ ngác | `surprised`, hốt hoảng la hét khi bị nhấc bổng. |
| **`mouth_pout`** | Miệng bĩu môi hờn dỗi phồng to | `angry`, khó chịu khi gặp thông báo phiền hà. |
| **`cheek_puff`** | Đôi má phồng to tròn căng như bánh bao | `angry`, hoặc hiệu ứng đàn hồi squash má khi vuốt ve. |

> [!TIP]
> Runtime Three.js điều khiển các Shape Keys này bằng cơ chế **trọng số mượt (weight lerp)** từ `0.0` đến `1.0`. Nhờ đó, biểu cảm biến đổi uyển chuyển, không bao giờ bị giật khung hình hay nhảy vọt đột ngột.

---

# 🎬 7. DANH MỤC ANIMATION ACTIONS (CLIPS) CHUẨN

Hãy đặt tên Action trong Blender (Dope Sheet / Action Editor) theo danh sách chuẩn sau:

### 7.1 Tám Cảm Xúc Chuẩn (Canonical Emotions)
1. **`happy`:** Nhún nhảy nhẹ, vẫy đuôi tít mù, hai chân trước giơ cao ăn mừng, mắt cười vầng trăng khuyết.
2. **`excited`:** Chồm người tới trước đầy háo hức, mắt lấp lánh sao, hai tay vẫy liên hồi.
3. **`love`:** Má hồng ửng đào, hai tay ôm má nũng nịu, nghiêng đầu êm ái, người rung nhẹ thỏa mãn.
4. **`surprised`:** Giật nảy mình nhấc chân khỏi sàn, tai dựng đứng, mắt mở to cực đại, miệng há chữ O.
5. **`angry`:** Má phồng to, đầu lắc nguầy nguậy phản đối, hai chân dậm bình bịch xuống sàn.
6. **`sad`:** Tai cụp sâu, đầu gục xuống buồn rũ rượi, thở dài thườn thượt.
7. **`thinking`:** Đầu nghiêng 30 độ, một tay chống cằm, mắt nhìn lên trên suy tư trầm ngâm.
8. **`sleeping`:** Nằm cuộn tròn bình yên, nhịp thở sâu và chậm rãi, mắt nhắm nghiền thư thái.

### 7.2 Tương Tác Xúc Giác & Thao Tác Thẻ Thông Báo
9. **`idle` (Loop nền bắt buộc):** Đứng thở nhẹ nhàng tự nhiên, chớp mắt ngẫu nhiên, đuôi lắc khẽ.
10. **`hold_card`:** Hai tay vươn sang một bên ôm ghì mép bảng Acrylic (chế độ Billboard Hugger).
11. **`peeker`:** Gác hai tay và cằm lên viền thẻ thông báo, mắt dõi theo con trỏ chuột.
12. **`courier`:** Chạy lúp xúp vào từ mép màn hình, ngậm phong bì thư và cúi chào trao thư.
13. **`pet`:** Đầu nhún xuống đàn hồi khi tay người dùng xoa đầu, híp mắt sung sướng.
14. **`reject` / `dodge`:** Ngả người lùi sau, ngoảnh mặt đi từ chối và lắc đầu kịch liệt ("Tránh xa ra!").
15. **`kick`:** Tung cú đá võ thuật xoay vòng 360 độ đá văng bảng thông báo phiền phức.
16. **`grabbed`:** Trạng thái bị nắm chuột nhấc bổng (hai chân lơ lửng đung đưa, tay quơ quào, chuông lắc).
17. **`land`:** Tiếp đất nảy đàn hồi (squash & stretch bounce) phục hồi về tư thế đứng bình thường.

---

# 📤 8. THIẾT LẬP XUẤT FILE GLB CHUẨN TỪ BLENDER (EXPORT SETTINGS)

Khi đã hoàn thành mô hình và animation trong Blender:

1. Vào menu **File** ➔ **Export** ➔ **glTF 2.0 (.glb/.gltf)**.
2. Thiết lập chính xác các thông số bên bảng bên phải:

```text
┌────────────────────────────────────────────────────────┐
│ glTF 2.0 Export Settings                               │
├────────────────────────────────────────────────────────┤
│ • Format:            glTF Binary (.glb)                │
│ • Include:           ☑ Selected Objects                │
│                      ☑ Custom Properties               │
│ • Transform:         ☑ +Y Up                           │
│ • Geometry:          ☑ Apply Modifiers                 │
│                      ☑ UVs                             │
│                      ☑ Normals                         │
│                      ☑ Tangents (nếu có normal map)    │
│ • Armature:          ☑ Export Deformation Bones Only   │
│ • Animation:         ☑ Animation                       │
│                      ☑ Shape Keys                      │
│                      ☑ Skinning                        │
│                      Group by NLA Tracks: Tắt (Off)    │
│                      Export Active Action: Bật (On)    │
└────────────────────────────────────────────────────────┘
```

3. Đặt tên file là `model.glb` và lưu vào thư mục tương ứng:
   * Mèo Mochi: `assets/pets/cat_mochi/model.glb`
   * Chó Boba: `assets/pets/dog_boba/model.glb`
   * Thỏ Cloud: `assets/pets/bunny_cloud/model.glb`
   * Cánh cụt Pip: `assets/pets/penguin_pip/model.glb`

---

# 🔍 9. KIỂM THỬ & NGHIỆM THU TRONG RUNTIME THREE.JS

Sau khi xuất file `.glb`, thực hiện kiểm tra chất lượng thực tế ngay trong ứng dụng:

1. **Khởi chạy ứng dụng:** Mở terminal chạy `npm start`.
2. **Kiểm tra trong Control Center:**
   * Mở trình duyệt tại `http://127.0.0.1:3721` ➔ chuyển đến tab **🐱 Thú cưng**.
   * Nhấn nút **Live 3D Preview** để kiểm tra xoay 360 độ mô hình dưới hệ thống đèn Studio ACES Filmic.
   * Nhấp lần lượt vào 8 nút cảm xúc bên dưới khung preview để kiểm tra chuyển đổi animation mượt mà (Cross-fade), xác nhận không có hiện tượng giật khung hình (pose popping) hay méo mặt.
   * Thử dùng chuột kéo thả thú cưng trên Desktop để kiểm tra vật lý nhấc bổng lơ lửng và cú tiếp đất đàn hồi.

> [!NOTE]
> Mọi tiêu chuẩn đo đạc FPS (mục tiêu 60 FPS), thời gian chuyển mượt (blending time 0.18s – 0.35s) và cách ly lỗi khi thiếu clip được quy định đầy đủ tại [ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md](file:///Users/anhnguyen/Documents/PROGRAMING/cute-pet-notifier/docs/ANIMATION_AND_REALTIME_NOTIFICATION_GUIDE.md).
