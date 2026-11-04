# Giảm Cân — web app

Nhật ký ăn uống và luyện tập, tự tính calo nạp / tiêu hao / thâm hụt cho từng người dùng.

- **Frontend:** React 18 + Vite + TypeScript, build ra web tĩnh
- **Backend:** Supabase (đăng nhập email, Postgres, Row Level Security → mỗi user chỉ thấy dữ liệu của mình)
- **Hosting:** Vercel (đang dùng) hoặc Cloudflare Pages, tự deploy khi `git push`
- **AI:** Vercel Function trong `api/` gọi Claude (`claude-opus-5-5`): `estimate-food` ước tính kcal từ câu mô tả và/hoặc ảnh chụp bữa ăn (ảnh được thu nhỏ ở trình duyệt trước khi gửi), `suggest-meal` gợi ý món bù protein còn thiếu, `review-day` viết phần "Tổng kết & đánh giá" cuối ngày. Phần dùng chung (đăng nhập, gọi Claude) ở `api/_shared.ts`
- **PWA:** cài được lên màn hình chính (`public/manifest.webmanifest`, `public/sw.js`); service worker chỉ cache giao diện, không cache dữ liệu

## 1. Tạo Supabase project (1 lần)

1. Vào [supabase.com](https://supabase.com) → **New project** (gói Free). Chọn region **Southeast Asia (Singapore)**.
2. Vào **SQL Editor** → **New query** → dán toàn bộ [supabase/schema.sql](supabase/schema.sql) → **Run**. Project đã chạy `schema.sql` từ trước thì chỉ cần chạy các file mới trong [supabase/migrations/](supabase/migrations/).
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
| `npm run import-du-lieu` | Sinh SQL đưa nhật ký `du_lieu/*.json` vào Supabase (xem mục bên dưới) |
| `npm run build` | Typecheck app + `api/`, build ra `dist/` |

`npm run dev` cũng chạy luôn các function trong `api/`. Muốn thử ghi món bằng AI ở local, thêm `ANTHROPIC_API_KEY=...` vào `.env.local` (không có tiền tố `VITE_` nên không lộ ra trình duyệt).

## 3. Deploy lên Vercel

Project đã nối repo trên Vercel: push lên production branch là tự deploy. Cấu hình: Root Directory **`web`**, preset **Vite**, output **`dist`**. `vercel.json` rewrite mọi đường dẫn (trừ `/api/*`) về `index.html` và cho function chạy tối đa 60 giây.

**Environment variables** (Settings → Environment Variables):

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | có | Dùng cho cả frontend lẫn function (function dùng để kiểm tra token đăng nhập) |
| `ANTHROPIC_API_KEY` | để bật AI | Lấy ở [console.anthropic.com](https://console.anthropic.com) → API Keys. Thiếu thì tab "Mô tả (AI)" báo chưa cấu hình |
| `AI_ALLOWED_EMAILS` | nên đặt | Email được dùng AI, cách nhau bằng dấu phẩy. Bỏ trống thì mọi tài khoản đăng ký được đều gọi được (tốn phí API của bạn) |

Đổi biến môi trường xong phải **Redeploy** thì mới có hiệu lực.

## 3b. Deploy lên Cloudflare Pages (cách cũ, không có AI)

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
| Thâm hụt | Tổng tiêu hao − calo nạp, hoặc số **ấn định** trong Nhật ký nếu có; cộng dồn vào mục tiêu (mặc định 77.000 kcal ≈ 10 kg mỡ) |
| Xu hướng cân | Trung bình trượt hàm mũ khoảng 10 ngày, tính theo số ngày thật giữa 2 lần cân |
| TDEE thực tế | `kcal nạp TB − độ dốc cân (kg/ngày) × 7.700`, trong 28 ngày gần nhất; cần 8 lần cân, 10 ngày ghi đủ món và cách nhau 14 ngày. Chỉ để tham khảo, không ảnh hưởng bộ đếm |
| 1RM ước tính (Tập tạ) | Epley: `kg × (1 + lần / 30)`; tiến độ vẽ theo 1RM tốt nhất mỗi buổi |
| Gợi ý tăng tạ | Double progression: mọi set ở mức tạ nặng nhất đạt số lần tối đa của bài → tăng tạ (bước theo bài) và quay về số lần tối thiểu; chưa đạt → giữ tạ, thêm 1 lần |
| Cảnh báo giảm sức mạnh | 2 buổi gần nhất của một bài đều thấp hơn buổi tốt nhất trong 4 buổi trước đó ≥ 10% |
| Dự báo kế hoạch | Mỡ giảm = thâm hụt cộng dồn trong kỳ / 7.700. Dự kiến = (đã đạt + thâm hụt TB × số ngày còn lại) / 7.700. Cần mỗi ngày = (mục tiêu × 7.700 − đã đạt) / số ngày còn lại; trên 1.000 kcal thì khuyên lùi mốc |
| Gợi ý kcal giai đoạn sau | TDEE thực tế (nếu đủ dữ liệu, không thì TDEE công thức TB 14 ngày ghi gần nhất) − 500, làm tròn 50, không dưới BMR |
| AI tổng kết ngày | App tự tính mọi con số (thâm hụt, bộ đếm, ngày về đích) rồi gửi cho Claude; AI chỉ nhận xét 6 mục và gợi ý cho ngày mai. Bản đánh giá lưu ở bảng `day_reviews` |
| Xét nghiệm gan | ALT, AST, GGT (U/L) ở trang Cơ thể; ngưỡng tham khảo nam ALT/AST 40, GGT 60 (nữ 35 / 35 / 40) chỉ để tô màu. Ghép với lần đo cơ thể gần nhất trong ±14 ngày |
| AI ghi món | Claude tách món, trả khoảng kcal + mức giữa; mức giữa được ghi, sửa kcal thì macro co giãn theo cùng tỉ lệ. Dùng số của "Món của tôi" khi khớp tên. Tập tạ chỉ theo dõi sức mạnh, kcal buổi tập vẫn ghi ở Nhật ký |

Phần tập luyện và bước chân đều đã **trừ năng lượng lúc nghỉ** (vì đã nằm trong BMR) để không tính trùng. Bước chân nên nhập **không gồm** phần đi trên máy chạy bộ.

## Đưa nhật ký `du_lieu/` lên web

```bash
npm run import-du-lieu                        # tất cả các ngày, giữ nguyên món đã nhập trên web
npm run import-du-lieu -- --from 2026-10-20   # chỉ từ ngày này (có thêm --to)
npm run import-du-lieu -- --replace           # xóa dữ liệu web của các ngày đó rồi ghi lại từ JSON
```

Lệnh này sinh `supabase/seed_import_du_lieu.sql` (không commit vì chứa dữ liệu sức khỏe); dán file đó vào SQL Editor rồi **Run**. Chạy lại nhiều lần vẫn an toàn.

- `tham_hut_ghi_nhan` được ghi thành số ấn định của ngày, nên bộ đếm trên web khớp với `index.html`.
- JSON chỉ có kcal theo khoảng, nên mỗi món lấy mức giữa và không có protein/carb/fat.

## Dữ liệu thực phẩm

`src/data/foods/*.json`, giá trị trên 100 g (đồ uống: 100 ml), tổng hợp từ Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng 2007), USDA FoodData Central và nhãn sản phẩm phổ biến. Đây là giá trị tham khảo; món chế biến thay đổi theo công thức. Người dùng có thể thêm **Thực phẩm của tôi** (lưu riêng trong Supabase).
