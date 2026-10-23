// Danh sách hoạt động. Giá trị MET theo Compendium of Physical Activities (2024).
// kind:
//  - "met": kcal = (MET − 1) × kg × giờ  (trừ 1 MET nghỉ vì đã nằm trong BMR)
//  - "treadmill": phương trình ACSM, nhập tốc độ (km/h) + độ dốc (%)
//  - "outdoor": như treadmill nhưng độ dốc mặc định 0 (đi bộ / chạy ngoài trời)

export type Level = { id: string; label: string; met: number };

export type ActivityGroup = "gym" | "cardio" | "sport" | "other";
export const ACTIVITY_GROUPS: ActivityGroup[] = ["gym", "cardio", "sport", "other"];

export type Activity = {
  id: string;
  name: string;
  group: ActivityGroup;
  kind: "met" | "treadmill" | "outdoor";
  levels?: Level[];
};

const NHE_VUA_NANG = (nhe: number, vua: number, nang: number): Level[] => [
  { id: "nhe", label: "Nhẹ", met: nhe },
  { id: "vua", label: "Vừa", met: vua },
  { id: "nang", label: "Nặng", met: nang },
];

export const ACTIVITIES: Activity[] = [
  { id: "gym", name: "Tập tạ (gym)", group: "gym", kind: "met", levels: NHE_VUA_NANG(3.5, 5.0, 6.0) },
  { id: "circuit", name: "Circuit training", group: "gym", kind: "met", levels: NHE_VUA_NANG(4.3, 6.0, 8.0) },
  { id: "bodyweight", name: "Calisthenics (hít đất, squat, plank…)", group: "gym", kind: "met", levels: NHE_VUA_NANG(2.8, 3.8, 8.0) },

  { id: "treadmill", name: "Đi bộ / chạy máy chạy bộ", group: "cardio", kind: "treadmill" },
  { id: "outdoor", name: "Đi bộ / chạy ngoài trời", group: "cardio", kind: "outdoor" },
  { id: "bike", name: "Đạp xe tại chỗ", group: "cardio", kind: "met", levels: NHE_VUA_NANG(3.5, 6.8, 8.8) },
  { id: "bike_out", name: "Đạp xe ngoài trời", group: "cardio", kind: "met", levels: NHE_VUA_NANG(4.0, 6.8, 10.0) },
  { id: "elliptical", name: "Máy elliptical", group: "cardio", kind: "met", levels: NHE_VUA_NANG(4.0, 5.0, 6.8) },
  { id: "stair", name: "Máy leo cầu thang", group: "cardio", kind: "met", levels: NHE_VUA_NANG(6.0, 8.8, 9.0) },
  { id: "rowing", name: "Máy chèo thuyền", group: "cardio", kind: "met", levels: NHE_VUA_NANG(4.8, 7.0, 8.5) },
  { id: "hiit", name: "HIIT", group: "cardio", kind: "met", levels: NHE_VUA_NANG(6.0, 8.0, 10.0) },
  { id: "jumprope", name: "Nhảy dây", group: "cardio", kind: "met", levels: NHE_VUA_NANG(8.3, 11.0, 12.3) },
  { id: "aerobic", name: "Aerobic / Zumba", group: "cardio", kind: "met", levels: NHE_VUA_NANG(5.0, 6.5, 7.3) },
  { id: "swim", name: "Bơi lội", group: "cardio", kind: "met", levels: NHE_VUA_NANG(5.8, 8.3, 9.8) },

  { id: "badminton", name: "Cầu lông", group: "sport", kind: "met", levels: NHE_VUA_NANG(4.5, 5.5, 7.0) },
  { id: "pickleball", name: "Pickleball", group: "sport", kind: "met", levels: NHE_VUA_NANG(4.0, 4.8, 6.0) },
  { id: "tennis", name: "Tennis", group: "sport", kind: "met", levels: NHE_VUA_NANG(5.0, 7.3, 8.0) },
  { id: "football", name: "Bóng đá", group: "sport", kind: "met", levels: NHE_VUA_NANG(7.0, 8.0, 10.0) },
  { id: "basketball", name: "Bóng rổ", group: "sport", kind: "met", levels: NHE_VUA_NANG(4.5, 6.5, 8.0) },
  { id: "volleyball", name: "Bóng chuyền", group: "sport", kind: "met", levels: NHE_VUA_NANG(3.0, 4.0, 8.0) },
  { id: "tabletennis", name: "Bóng bàn", group: "sport", kind: "met", levels: NHE_VUA_NANG(3.0, 4.0, 5.5) },

  { id: "yoga", name: "Yoga", group: "other", kind: "met", levels: NHE_VUA_NANG(2.3, 3.0, 4.0) },
  { id: "pilates", name: "Pilates", group: "other", kind: "met", levels: NHE_VUA_NANG(2.8, 3.0, 4.0) },
  { id: "stretch", name: "Giãn cơ", group: "other", kind: "met", levels: NHE_VUA_NANG(2.3, 2.5, 3.0) },
  { id: "dance", name: "Nhảy (dance)", group: "other", kind: "met", levels: NHE_VUA_NANG(4.5, 5.5, 7.8) },
  { id: "housework", name: "Dọn nhà", group: "other", kind: "met", levels: NHE_VUA_NANG(2.3, 3.3, 4.0) },
];

export const activityById = (id: string) => ACTIVITIES.find((a) => a.id === id);
