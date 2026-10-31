// `{ currentWeek, totalWeeks }` from `GET /api/plan/week` (CONTEXT.md §WeekMeta);
// `currentWeek` is weeks since Program Start, capped at `totalWeeks`.
export interface WeekMetaPrimitives {
  currentWeek?: number | null
  totalWeeks?: number | null
}

export class WeekMeta {
  readonly currentWeek: number
  readonly totalWeeks: number

  private constructor(currentWeek: number, totalWeeks: number) {
    this.currentWeek = currentWeek
    this.totalWeeks = totalWeeks
  }

  static from(primitives: WeekMetaPrimitives | null | undefined): WeekMeta {
    return new WeekMeta(Number(primitives?.currentWeek ?? 0), Number(primitives?.totalWeeks ?? 0))
  }

  progressPct(): number {
    if (!this.totalWeeks) return 0
    return Math.round((this.currentWeek / this.totalWeeks) * 100)
  }

  nextWeek(): number {
    if (!this.totalWeeks) return this.currentWeek + 1
    return Math.min(this.totalWeeks, this.currentWeek + 1)
  }

  isComplete(): boolean {
    return this.totalWeeks > 0 && this.currentWeek >= this.totalWeeks
  }

  equals(other: WeekMeta): boolean {
    return other.currentWeek === this.currentWeek && other.totalWeeks === this.totalWeeks
  }

  toPrimitives(): WeekMetaPrimitives {
    return { currentWeek: this.currentWeek, totalWeeks: this.totalWeeks }
  }
}
