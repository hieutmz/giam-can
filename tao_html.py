"""Tạo file HTML cho từng ngày (ngay/YYYY-MM-DD.html) và trang tổng quan (index.html)
từ dữ liệu JSON trong du_lieu/. Chạy: python tao_html.py"""
import json
import sys
from datetime import date, timedelta
from html import escape
from pathlib import Path

GOC = Path(__file__).resolve().parent
DU_LIEU = GOC / "du_lieu"
NGAY = GOC / "ngay"
MUC_TIEU = 77_000
MUC_TIEU_NAP = 1_800
NGAY_BAT_DAU = date(2026, 10, 12)
THU = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"]
TRANG_THAI = {
    "dang_ghi": ("Đang ghi", "info"),
    "tam_tinh": ("Tạm tính", "warn"),
    "an_dinh": ("Ấn định", "muted"),
    "da_tong_ket": ("Đã tổng kết", "ok"),
}
THU_TU_BUA = ["Sáng", "Trưa", "Xế", "Tối", "Phụ", "Đồ uống"]

CSS = """
:root{--bg:#f6f7f4;--card:#fff;--ink:#1d2320;--muted:#66706a;--line:#e3e6e1;--accent:#2f7d4f;
--accent-soft:#e3f1e8;--warn:#a5650d;--warn-soft:#fbf0dc;--info:#2b62a8;--info-soft:#e2ecf8;--bar:#d9ded8;--bad:#b4473a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141816;--card:#1c211e;--ink:#e6ebe7;
--muted:#9aa49d;--line:#2c332f;--accent:#5fbf86;--accent-soft:#1f3328;--warn:#e0a54a;--warn-soft:#352a17;
--info:#7aa9e6;--info-soft:#1c2a3b;--bar:#2c332f;--bad:#e57d6f}}
:root[data-theme="dark"]{--bg:#141816;--card:#1c211e;--ink:#e6ebe7;--muted:#9aa49d;--line:#2c332f;--accent:#5fbf86;
--accent-soft:#1f3328;--warn:#e0a54a;--warn-soft:#352a17;--info:#7aa9e6;--info-soft:#1c2a3b;--bar:#2c332f;--bad:#e57d6f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:28px 16px 48px}
a{color:var(--accent)}
nav.top{display:flex;justify-content:space-between;gap:8px;font-size:14px;margin-bottom:18px}
nav.top a{text-decoration:none}
nav.top .off{color:var(--muted);opacity:.5}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:16px;margin:0 0 12px}
.sub{color:var(--muted);margin:0 0 20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.badge{display:inline-block;white-space:nowrap;font-size:12px;font-weight:600;padding:2px 10px;border-radius:99px}
.badge.ok{background:var(--accent-soft);color:var(--accent)}
.badge.warn{background:var(--warn-soft);color:var(--warn)}
.badge.info{background:var(--info-soft);color:var(--info)}
.badge.muted{background:var(--bar);color:var(--muted)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.kpi .v{font-size:22px;font-weight:650;font-variant-numeric:tabular-nums;margin-top:2px}
.kpi .n{font-size:12px;color:var(--muted)}
.kpi .v.good{color:var(--accent)}
.kpi .v.bad{color:var(--bad)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid2 .card{margin-bottom:0}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.total td{font-weight:650;border-bottom:none}
.tag{font-size:12px;color:var(--muted);white-space:nowrap}
.progress{height:10px;background:var(--bar);border-radius:99px;overflow:hidden;margin:10px 0 6px}
.progress>div{height:100%;background:var(--accent);border-radius:99px}
.row{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)}
ul{margin:0;padding-left:20px}
li{margin:4px 0}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:14px}
dt{color:var(--muted)}
dd{margin:0;font-variant-numeric:tabular-nums}
.empty{color:var(--muted);font-style:italic}
.chart{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:8px}
.chart .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end;min-width:0}
.chart .b{width:100%;max-width:44px;background:var(--accent);border-radius:6px 6px 0 0;min-height:2px}
.chart .b.p{background:var(--warn)}
.chart .b.neg{background:var(--bad)}
.chart .x{font-size:11px;color:var(--muted)}
.chart .t{font-size:11px;font-variant-numeric:tabular-nums}
footer{color:var(--muted);font-size:12px;margin-top:24px}
.kpi,.card,.col{min-width:0}
@media (max-width:640px){.kpis{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}h1{font-size:22px}
.kpi .v{font-size:18px}th,td{padding:7px 4px}.chart .t{font-size:9px}.hide-sm{display:none}
td .tag{display:block}
th:nth-child(1),td:nth-child(1){white-space:nowrap}}
"""


