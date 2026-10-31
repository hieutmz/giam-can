import { describe, expect, it } from "vitest";
import { acsmKcal, amountNutrition, bmrMifflin, dayDeficit, exerciseKcal, metKcal, portion, recipeUnit, roundNutrients, stepsKcal, summarizeDay } from "./calc";

describe("calc", () => {
  it("BMR Mifflin cho nam 27 tuổi, 166 cm, 89 kg", () => {
    expect(Math.round(bmrMifflin("male", 89, 166, 27))) .toBe(1798);
  });

  it("máy chạy 4,5 km/h dốc 12% trong 10 phút, 89 kg ≈ 105 kcal", () => {
    expect(acsmKcal(4.5, 12, 89, 10)).toBeCloseTo(105.5, 0);
  });

  it("chạy 10 km/h phẳng 30 phút, 70 kg dùng công thức chạy", () => {
    // net VO2 = 0,2 × 166,7 = 33,3 → 33,3 × 70 × 30 × 5 / 1000 ≈ 350
    expect(acsmKcal(10, 0, 70, 30)).toBeCloseTo(350, -1);
  });

  it("tập tạ vừa (5 MET) 30 phút, 89 kg ≈ 178 kcal ròng", () => {
    expect(metKcal(5, 89, 30)).toBeCloseTo(178, 0);
    expect(exerciseKcal({ activity: "gym", minutes: 30, level: "vua" }, 89)).toBeCloseTo(178, 0);
  });

  it("3.000 bước, 89 kg, cao 166 cm ≈ 92 kcal", () => {
    expect(stepsKcal(3000, 89, 166)).toBeCloseTo(92, 0);
  });

  it("khẩu phần 300 g cơm (130 kcal/100 g) = 390 kcal", () => {
    expect(portion({ kcal: 130, protein: 2.7, carb: 28.2, fat: 0.3 }, 300).kcal).toBe(390);
  });

  it("món theo phần: 1,5 ổ bánh mì 450 kcal/ổ = 675 kcal; món theo 100 g nhận số gram", () => {
    expect(amountNutrition({ kcal: 450, protein: 18, carb: 60, fat: 15, basis: "serving" }, 1.5).kcal).toBe(675);
    expect(amountNutrition({ kcal: 130, protein: 2.7, carb: 28.2, fat: 0.3 }, 200).kcal).toBe(260);
  });

  it("tổng kết ngày: BMR 1624 × 1,2 + bước + tập − ăn", () => {
    const s = summarizeDay({
      bmr: 1624,
      activityFactor: 1.2,
      weightKg: 89,
      heightCm: 166,
      foods: [{ kcal: 1800, protein: 100, carb: 200, fat: 60 }],
      exercises: [{ kcal: 178 }],
      steps: 3000,
    });
    expect(Math.round(s.tdee)).toBe(Math.round(1624 * 1.2 + 92.2 + 178));
    expect(s.deficit).toBeCloseTo(s.tdee - 1800);
  });
});

describe("dayDeficit", () => {
  it("dùng số ấn định, kể cả số 0 và số âm", () => {
    expect(dayDeficit({ deficit: 500 }, 0)).toBe(0);
    expect(dayDeficit({ deficit: 500 }, -275)).toBe(-275);
  });

  it("không ấn định thì theo công thức", () => {
    expect(dayDeficit({ deficit: 500 }, null)).toBe(500);
    expect(dayDeficit({ deficit: 500 }, undefined)).toBe(500);
  });
});

describe("recipeUnit", () => {
  const items = [
    { kcal: 650, protein: 13, carb: 140, fat: 1 },
    { kcal: 350, protein: 40, carb: 0, fat: 20 },
  ];

  it("chia theo số phần", () => {
    const u = recipeUnit(items, { servings: 4, cooked_g: null });
    expect(u.basis).toBe("serving");
    expect(u.kcal).toBe(250);
    expect(u.protein).toBeCloseTo(13.25);
  });

  it("có khối lượng chín thì tính trên 100 g và bỏ qua số phần", () => {
    const u = recipeUnit(items, { servings: 4, cooked_g: 2000 });
    expect(u.basis).toBe("100g");
    expect(u.kcal).toBe(50);
  });

  it("thiếu số phần thì coi là 1 phần", () => {
    expect(recipeUnit(items, { servings: null, cooked_g: null }).kcal).toBe(1000);
  });
});

describe("roundNutrients", () => {
  it("làm tròn 1 chữ số thập phân", () => {
    expect(roundNutrients({ kcal: 123.456, protein: 1.25, carb: 0.04, fat: 9.96 })).toEqual({ kcal: 123.5, protein: 1.3, carb: 0, fat: 10 });
  });
});
