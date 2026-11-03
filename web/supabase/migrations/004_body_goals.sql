-- Mục tiêu nước, ngủ, bước chân; số đo cơ thể (InBody, vòng eo).
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó). Chạy lại vẫn an toàn.
alter table public.profiles
  add column if not exists water_target_ml int not null default 2000,
  add column if not exists sleep_target numeric(3, 1) not null default 7.5,
  add column if not exists steps_target int not null default 6000;

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 1),
  pbf numeric(4, 1),                      -- % mỡ cơ thể
  bfm_kg numeric(5, 1),                   -- khối lượng mỡ
  smm_kg numeric(5, 1),                   -- khối lượng cơ xương
  waist_cm numeric(5, 1),
  visceral_fat int,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

grant select, insert, update, delete on public.body_measurements to authenticated;
revoke all on public.body_measurements from anon;
alter table public.body_measurements enable row level security;

drop policy if exists "own body_measurements" on public.body_measurements;
create policy "own body_measurements" on public.body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
