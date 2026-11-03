-- Nhật ký tập tạ: mỗi dòng là 1 set (bài, số lần, mức tạ).
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó). Chạy lại vẫn an toàn.
create table if not exists public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  lift text not null,                     -- id bài trong lib/lifts.ts, hoặc 'custom:<tên>'
  name text not null,
  reps int not null check (reps > 0),
  weight_kg numeric(5, 1),                -- null: tập với trọng lượng cơ thể
  created_at timestamptz not null default now()
);
create index if not exists strength_sets_user_lift on public.strength_sets (user_id, lift, log_date);

grant select, insert, update, delete on public.strength_sets to authenticated;
revoke all on public.strength_sets from anon;
alter table public.strength_sets enable row level security;

drop policy if exists "own strength_sets" on public.strength_sets;
create policy "own strength_sets" on public.strength_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
