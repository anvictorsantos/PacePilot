/** Local-hour windows, idempotent per calendar day via the stored key. */
export function reminderWindow(hour: number): boolean {
  return hour >= 7 && hour <= 9
}

export function summaryWindow(hour: number): boolean {
  return hour >= 18 && hour <= 21
}

export function dueOn(lastSentKey: string | null | undefined, dateKey: string): boolean {
  return lastSentKey !== dateKey
}
