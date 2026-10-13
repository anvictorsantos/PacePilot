/** Shared workout labels — single source for titles, type names and RPE labels. (Pass 7) */

export const TITLE_MAP = {
  easy: "Easy Recovery Spin",
  tempo: "Mid-Week Threshold Intervals",
  long: "Sunday Long Aerobic Block",
  threshold: "2x2km Cruise Splits",
  interval: "8x400m VO2Max Intervals",
  recovery: "Aerobic Muscle Shakeout",
  steady: "Lunch hour park trail",
  unknown: "Morning recovery loop",
};

export function activityTitle(a) {
  if (a?.name && a.name !== "Run") return a.name;
  return TITLE_MAP[a?.workout_type] || TITLE_MAP.unknown;
}

export const WORKOUT_TYPE_NAMES = {
  tempo: "TEMPO RUN",
  interval: "INTERVALS",
  threshold: "THRESHOLD",
  steady: "STEADY RUN",
  easy: "EASY RUN",
  recovery: "RECOVERY",
  long: "LONG RUN",
};

export const INTENSITY_LABELS = {
  recovery: "Very Easy (RPE 3-4)",
  easy: "Easy (RPE 4-5)",
  long: "Easy (RPE 4-5)",
  steady: "Moderate (RPE 6)",
  tempo: "Moderate–Hard (RPE 7-8)",
  threshold: "Hard (RPE 8-9)",
  interval: "Very Hard (RPE 9-10)",
};
