/** Local-date keys — local YYYY-MM-DD, never UTC toISOString (shifts at midnight in +/- TZ). (Pass 7) */

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toLocalDateKey(v) {
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return localDateKey(d);
  } catch {
    return String(v).slice(0, 10);
  }
}
