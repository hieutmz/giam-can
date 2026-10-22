-- Schema cho web Giảm Cân. Chạy toàn bộ file này trong Supabase → SQL Editor.
-- Mọi bảng đều bật Row Level Security: mỗi user chỉ đọc/ghi được dữ liệu của chính mình.

-- Hồ sơ người dùng (1 dòng / user, tự tạo khi đăng ký)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')) default 'male',
  birth_year int,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  bmr_override int,                      -- BMR đo từ InBody (nếu có), ưu tiên hơn công thức
  activity_factor numeric(3, 2) not null default 1.20,
  kcal_target int not null default 1800,
  protein_target int not null default 130,
  deficit_goal int not null default 77000,
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Thông tin theo ngày: bước chân, nước, giấc ngủ, cân nặng, ghi chú
create table if not exists public.day_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  steps int,
  water_ml int,
  sleep_hours numeric(4, 2),
  weight_kg numeric(5, 1),
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- Mỗi món ăn đã ghi. Lưu snapshot dinh dưỡng để sửa DB thực phẩm không làm đổi lịch sử.
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('sang', 'trua', 'xe', 'toi', 'phu')),
  food_ref text,                          -- id trong DB tĩnh (p1-0001) hoặc 'custom:<uuid>'; null nếu nhập nhanh
  name text not null,
  grams numeric(7, 1),                    -- null nếu nhập nhanh theo kcal
  kcal numeric(7, 1) not null,
  protein numeric(6, 1) not null default 0,
  carb numeric(6, 1) not null default 0,
  fat numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date on public.food_logs (user_id, log_date);

-- Mỗi buổi tập đã ghi
create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  activity text not null,                 -- id hoạt động trong lib/exercises.ts
  name text not null,
  minutes numeric(6, 1) not null,
  level text,
  speed_kmh numeric(4, 1),
  incline_pct numeric(4, 1),
  kcal numeric(7, 1) not null,
  created_at timestamptz not null default now()
);
create index if not exists exercise_logs_user_date on public.exercise_logs (user_id, log_date);

-- Thực phẩm do user tự thêm (giá trị trên 100 g)
create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kcal numeric(7, 1) not null,
  protein numeric(6, 1) not null default 0,
  carb numeric(6, 1) not null default 0,
  fat numeric(6, 1) not null default 0,
  created_at timestamptz not null default now()
);

-- Quyền truy cập qua Data API: chỉ user đã đăng nhập (role authenticated).
-- Cần khi tắt "Automatically expose new tables" lúc tạo project; bật thì vẫn chạy bình thường.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.day_logs, public.food_logs, public.exercise_logs, public.custom_foods
  to authenticated;
revoke all on
  public.profiles, public.day_logs, public.food_logs, public.exercise_logs, public.custom_foods
  from anon;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.day_logs enable row level security;
alter table public.food_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.custom_foods enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own day_logs" on public.day_logs;
create policy "own day_logs" on public.day_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own food_logs" on public.food_logs;
create policy "own food_logs" on public.food_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own exercise_logs" on public.exercise_logs;
create policy "own exercise_logs" on public.exercise_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own custom_foods" on public.custom_foods;
create policy "own custom_foods" on public.custom_foods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tự tạo hồ sơ khi có user mới đăng ký
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
