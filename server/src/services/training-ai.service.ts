// Training AI service — sends structured prompts to OpenRouter and returns
// validated recommendations/explanations. The deterministic training engine
// remains authoritative; AI output is always validated against the decision
// hierarchy before any suggestion is applied.

import { z } from 'zod'
import { OpenRouterClient, OpenRouterMessage } from './openrouter-client.ts'
import { calcTrainingState } from './training.service.ts'
import { getRequestContext } from './context.service.ts'
import type { ContextSchema } from './context.service.ts'

const AIResponseSchema = z.object({
  weekExplanations: z.array(z.string()).length(7),
  suggestions: z
    .array(
      z.object({
        dayIndex: z.number().int().min(0).max(6),
        suggestedType: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  confidence: z.number().optional(),
})

type AIResponse = z.infer<typeof AIResponseSchema>

// Minimal training state shape needed for the prompt — avoids circular deps
// on plan.service.ts types.
interface PromptTrainingState {
  weekly_distance_km: number
  runs_last_7_days: number
  long_run_km: number
  hard_sessions_last_7_days: number
  trend: string
  fatigue_signals: string[]
}

// Minimal goal shape needed for the prompt.
interface PromptGoal {
  goal_type: string
  goal_date?: string | null
  days_per_week?: number
  preferred_days?: string[]
  constraints?: string[]
}

// Minimal activity summary shape.
interface PromptActivity {
  date: string
  workout_type: string
  distance_km?: number | null
  avg_hr?: number | null
  avg_pace_sec_km?: number | null
}

// Minimal feedback summary shape.
interface PromptFeedback {
  date: string
  status: string
  rpe?: number | null
}

const WORKOUT_TYPE_ENUMS = new Set([
  'recovery', 'easy', 'long', 'steady', 'tempo', 'threshold', 'interval',
])

export interface TrainingAIService {
  getRecommendations: (session: { athleteId?: string }) => Promise<{
    success: boolean
    explanations?: string[]
    suggestions?: ReadonlyArray<{
      dayIndex: number
      suggestedType?: string
      reason?: string
    }>
    confidence?: number
    error?: string
  }>
}

export class TrainingAIServiceImpl implements TrainingAIService {
  private client: OpenRouterClient

  constructor(config: {
    apiKey: string
    model: string
    baseUrl: string
    timeoutMs: number
    enabled: boolean
  }) {
    this.client = new OpenRouterClient({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      enabled: config.enabled,
    })
  }

  async getRecommendations(session: { athleteId?: string }) {
    // Load authoritative context
    const ctx = await getRequestContext(session)

    if (ctx.unauthorized) {
      return { success: false, error: 'Athlete not authenticated' }
    }

    if (!ctx.goal) {
      return { success: false, error: 'No goal configured for athlete' }
    }

    const state = calcTrainingState(ctx.activities)

    // Build the prompt context
    const prompt = this.buildPrompt(ctx, state)

    const result = await this.client.chat([prompt])

    if (!result.success) {
      return { success: false, error: result.error.message }
    }

    const raw = result.response.choices[0]?.message?.content
    if (!raw) {
      return { success: false, error: 'Empty response from OpenRouter' }
    }

    try {
      const parsed = AIResponseSchema.parse(JSON.parse(raw))
      return {
        success: true,
        explanations: parsed.weekExplanations,
        suggestions: parsed.suggestions,
        confidence: parsed.confidence,
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to parse AI response: ${(err as Error).message}`,
      }
    }
  }

  private buildPrompt(
    ctx: ContextSchema,
    state: ReturnType<typeof calcTrainingState>
  ): OpenRouterMessage {
    const { goal, zones, activities, feedbacks } = ctx
    const today = new Date()
    const goalDate = goal?.goal_date ? new Date(goal.goal_date) : null
    const daysUntilGoal = goalDate
      ? Math.ceil((goalDate.getTime() - today.getTime()) / 86400000)
      : Infinity
    const isTaper = daysUntilGoal >= 0 && daysUntilGoal <= 7
    const isDeload = daysUntilGoal > 7 && daysUntilGoal <= 14

    // Summarize recent activities (last 5)
    const recent = [...activities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((a): PromptActivity => ({
        date: new Date(a.date).toISOString().slice(0, 10),
        workout_type: a.workout_type,
        distance_km: a.distance_km ?? null,
        avg_hr: a.avg_hr ?? null,
        avg_pace_sec_km: a.avg_pace_sec_km ?? null,
      }))

    // Summarize feedback (last 7 days)
    const sevenAgo = new Date(Date.now() - 7 * 86400000)
    const recentFeedbacks = feedbacks
      ? [...feedbacks]
          .filter(
            (f) => new Date(f.date).getTime() >= sevenAgo.getTime()
          )
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) ||
          []
      : [] as PromptFeedback[]

    // Goal label map
    const goalLabelMap: Record<string, string> = {
      general_fitness: 'General Fitness',
      5K: '5K',
      10K: '10K',
      half_marathon: 'Half Marathon',
      marathon: 'Marathon',
      distance_completion: 'Distance Completion',
      maintain: 'Maintain Fitness',
    }
    const goalLabel = goalLabelMap[goal.goal_type] || goal.goal_type

    // Training state summary fields for the prompt
    const weeklyDist = +state.weekly.distance7.toFixed(1)
    const runs7 = state.weekly.runs7
    const longRun7Km = +state.weekly.longRun7.toFixed(1)
    const hardSessions7 = state.weekly.hardSessions7
    const trend = state.trend
    const fatigueSignals = state.fatigueSignals.join(', ') || 'none'

    // Preferred days
    const preferredDays = goal.preferred_days || ['Tuesday', 'Thursday', 'Saturday', 'Sunday']

    // Activities summary
    const activitiesSummary = recent.length
      ? recent
          .map(
            (a) =>
              `- ${new Date(a.date).toLocaleDateString()}: ${
                a.workout_type
              } ${a.distance_km ?? 0}km${
                a.avg_hr ? `, HR${a.avg_hr}bpm` : ''
              }${a.avg_pace_sec_km
                ? `, pace${Math.round(a.avg_pace_sec_km / 60)}:${
                    String(Math.round(a.avg_pace_sec_km) % 60)
                      .padStart(2, '0')}/km`
                : ''
          })
          .join('\n')
      : 'no recent activities'

    // Feedback summary
    const feedbackSummary = recentFeedbacks.length
      ? recentFeedbacks
          .slice(0, 7)
          .map((f) => ({
            date: new Date(f.date).toISOString().slice(0, 10),
            status: f.status,
            rpe: f.rpe ?? null,
          }))
          .map((f) => `- ${f.date}: status=${f.status}${
            f.rpe != null ? `, rpe=${f.rpe}` : ''
          }`)
          .join('\n')
      : 'none'

    // System prompt for the AI
    const systemPrompt = `You are an endurance training coach AI. Your purpose is to provide contextual explanations and optional suggestions for a personalized weekly training plan. The deterministic training engine below generates the actual schedule; your role is to enhance it with natural-language reasoning and safe, optional adjustments.

THE ATHLETE PROFILE:
- Goal: ${goalLabel} (target date: ${goalDate?.toISOString().slice(0, 10) || 'not set'})
- Training days per week: ${goal.days_per_week ?? 4}
- Preferred days: ${preferredDays.join(', ') || 'none specified'}
- Days until goal: ${daysUntilGoal === Infinity ? 'open-ended' : daysUntilGoal} ${isTaper ? '(taper window)' : isDeload ? '(deload window)' : ''}
- Training trend: ${trend}
- Fatigue signals: ${fatigueSignals.length > 0 ? fatigueSignals : 'none'}
- Weekly volume: ${weeklyDist}km over 7 days (${runs7} runs)
- Long run: ${longRun7Km}km
- Hard sessions last 7d: ${hardSessions7}

RECENT ACTIVITY SUMMARY:
${activitiesSummary}

FEEDBACK (last 7 days):
${feedbackSummary}

THE DETERMINISTIC WEEKLY PLAN (do not override safety constraints):
The engine generates a Mon–Sun schedule respecting:
  • Safety first: fatigue, recovery, consecutive hard days
  • Goal-specific progression
  • Sustainable volume: next long run ≤ recent long run + 2km
  • Intensity distribution
  • Taper: 60% long run within 7d of goal, 80% within 7–14d
  • Skip cascades: skipped workouts → next preferred slot → recovery

YOUR TASK:
Provide two things:
1. weekExplanations: Seven concise sentences (one per Mon–Sun) explaining why the deterministic plan has each workout type selected. Keep each to ≤ 20 words. If a day is rest/recovery, explain why (e.g., "recovery after hard Tuesday"). If the day follows the normal progression, describe the phase (e.g., "building long-run progression toward marathon goal").
2. suggestions: Optional. For up to 3 days, suggest a workout type change and reason. Only suggest if the change is consistent with the decision hierarchy (safety > goal > consistency > volume > intensity > specificity > performance). Never suggest violating fatigue signals, long-run progression limits, or taper constraints. If suggesting a type change, the reason must reference a specific constraint or context from above.
3. confidence: Your confidence in these explanations/suggestions (0–1).

RESPONSE FORMAT (JSON only, no prose outside the fields below):
{
  "weekExplanations": ["explanation for Mon", "explanation for Tue", ..., "explanation for Sun"],
  "suggestions": [{"dayIndex": 0, "suggestedType": "recovery", "reason": "recovery after hard session on Wed"}, ...],
  "confidence": 0.85
}

Do not include any other fields. Do not include the plan itself — the deterministic engine owns the schedule. Do not suggest workout types that conflict with safety constraints, long-run progression limits, or taper rules.`

    const userPrompt = `Generate the AI response for this athlete's training context. The deterministic plan has already been generated. Provide weekExplanations and optional suggestions as specified above.`

    return {
      role: 'system',
      content: systemPrompt,
    }
  }
}