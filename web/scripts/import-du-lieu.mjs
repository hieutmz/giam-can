// Sinh file SQL đưa nhật ký du_lieu/*.json vào Supabase. Chạy file SQL trong Supabase → SQL Editor.
//
//   npm run import-du-lieu                        tất cả các ngày, giữ nguyên món đã nhập trên web
//   npm run import-du-lieu -- --from 2026-10-20   chỉ từ ngày này (có thêm --to)
//   npm run import-du-lieu -- --replace           xóa dữ liệu web của các ngày đó rồi ghi lại từ JSON
//   npm run import-du-lieu -- --email ban@vd.com  khi project có nhiều tài khoản
//
// Chạy lại nhiều lần vẫn an toàn. File SQL chứa dữ liệu sức khỏe nên đã nằm trong .gitignore.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, "..", "..", "du_lieu");
const OUTPUT = join(here, "..", "supabase", "seed_import_du_lieu.sql");

const { values: opts } = parseArgs({
  options: {
    from: { type: "string", default: "0000" },
    to: { type: "string", default: "9999" },
    email: { type: "string", default: "" },
    replace: { type: "boolean", default: false },
  },
});

const MEALS = { Sáng: "sang", Trưa: "trua", Xế: "xe", Tối: "toi", Phụ: "phu", "Đồ uống": "phu" };

const sql = (v) => (v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const middle = (x) => Math.round(((x.kcal_min + x.kcal_max) / 2) * 10) / 10;

/** "4,5 km/h, dốc 12–13%" → tốc độ 4,5 và độ dốc giữa khoảng 12,5 */
function parseTreadmill(detail) {
  const m = /([\d,.]+)\s*km\/h.*?dốc\s*([\d,.]+)(?:[–-]([\d,.]+))?\s*%/.exec(detail ?? "");
  if (!m) throw new Error(`Không đọc được tốc độ/độ dốc từ "${detail}"`);
  const num = (s) => Number(s.replace(",", "."));
  return { speed: num(m[1]), incline: m[3] ? (num(m[2]) + num(m[3])) / 2 : num(m[2]) };
}

function exerciseRow(date, ex) {
  const base = { date, minutes: ex.phut, kcal: middle(ex) };
  if (/gym/i.test(ex.ten)) return { ...base, activity: "gym", name: "Tập tạ (gym) (cường độ vừa)", level: "vua", speed: null, incline: null };
  if (/máy chạy/i.test(ex.ten)) {
    const { speed, incline } = parseTreadmill(ex.chi_tiet);
    const label = String(speed).replace(".", ",");
    const slope = String(incline).replace(".", ",");
    return { ...base, activity: "treadmill", name: `Đi bộ / chạy máy chạy bộ (${label} km/h, dốc ${slope}%)`, level: null, speed, incline };
  }
  throw new Error(`${date}: chưa biết ánh xạ bài tập "${ex.ten}" sang lib/exercises.ts`);
}

function foodRows(day) {
  const rows = day.an_uong.map((f) => {
    const meal = MEALS[f.bua];
    if (!meal) throw new Error(`${day.ngay}: giá trị bua không hợp lệ "${f.bua}"`);
    return { meal, name: f.mon, kcal: middle(f) };
  });
  // Ngày chỉ có tổng kcal, không có danh sách món
  if (rows.length === 0 && day.nap) {
    const kcal = (day.nap.min + day.nap.max) / 2;
    rows.push({ meal: "phu", name: `Ăn cả ngày (ấn định ${kcal.toLocaleString("vi-VN")} kcal)`, kcal });
  }
  return rows;
}

function dayBlock(day) {
  const d = day.ngay;
  const out = [`  -- ${d}`];
  const note = day.ghi_chu?.length ? day.ghi_chu.join(" • ") : null;
  const cols = [day.buoc_chan, day.nuoc_ml, day.ngu?.gio ?? null, note, day.tham_hut_ghi_nhan].map(sql).join(", ");
  out.push(`  insert into public.day_logs (user_id, log_date, steps, water_ml, sleep_hours, note, deficit_override)
  values (v_uid, ${sql(d)}, ${cols})
  on conflict (user_id, log_date) do update set
    steps = coalesce(public.day_logs.steps, excluded.steps),
    water_ml = coalesce(public.day_logs.water_ml, excluded.water_ml),
    sleep_hours = coalesce(public.day_logs.sleep_hours, excluded.sleep_hours),
    note = coalesce(public.day_logs.note, excluded.note),
    deficit_override = coalesce(excluded.deficit_override, public.day_logs.deficit_override),
    updated_at = now();`);

  const foods = foodRows(day);
  if (foods.length) {
    const rows = foods.map((f) => `      (v_uid, ${sql(d)}, ${sql(f.meal)}, ${sql(f.name)}, ${f.kcal})`).join(",\n");
    out.push(`  if not exists (select 1 from public.food_logs where user_id = v_uid and log_date = ${sql(d)}) then
    insert into public.food_logs (user_id, log_date, meal, name, kcal) values
${rows};
  end if;`);
  }

  const exercises = day.tap_luyen.map((x) => exerciseRow(d, x));
  if (exercises.length) {
    const rows = exercises
      .map((e) => `      (v_uid, ${sql(d)}, ${sql(e.activity)}, ${sql(e.name)}, ${e.minutes}, ${sql(e.level)}, ${sql(e.speed)}, ${sql(e.incline)}, ${e.kcal})`)
      .join(",\n");
    out.push(`  if not exists (select 1 from public.exercise_logs where user_id = v_uid and log_date = ${sql(d)}) then
    insert into public.exercise_logs (user_id, log_date, activity, name, minutes, level, speed_kmh, incline_pct, kcal) values
${rows};
  end if;`);
  }
  return out.join("\n");
}

const days = readdirSync(SOURCE)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(SOURCE, f), "utf8")))
  .filter((d) => d.ngay >= opts.from && d.ngay <= opts.to);