def so(n):
    return "—" if n is None else f"{round(n):,}".replace(",", ".")


def khoang(lo, hi):
    if lo is None and hi is None:
        return "—"
    if lo == hi or hi is None:
        return so(lo)
    return f"{so(lo)}–{so(hi)}"


def ngay_vn(d):
    return f"{THU[d.weekday()]}, {d.day:02d}/{d.month:02d}/{d.year}"


def tong_nap(ngay):
    if ngay.get("nap"):
        return ngay["nap"]["min"], ngay["nap"]["max"]
    items = ngay.get("an_uong") or []
    if not items:
        return None, None
    return sum(i["kcal_min"] or 0 for i in items), sum(i["kcal_max"] or 0 for i in items)


def trang(title, body):
    return f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title>
<style>{CSS}</style>
</head>
<body><main>
{body}
<footer>Số liệu calo là ước tính, không phải phép đo trực tiếp. Mục tiêu 77.000 kcal ≈ 10 kg mỡ (7.700 kcal/kg).</footer>
</main></body>
</html>
"""


def kpi(label, value, note="", cls=""):
    return (f'<div class="kpi"><div class="l">{label}</div>'
            f'<div class="v {cls}">{value}</div><div class="n">{note}</div></div>')


def tao_ngay(ngay, truoc, sau, tich_luy):
    d = date.fromisoformat(ngay["ngay"])
    nhan, loai = TRANG_THAI.get(ngay.get("trang_thai"), ("", "muted"))
    nap_lo, nap_hi = tong_nap(ngay)
    th = ngay.get("tieu_hao") or {}
    th_lo, th_hi = th.get("min"), th.get("max")
    ghi_nhan = ngay.get("tham_hut_ghi_nhan")

    if ghi_nhan is not None and ghi_nhan < 0:
        tham_hut, tham_hut_note = f"Dư {so(-ghi_nhan)}", "đã trừ khỏi bộ đếm"
    elif ghi_nhan is not None:
        tham_hut, tham_hut_note = so(ghi_nhan), "đã ghi vào bộ đếm"
    elif None not in (nap_lo, th_lo):
        tham_hut, tham_hut_note = khoang(th_lo - nap_hi, th_hi - nap_lo), "ước tính, chưa ghi"
    else:
        tham_hut, tham_hut_note = "—", "chưa đủ dữ liệu"

    con_lai_nap = f"còn {khoang(MUC_TIEU_NAP - nap_hi, MUC_TIEU_NAP - nap_lo)} so với 1.800" if nap_lo is not None else "mục tiêu 1.800"
    pct = tich_luy / MUC_TIEU * 100
    nav = (
        '<nav class="top">'
        + (f'<a href="{truoc}.html">← {truoc[8:10]}/{truoc[5:7]}</a>' if truoc else '<span class="off">←</span>')
        + '<a href="../index.html">Tổng quan</a>'
        + (f'<a href="{sau}.html">{sau[8:10]}/{sau[5:7]} →</a>' if sau else '<span class="off">→</span>')
        + "</nav>"
    )

    kpis = '<div class="kpis">' + "".join([
        kpi("Calo nạp", khoang(nap_lo, nap_hi), con_lai_nap),
        kpi("Tiêu hao", khoang(th_lo, th_hi), "BMR + hoạt động + tập"),
        kpi("Thâm hụt", tham_hut, tham_hut_note,
            "" if not ghi_nhan else ("good" if ghi_nhan > 0 else "bad")),
        kpi("Tích lũy", so(tich_luy), f"{pct:.2f}% / 77.000".replace(".", ",", 1)),
    ]) + "</div>"

    # Ăn uống
    items = sorted(ngay.get("an_uong") or [], key=lambda i: THU_TU_BUA.index(i["bua"]) if i["bua"] in THU_TU_BUA else 99)
    if items:
        rows = "".join(
            f'<tr><td><span class="tag">{escape(i["bua"])}</span></td><td>{escape(i["mon"])}</td>'
            f'<td class="num">{khoang(i["kcal_min"], i["kcal_max"])}</td></tr>' for i in items)
        rows += f'<tr class="total"><td></td><td>Tổng</td><td class="num">{khoang(nap_lo, nap_hi)}</td></tr>'
        an = f'<table><thead><tr><th>Bữa</th><th>Món</th><th class="num">kcal</th></tr></thead><tbody>{rows}</tbody></table>'
    else:
        an = '<p class="empty">Chưa ghi nhận.</p>'

    # Vận động
    tap = ngay.get("tap_luyen") or []
    if tap:
        rows = "".join(
            f'<tr><td>{escape(t["ten"])}'
            + (f'<br><span class="tag">{escape(t["chi_tiet"])}</span>' if t.get("chi_tiet") else "")
            + f'</td><td class="num">{so(t["phut"])} phút</td><td class="num">{khoang(t["kcal_min"], t["kcal_max"])}</td></tr>'
            for t in tap)
        van_dong = f'<table><thead><tr><th>Hoạt động</th><th class="num">Thời gian</th><th class="num">kcal</th></tr></thead><tbody>{rows}</tbody></table>'
    else:
        van_dong = '<p class="empty">Không tập / chưa ghi nhận.</p>'

    ngu = ngay.get("ngu") or {}
    gio_ngu = ngu.get("gio")
    sinh_hoat = "<dl>" + "".join([
        f'<dt>Giấc ngủ</dt><dd>{escape(ngu.get("tu") or "—")} → {escape(ngu.get("den") or "—")}'
        + (f' ({f"{gio_ngu:g}".replace(".", ",")} giờ)' if gio_ngu else "") + "</dd>",
        f'<dt>Nước</dt><dd>{so(ngay.get("nuoc_ml"))} ml</dd>',
        f'<dt>Bước chân</dt><dd>{so(ngay.get("buoc_chan"))}</dd>',
        f'<dt>Bổ sung</dt><dd>{escape(", ".join(ngay.get("bo_sung") or [])) or "—"}</dd>',
    ]) + "</dl>"

    def ds(key, trong):
        xs = ngay.get(key) or []
        return "<ul>" + "".join(f"<li>{escape(x)}</li>" for x in xs) + "</ul>" if xs else f'<p class="empty">{trong}</p>'

    body = f"""{nav}
