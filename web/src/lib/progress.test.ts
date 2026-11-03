import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { adaptiveTdee, metricChange, muscleLoss, weekStart, weekSummary, weightSlope, weightTrend, type DayFacts, type IntakeDay, type WeightPoint } from "./progress";

const START = "2026-10-05"; // Thứ Hai
const line = (n: number, kgPerDay: number, from = 89): WeightPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(START, i), kg: from + kgPerDay * i }));
const intakeDays = (n: number, intake: number, formulaTdee = 2300): IntakeDay[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(START, i), intake, formulaTdee }));

describe("weightTrend", () => {
  it("điểm đầu tiên giữ nguyên số cân", () => {
    expect(weightTrend([{ date: START, kg: 89 }])[0].trend).toBe(89);
  });

  it("một lần cân vọt lên chỉ kéo xu hướng một phần", () => {
    const t = weightTrend([
      { date: START, kg: 89 },
      { date: addDays(START, 1), kg: 91 },
    ]);
    expect(t[1].trend).toBeGreaterThan(89);
    expect(t[1].trend).toBeLessThan(89.5);
  });

  it("cân thưa thì lần cân mới có trọng số lớn hơn", () => {
    const next = weightTrend([
      { date: START, kg: 89 },
      { date: addDays(START, 1), kg: 87 },
    ])[1].trend;
    const gap = weightTrend([
      { date: START, kg: 89 },
      { date: addDays(START, 20), kg: 87 },
    ])[1].trend;
    expect(gap).toBeLessThan(next);
    expect(gap).toBeGreaterThan(87);
  });
});

describe("weightSlope", () => {
  it("đúng độ dốc của đường thẳng", () => {
    expect(weightSlope(line(10, -0.1))).toBeCloseTo(-0.1, 6);
  });

  it("không lệch khi cân cách quãng không đều", () => {
    const pts = [0, 1, 5, 12].map((d) => ({ date: addDays(START, d), kg: 89 - 0.05 * d }));
    expect(weightSlope(pts)).toBeCloseTo(-0.05, 6);
  });

  it("một điểm thì độ dốc bằng 0", () => {
    expect(weightSlope(line(1, -1))).toBe(0);
  });
});

describe("adaptiveTdee", () => {
  const BMR = 1624;

  it("giảm 0,1 kg/ngày khi ăn 1.800 thì TDEE là 2.570", () => {
    const r = adaptiveTdee(line(21, -0.1), intakeDays(21, 1800), BMR);
    expect(r.ready).toBe(true);
    if (!r.ready) return;
    expect(r.tdee).toBeCloseTo(2570, 3);
    expect(r.realDeficit).toBeCloseTo(770, 3);
    expect(r.kgPerWeek).toBeCloseTo(-0.7, 6);
    expect(r.formulaTdee).toBe(2300);
  });

  it("cân đứng yên thì TDEE bằng lượng nạp", () => {
    const r = adaptiveTdee(line(21, 0), intakeDays(21, 2100), BMR);
    expect(r.ready && r.tdee).toBeCloseTo(2100, 6);
  });

  it("đang tăng cân thì TDEE thấp hơn lượng nạp", () => {
    const r = adaptiveTdee(line(21, 0.05), intakeDays(21, 2500), BMR);
    expect(r.ready && r.tdee).toBeCloseTo(2500 - 385, 3);
  });

  it("bỏ ngày ghi thiếu khỏi trung bình", () => {
    const days = [...intakeDays(20, 1800), { date: addDays(START, 20), intake: 300, formulaTdee: 2300 }];
    const r = adaptiveTdee(line(21, 0), days, BMR);
    expect(r.ready && r.intake).toBeCloseTo(1800, 6);
    expect(r.ready && r.intakeDays).toBe(20);
  });

  it("chỉ dùng 28 ngày gần nhất", () => {
    // 20 ngày đầu tăng mạnh, 28 ngày sau giảm đều
    const old = line(20, 0.5, 80);
    const recent = Array.from({ length: 28 }, (_, i) => ({ date: addDays(START, 20 + i), kg: 90 - 0.1 * i }));
    const days = Array.from({ length: 48 }, (_, i) => ({ date: addDays(START, i), intake: 1800, formulaTdee: 2300 }));
    const r = adaptiveTdee([...old, ...recent], days, BMR);
    expect(r.ready && r.kgPerWeek).toBeCloseTo(-0.7, 6);
  });

  it("báo thiếu gì khi chưa đủ dữ liệu", () => {
    const r = adaptiveTdee(line(5, -0.1), intakeDays(5, 1800), BMR);
    expect(r).toEqual({ ready: false, needWeighIns: 3, needIntakeDays: 5, needSpanDays: 10 });
  });

  it("chưa cân lần nào", () => {
    expect(adaptiveTdee([], intakeDays(20, 1800), BMR)).toEqual({ ready: false, needWeighIns: 8, needIntakeDays: 10, needSpanDays: 14 });
  });

  it("nhiều lần cân nhưng trong thời gian quá ngắn thì chưa tính", () => {
    const close = Array.from({ length: 9 }, (_, i) => ({ date: addDays(START, i), kg: 89 }));
    const r = adaptiveTdee(close, intakeDays(9, 1800), BMR);
    expect(r.ready).toBe(false);
    expect(!r.ready && r.needSpanDays).toBe(6);
  });
});

describe("weekStart", () => {
  it("Thứ Hai là chính nó", () => expect(weekStart("2026-10-26")).toBe("2026-10-26"));
  it("giữa tuần lùi về Thứ Hai", () => expect(weekStart("2026-10-29")).toBe("2026-10-26"));
  it("Chủ nhật thuộc tuần trước đó", () => expect(weekStart("2026-11-01")).toBe("2026-10-26"));
});

