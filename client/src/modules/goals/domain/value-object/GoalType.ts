// Wire strings the server expects (CONTEXT.md §Goal); every label is an i18n key
// derived from the member, so no surface re-declares a goal name.
export enum GoalType {
  GeneralFitness = 'general_fitness',
  Maintain = 'maintain',
  DistanceCompletion = 'distance_completion',
  FiveK = '5K',
  TenK = '10K',
  HalfMarathon = 'half_marathon',
  Marathon = 'marathon',
}

export const GOAL_TYPES: readonly GoalType[] = Object.values(GoalType)

export function toGoalType(value: unknown): GoalType | null {
  const key = String(value ?? '')
  return (GOAL_TYPES as readonly string[]).includes(key) ? (key as GoalType) : null
}

const GOAL_KEYS: Record<GoalType, string> = {
  [GoalType.GeneralFitness]: 'general_fitness',
  [GoalType.Maintain]: 'maintain',
  [GoalType.DistanceCompletion]: 'distance_completion',
  [GoalType.FiveK]: '5k',
  [GoalType.TenK]: '10k',
  [GoalType.HalfMarathon]: 'half_marathon',
  [GoalType.Marathon]: 'marathon',
}

/** Short name — "Half Marathon" (`ui.goal.*`). */
export function goalLabelKey(value: unknown): string {
  const type = toGoalType(value)
  return type ? `ui.goal.${GOAL_KEYS[type]}` : 'ui.goal.fallback'
}

/** Progress-card copy — "Half Marathon Completion" (`ui.goal_completion.*`). */
export function goalCompletionLabelKey(value: unknown): string {
  const type = toGoalType(value)
  return type ? `ui.goal_completion.${GOAL_KEYS[type]}` : 'ui.goal.fallback'
}

/** Training-plan header copy — "Half Marathon Training Plan" (`ui.goal_label.*`). */
export function goalPlanLabelKey(value: unknown): string {
  const type = toGoalType(value)
  return type ? `ui.goal_label.${GOAL_KEYS[type]}` : 'ui.goal_label.fallback'
}

/** The long-run distance the programme builds toward, by goal. */
export function goalLongRunTargetKm(value: unknown): number {
  const type = toGoalType(value)
  if (type === GoalType.Marathon) return 20
  if (type === GoalType.HalfMarathon) return 14
  return 10
}

/** Options for the goal form's target select, in display order. */
export const GOAL_OPTIONS: ReadonlyArray<{ value: GoalType; labelKey: string }> = [
  GoalType.GeneralFitness,
  GoalType.FiveK,
  GoalType.TenK,
  GoalType.HalfMarathon,
  GoalType.Marathon,
  GoalType.DistanceCompletion,
  GoalType.Maintain,
].map((value) => ({ value, labelKey: goalLabelKey(value) }))
