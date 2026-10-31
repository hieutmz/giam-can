import { describe, expect, it } from "vitest";
import { loggedAmount, uniqueRecent } from "./foods";

describe("uniqueRecent", () => {
  const log = (food_ref: string | null, name: string) => ({ food_ref, name });

  it("giữ lần mới nhất của mỗi món, theo đúng thứ tự", () => {
    const logs = [log("a", "A (2 ổ)"), log("b", "B"), log("a", "A (1 ổ)")];
    expect(uniqueRecent(logs)).toEqual([logs[0], logs[1]]);
  });

  it("món nhập nhanh không có food_ref thì so theo tên, không phân biệt dấu", () => {
    expect(uniqueRecent([log(null, "Phở bò"), log(null, "pho bo")])).toHaveLength(1);
  });

  it("món có food_ref và món nhập nhanh trùng tên vẫn là hai món", () => {
    expect(uniqueRecent([log("a", "Phở"), log(null, "Phở")])).toHaveLength(2);
  });

  it("dừng ở giới hạn", () => {
    expect(uniqueRecent([log("a", "A"), log("b", "B"), log("c", "C")], 2)).toHaveLength(2);
  });
});

describe("loggedAmount", () => {
  it("món theo gram lấy số gram đã ghi", () => {
    expect(loggedAmount({ grams: 250, kcal: 325 }, { kcal: 130 })).toBe(250);
  });

  it("món theo phần suy ra số phần từ kcal", () => {
    expect(loggedAmount({ grams: null, kcal: 675 }, { kcal: 450, basis: "serving" })).toBe(1.5);
  });

  it("món theo phần có 0 kcal thì coi là 1 phần", () => {
    expect(loggedAmount({ grams: null, kcal: 0 }, { kcal: 0, basis: "serving" })).toBe(1);
  });
});
