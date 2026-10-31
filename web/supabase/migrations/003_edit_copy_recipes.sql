-- Mục tiêu carb/fat, ấn định thâm hụt theo ngày, món ghép, món yêu thích.
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó). Chạy lại vẫn an toàn.
alter table public.profiles
  add column if not exists carb_target int not null default 186,
  add column if not exists fat_target int not null default 55;

-- Số thâm hụt người dùng tự chốt cho một ngày; khác null thì bộ đếm dùng số này thay cho công thức
alter table public.day_logs
  add column if not exists deficit_override int;

-- Món ghép: nguyên liệu và cách chia khẩu phần. kcal/macro của dòng đã được tính sẵn từ đây.
alter table public.custom_foods
  add column if not exists recipe jsonb;

create table if not exists public.favorite_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_ref text not null,                 -- id trong DB tĩnh (p1-0001) hoặc 'custom:<uuid>'
  created_at timestamptz not null default now(),
  primary key (user_id, food_ref)
);

grant select, insert, update, delete on public.favorite_foods to authenticated;
revoke all on public.favorite_foods from anon;
alter table public.favorite_foods enable row level security;

drop policy if exists "own favorite_foods" on public.favorite_foods;
create policy "own favorite_foods" on public.favorite_foods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
