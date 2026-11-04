-- Kết quả xét nghiệm men gan (ALT, AST, GGT), tối đa 1 dòng mỗi ngày.
-- Chạy 1 lần trong Supabase → SQL Editor (project đã chạy schema.sql trước đó). Chạy lại vẫn an toàn.
create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  alt numeric(6, 1),                      -- U/L
  ast numeric(6, 1),                      -- U/L
  ggt numeric(6, 1),                      -- U/L
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

grant select, insert, update, delete on public.lab_results to authenticated;
revoke all on public.lab_results from anon;
alter table public.lab_results enable row level security;

drop policy if exists "own lab_results" on public.lab_results;
create policy "own lab_results" on public.lab_results
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