<h1>Nhật ký {d.day:02d}/{d.month:02d}/{d.year}</h1>
<p class="sub">{ngay_vn(d)} · Ngày thứ {(d - NGAY_BAT_DAU).days + 1} của lộ trình <span class="badge {loai}">{nhan}</span></p>
{kpis}
<div class="card">
<h2>Tiến độ mục tiêu 77.000 kcal</h2>
<div class="progress"><div style="width:{min(pct, 100):.2f}%"></div></div>
<div class="row"><span>Đã tích lũy {so(tich_luy)} kcal</span><span>Còn {so(MUC_TIEU - tich_luy)} kcal</span></div>
</div>
<div class="card"><h2>Ăn uống</h2>{an}</div>
<div class="grid2">
<div class="card"><h2>Vận động</h2>{van_dong}</div>
<div class="card"><h2>Sinh hoạt</h2>{sinh_hoat}</div>
</div>
<div class="card" style="margin-top:16px"><h2>Đánh giá</h2>{ds("danh_gia", "Chưa tổng kết.")}</div>
<div class="card"><h2>Ghi chú</h2>{ds("ghi_chu", "Không có.")}</div>"""
    return trang(f"Nhật ký {d.day:02d}/{d.month:02d}", body)


def tao_index(ngays, tich_luys):
    tong = tich_luys[-1] if tich_luys else 0
    da_ghi = [n for n in ngays if n.get("tham_hut_ghi_nhan") is not None]
    tb = tong / len(da_ghi) if da_ghi else 0
    if tb > 0:
        con = (MUC_TIEU - tong) / tb
        cuoi = date.fromisoformat(da_ghi[-1]["ngay"]) + timedelta(days=round(con))
        du_kien = f"{cuoi.day:02d}/{cuoi.month:02d}/{cuoi.year}"
    else:
        du_kien = "—"
    pct = tong / MUC_TIEU * 100

    kpis = '<div class="kpis">' + "".join([
        kpi("Đã tích lũy", so(tong), f"{pct:.2f}% mục tiêu".replace(".", ","), "good"),
        kpi("Còn lại", so(MUC_TIEU - tong), "kcal"),
        kpi("TB / ngày", so(tb), f"trên {len(da_ghi)} ngày đã ghi"),
        kpi("Dự kiến về 0", du_kien, "theo tốc độ hiện tại"),
    ]) + "</div>"

    max_v = max([abs(n.get("tham_hut_ghi_nhan") or 0) for n in ngays] + [1])

    def cot(n):
        v = n.get("tham_hut_ghi_nhan")
        lop = " neg" if (v or 0) < 0 else (" p" if n.get("trang_thai") == "tam_tinh" else "")
        return (f'<div class="col"><span class="t">{so(v) if v is not None else ""}</span>'
                f'<div class="b{lop}" style="height:{abs(v or 0) / max_v * 110:.0f}px"></div>'
                f'<span class="x">{n["ngay"][8:10]}/{n["ngay"][5:7]}</span></div>')

    cols = "".join(cot(n) for n in ngays)

    rows = ""
    for n, tl in zip(reversed(ngays), reversed(tich_luys)):
        d = date.fromisoformat(n["ngay"])
        nhan, loai = TRANG_THAI.get(n.get("trang_thai"), ("", "muted"))
        lo, hi = tong_nap(n)
        rows += (f'<tr><td><a href="ngay/{n["ngay"]}.html">{d.day:02d}/{d.month:02d}</a> <span class="tag">{THU[d.weekday()]}</span></td>'
                 f'<td><span class="badge {loai}">{nhan}</span></td>'
                 f'<td class="num">{khoang(lo, hi)}</td>'
                 f'<td class="num hide-sm">{so(n.get("buoc_chan"))}</td>'
                 f'<td class="num">{so(n.get("tham_hut_ghi_nhan"))}</td>'
                 f'<td class="num">{so(tl)}</td></tr>')

    body = f"""<h1>Lộ trình giảm mỡ</h1>
