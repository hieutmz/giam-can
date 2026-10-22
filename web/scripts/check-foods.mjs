// Kiểm tra DB thực phẩm: JSON hợp lệ, id duy nhất, tên trùng, kcal lệch so với 4P + 4C + 9F.
// Chạy: npm run check-foods
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "src", "data", "foods");
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().trim();

const all = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  for (const row of JSON.parse(readFileSync(join(dir, f), "utf8"))) all.push({ ...row, file: f });
}

const problems = [];
const warnings = [];
// Rượu bia có năng lượng từ cồn (7 kcal/g); rau nhiều xơ có kcal thấp hơn 4/4/9 — chỉ cảnh báo
const ALCOHOL = /bia|ruou|vodka|whisky|soju|sake|cocktail/;
const ids = new Map();
const names = new Map();
for (const r of all) {
  for (const k of ["id", "name", "group", "kcal", "protein", "carb", "fat"]) {
    if (r[k] === undefined || r[k] === null) problems.push(`${r.id ?? "?"}: thiếu ${k}`);
  }
  if (ids.has(r.id)) problems.push(`id trùng: ${r.id}`);
  ids.set(r.id, r);
  const n = norm(r.name);
  if (names.has(n)) problems.push(`tên trùng: "${r.name}" (${r.id}) ~ ${names.get(n).id}`);
  else names.set(n, r);
  const calc = 4 * r.protein + 4 * r.carb + 9 * r.fat;
  if (r.kcal > 40 && Math.abs(calc - r.kcal) / r.kcal > 0.2 && !ALCOHOL.test(n)) {
    warnings.push(`kcal lệch >20%: ${r.id} "${r.name}" kcal=${r.kcal}, 4P+4C+9F=${calc.toFixed(0)}`);
  }
}

const groups = {};
for (const r of all) groups[r.group] = (groups[r.group] ?? 0) + 1;
console.log(`Tổng: ${all.length} thực phẩm`);
console.table(groups);
if (warnings.length) {
  console.log(`\n${warnings.length} cảnh báo (kiểm tra lại nếu cần):`);
  for (const w of warnings) console.log(" - " + w);
}
if (problems.length) {
  console.log(`\n${problems.length} vấn đề:`);
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("Không có vấn đề.");
}