describe("weekSummary", () => {
  const MON = "2026-10-26";
  const fact = (offset: number, f: Partial<DayFacts> = {}): DayFacts => ({
    date: addDays(MON, offset),
    hasFood: true,
    intake: 1800,
    protein: 140,
    deficit: 500,
    gym: false,
    steps: null,
    water: null,
    sleep: null,
    ...f,
  });
  const targets = { protein: 140, steps: 6000, water: 2000, sleep: 7.5 };
  const run = (days: DayFacts[], today = "2026-11-01", trend: ReturnType<typeof weightTrend> = []) =>
    weekSummary({ days, trend, from: MON, today, targets });

  it("cộng thâm hụt và đếm ngày bỏ ghi", () => {
    const r = run([fact(0), fact(1), fact(2, { deficit: -100 })]);
    expect(r.deficitTotal).toBe(900);
    expect(r.deficitAvg).toBe(300);
    expect([r.loggedDays, r.missedDays]).toEqual([3, 4]);
  });

  it("tuần đang chạy chỉ tính những ngày đã qua", () => {
    const r = run([fact(0), fact(1)], "2026-10-28");
    expect([r.elapsed, r.missedDays]).toEqual([3, 1]);
  });

  it("không tính dữ liệu ngoài tuần", () => {
    expect(run([fact(-1), fact(7), fact(0)]).loggedDays).toBe(1);
  });

  it("ngày ấn định không có món vẫn tính thâm hụt, không vào trung bình nạp", () => {
    const r = run([fact(0), fact(1, { hasFood: false, intake: 0, protein: 0, deficit: 350 })]);
    expect(r.deficitTotal).toBe(850);
    expect(r.intakeAvg).toBe(1800);
  });

  it("ngày không có dữ liệu protein không kéo trung bình xuống", () => {
    const r = run([fact(0, { protein: 120 }), fact(1, { protein: 0 })]);
    expect(r.proteinAvg).toBe(120);
  });

  it("đếm ngày đạt mục tiêu", () => {
    const r = run([fact(0, { steps: 6000, water: 2000, sleep: 7.5 }), fact(1, { steps: 5999, water: 500, sleep: 6, protein: 100 })]);
    expect([r.stepsHit, r.waterHit, r.sleepHit, r.proteinHit]).toEqual([1, 1, 1, 1]);
  });

  it("chưa đặt mục tiêu thì không đếm", () => {
    const r = weekSummary({ days: [fact(0, { steps: 9000 })], trend: [], from: MON, today: "2026-11-01", targets: { protein: 140 } });
    expect(r.stepsHit).toBeNull();
  });

  it("đếm số ngày tập gym", () => {
    expect(run([fact(0, { gym: true }), fact(1), fact(2, { gym: true })]).gymDays).toBe(2);
  });

  it("đổi cân tính từ lần cân cuối của tuần trước", () => {
    const trend = [
      { date: "2026-10-25", kg: 88, trend: 88 },
      { date: "2026-10-27", kg: 87, trend: 87.8 },
      { date: "2026-10-30", kg: 87, trend: 87.5 },
    ];
    expect(run([], "2026-11-01", trend).weightChange).toBeCloseTo(-0.5, 6);
  });

  it("chưa có tuần trước thì so với lần cân đầu trong tuần", () => {
    const trend = [
      { date: "2026-10-27", kg: 88, trend: 88 },
      { date: "2026-10-30", kg: 87, trend: 87.7 },
    ];
    expect(run([], "2026-11-01", trend).weightChange).toBeCloseTo(-0.3, 6);
  });

  it("tuần không cân thì không có số đổi cân", () => {
    expect(run([], "2026-11-01", [{ date: "2026-10-25", kg: 88, trend: 88 }]).weightChange).toBeNull();
  });
});

describe("metricChange", () => {
  const rows = [
    { measured_on: "2026-10-05", pbf: 34.8 as number | null },
    { measured_on: "2026-10-20", pbf: null },
    { measured_on: "2026-11-01", pbf: 33.5 },
  ];

  it("bỏ qua lần đo không có chỉ số này", () => {
    const c = metricChange(rows, "pbf");
    expect(c?.latest).toBe(33.5);
    expect(c?.fromFirst).toBeCloseTo(-1.3, 6);
  });

  it("một lần đo thì chưa có mức đổi", () => {
    expect(metricChange(rows.slice(0, 1), "pbf")).toEqual({ latest: 34.8, fromFirst: null });
  });

  it("chưa đo chỉ số này", () => {
    expect(metricChange([{ measured_on: "2026-10-05", pbf: null }], "pbf")).toBeNull();
  });
});

describe("muscleLoss", () => {
  const rows = (...smm: (number | null)[]) => smm.map((smm_kg, i) => ({ measured_on: addDays(START, i), smm_kg }));

  it("cảnh báo khi giảm từ 0,5 kg", () => {
    expect(muscleLoss(rows(32.8, 32.3))).toBeCloseTo(-0.5, 6);
  });

  it("dao động nhỏ nằm trong sai số", () => {
    expect(muscleLoss(rows(32.8, 32.4))).toBeNull();
  });

  it("chỉ so 2 lần đo gần nhất, bỏ qua lần không đo cơ", () => {
    expect(muscleLoss(rows(33, 32, null, 32.1))).toBeNull();
  });

  it("chưa đủ 2 lần đo", () => {
    expect(muscleLoss(rows(32.8))).toBeNull();
  });
});