<p class="sub">Bắt đầu 12/10/2026 · Mốc kế hoạch 21/11/2026 · Mục tiêu thâm hụt 77.000 kcal (≈10 kg mỡ)</p>
{kpis}
<div class="card">
<h2>Tiến độ</h2>
<div class="progress"><div style="width:{min(pct, 100):.2f}%"></div></div>
<div class="row"><span>{so(tong)} / 77.000 kcal</span><span>{f"{pct:.2f}".replace(".", ",")}%</span></div>
</div>
<div class="card">
<h2>Thâm hụt từng ngày (kcal)</h2>
<div class="chart">{cols}</div>
<div class="row" style="margin-top:8px"><span><span class="badge ok">xanh</span> đã tổng kết · <span class="badge warn">cam</span> tạm tính · <span class="badge" style="color:var(--bad)">đỏ</span> dư calo</span></div>
</div>
<div class="card">
<h2>Các ngày</h2>
<table><thead><tr><th>Ngày</th><th>Trạng thái</th><th class="num">Nạp</th><th class="num hide-sm">Bước</th><th class="num">Thâm hụt</th><th class="num">Tích lũy</th></tr></thead>
<tbody>{rows}</tbody></table>
</div>
<div class="grid2">
<div class="card"><h2>Baseline InBody 05/10</h2><dl>
<dt>Cân nặng</dt><dd>89,0 kg</dd><dt>Mỡ</dt><dd>30,9 kg (34,8%)</dd><dt>Cơ xương</dt><dd>32,8 kg</dd>
<dt>Mỡ nội tạng</dt><dd>14</dd><dt>BMR</dt><dd>1.624 kcal</dd></dl></div>
<div class="card"><h2>Kế hoạch mỗi ngày</h2><dl>
<dt>Calo</dt><dd>1.800 kcal</dd><dt>Protein</dt><dd>130–150 g</dd><dt>Gym</dt><dd>5 buổi / tuần</dd>
<dt>Bước chân</dt><dd>5.000–7.000</dd><dt>Đến 21/11</dt><dd>−2,5 đến −3,5 kg mỡ</dd></dl></div>
</div>"""
    return trang("Lộ trình giảm mỡ", body)


def main():
    files = sorted(DU_LIEU.glob("*.json"))
    ngays = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    ngays.sort(key=lambda n: n["ngay"])
    NGAY.mkdir(exist_ok=True)
    tich_luys, tl = [], 0
    for n in ngays:
        tl += n.get("tham_hut_ghi_nhan") or 0
        tich_luys.append(tl)
    for i, n in enumerate(ngays):
        truoc = ngays[i - 1]["ngay"] if i > 0 else None
        sau = ngays[i + 1]["ngay"] if i + 1 < len(ngays) else None
        (NGAY / f'{n["ngay"]}.html').write_text(tao_ngay(n, truoc, sau, tich_luys[i]), encoding="utf-8")
    (GOC / "index.html").write_text(tao_index(ngays, tich_luys), encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Đã tạo {len(ngays)} trang ngày + index.html. Tích lũy: {so(tl)} kcal")


if __name__ == "__main__":
    main()
