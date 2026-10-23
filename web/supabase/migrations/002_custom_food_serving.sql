-- Cho phép "Thực phẩm của tôi" khai báo theo phần (1 ổ, 1 chén, 1 ly…) thay vì chỉ trên 100 g.
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó).
alter table public.custom_foods
  add column if not exists basis text not null default '100g' check (basis in ('100g', 'serving')),
  add column if not exists serving_name text;
