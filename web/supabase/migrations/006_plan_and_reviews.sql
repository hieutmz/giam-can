-- Mốc kết thúc kế hoạch + mục tiêu giảm mỡ, ghi chú sức khỏe cho AI; lưu bản tổng kết ngày do AI viết.
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó). Chạy lại vẫn an toàn.
alter table public.profiles
  add column if not exists plan_start date,
  add column if not exists plan_end date,
  add column if not exists fat_loss_target_kg numeric(4, 1),
  add column if not exists health_note text;

create table if not exists public.day_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  review jsonb not null,                  -- nội dung AI trả về + số liệu lúc đánh giá
  created_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

grant select, insert, update, delete on public.day_reviews to authenticated;
revoke all on public.day_reviews from anon;
alter table public.day_reviews enable row level security;

drop policy if exists "own day_reviews" on public.day_reviews;
create policy "own day_reviews" on public.day_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