if (days.length === 0) {
  console.error("Không có ngày nào trong khoảng đã chọn.");
  process.exit(1);
}

const first = days[0].ngay;
const last = days.at(-1).ngay;
const wipe = opts.replace
  ? `  delete from public.food_logs where user_id = v_uid and log_date between ${sql(first)} and ${sql(last)};
  delete from public.exercise_logs where user_id = v_uid and log_date between ${sql(first)} and ${sql(last)};
  delete from public.day_logs where user_id = v_uid and log_date between ${sql(first)} and ${sql(last)};

`
  : "";

const output = `-- Đưa nhật ký ${first} → ${last} vào tài khoản web. Chạy trong Supabase → SQL Editor.
-- Yêu cầu: đã chạy schema.sql và các file trong migrations/, đã đăng ký tài khoản trên web.
-- Sinh tự động bởi scripts/import-du-lieu.mjs (${opts.replace ? "ghi đè các ngày này" : "giữ nguyên món đã nhập trên web"}).
do $$
declare
  v_email text := ${sql(opts.email)};   -- để trống nếu project chỉ có 1 tài khoản
  v_uid uuid;
  v_count int;
begin
  if v_email <> '' then
    select id into v_uid from auth.users where email = v_email;
  else
    select count(*) into v_count from auth.users;
    if v_count > 1 then
      raise exception 'Project có % tài khoản — chạy lại script với --email', v_count;
    end if;
    select id into v_uid from auth.users limit 1;
  end if;
  if v_uid is null then
    raise exception 'Không tìm thấy tài khoản. Hãy đăng ký trên web trước rồi chạy lại.';
  end if;

  -- Bộ đếm phải bắt đầu từ ngày nhật ký đầu tiên
  update public.profiles set start_date = least(start_date, ${sql(first)}::date) where id = v_uid;

${wipe}${days.map(dayBlock).join("\n\n")}

  raise notice 'Đã xử lý ${days.length} ngày cho user %', v_uid;
end $$;
`;

writeFileSync(OUTPUT, output);
const open = days.filter((d) => d.tham_hut_ghi_nhan == null).map((d) => d.ngay);
console.log(`Đã ghi ${OUTPUT} (${days.length} ngày, ${first} → ${last}).`);
if (open.length) console.log(`Chưa có thâm hụt đã chốt, web sẽ tính theo công thức: ${open.join(", ")}`);
