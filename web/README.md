# Giảm Cân — web app

Nhật ký ăn uống và luyện tập, tự tính calo nạp / tiêu hao / thâm hụt cho từng người dùng.

- **Frontend:** React 18 + Vite + TypeScript, build ra web tĩnh
- **Backend:** Supabase (đăng nhập email, Postgres, Row Level Security → mỗi user chỉ thấy dữ liệu của mình)
- **Hosting:** Cloudflare Pages (miễn phí, tự deploy khi `git push`)

## 1. Tạo Supabase project (1 lần)

1. Vào [supabase.com](https://supabase.com) → **New project** (gói Free). Chọn region **Southeast Asia (Singapore)**.
2. Vào **SQL Editor** → **New query** → dán toàn bộ [supabase/schema.sql](supabase/schema.sql) → **Run**.
3. Vào **Project Settings → API**, copy **Project URL** và **anon public key**.
4. Vào **Authentication → URL Configuration**:
   - **Site URL:** địa chỉ web sau khi deploy (vd `https://giam-can.pages.dev`); khi chạy local dùng `http://localhost:5173`
   - **Redirect URLs:** thêm cả `http://localhost:5173/**` và `https://giam-can.pages.dev/**`

> anon key được phép nằm ở frontend: dữ liệu được bảo vệ bằng Row Level Security trong `schema.sql`.

## 2. Chạy local

```bash
cd web
cp .env.example .env.local   # rồi điền URL + anon key
npm install
npm run dev                   # http://localhost:5173
```

Lệnh khác:

| Lệnh | Việc |
|---|---|
| `npm test` | Test các công thức tính calo |
| `npm run check-foods` | Kiểm tra DB thực phẩm (id/tên trùng, kcal lệch so với 4P+4C+9F) |
| `npm run build` | Build ra `dist/` |

## 3. Deploy lên Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo `giam-can`.
2. Cấu hình build:
   - Framework preset: **Vite** (hoặc None)
   - Root directory: **`web`**
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
3. **Environment variables** (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, và `NODE_VERSION` = `20`.
4. **Save and Deploy** → nhận địa chỉ `https://<tên>.pages.dev`, rồi cập nhật Site URL / Redirect URLs bên Supabase (bước 1.4).

Từ đó mỗi lần `git push` lên `master`, Cloudflare tự build và deploy lại. File `public/_redirects` giúp các đường dẫn như `/thong-ke` hoạt động khi tải lại trang.

## Cách tính

| Hạng mục | Công thức |
|---|---|
| BMR | Số đo InBody nếu có; không thì Mifflin-St Jeor: `10·kg + 6,25·cm − 5·tuổi + 5` (nam) / `−161` (nữ) |
| Nền sinh hoạt | `BMR × hệ số` (1,2 văn phòng … 1,5 lao động), đã gồm tiêu hóa thức ăn |
| Bước chân | `0,5 kcal × kg × km`, km = bước × (chiều cao × 0,415) |
| Máy chạy / đi bộ / chạy | Phương trình ACSM. Đi bộ (< 8 km/h): `VO2 = 0,1·S + 1,8·S·G`; chạy: `VO2 = 0,2·S + 0,9·S·G` (S m/phút, G độ dốc); `kcal = VO2 × kg × phút × 5 / 1000` |
| Gym, cardio, thể thao | `(MET − 1) × kg × giờ`, MET theo Compendium of Physical Activities |
| Tổng tiêu hao | Nền + bước chân + các buổi tập |
| Thâm hụt | Tổng tiêu hao − calo nạp; cộng dồn vào mục tiêu (mặc định 77.000 kcal ≈ 10 kg mỡ) |

Phần tập luyện và bước chân đều đã **trừ năng lượng lúc nghỉ** (vì đã nằm trong BMR) để không tính trùng. Bước chân nên nhập **không gồm** phần đi trên máy chạy bộ.

## Dữ liệu thực phẩm

`src/data/foods/*.json`, giá trị trên 100 g (đồ uống: 100 ml), tổng hợp từ Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng 2007), USDA FoodData Central và nhãn sản phẩm phổ biến. Đây là giá trị tham khảo; món chế biến thay đổi theo công thức. Người dùng có thể thêm **Thực phẩm của tôi** (lưu riêng trong Supabase).
