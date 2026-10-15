import ActivitiesView from '@/features/activities/views/ActivitiesView.vue'
import ActivityDetailView from '@/features/activities/views/ActivityDetailView.vue'
import LoginView from '@/features/auth/views/LoginView.vue'
import GoalsView from '@/features/goals/views/GoalsView.vue'
import LandingView from '@/features/landing/views/LandingView.vue'
import ProgressView from '@/features/progress/views/ProgressView.vue'
import SettingsView from '@/features/settings/views/SettingsView.vue'
import StravaConnectView from '@/features/strava/views/StravaConnectView.vue'
import TodayWorkoutView from '@/features/today/views/TodayWorkoutView.vue'
import TrainingPlanView from '@/features/training-plan/views/TrainingPlanView.vue'

export default [
  { path: '/', component: LandingView, meta: { public: true, label: 'PacePilot' } },
  { path: '/login', component: LoginView, meta: { public: true, label: 'Sign in' } },
  { path: '/plan', component: TrainingPlanView, meta: { label: 'Training Plan' } },
  { path: '/workout', component: TodayWorkoutView, meta: { label: "Today's Workout" } },
  { path: '/activities', component: ActivitiesView, meta: { label: 'Activities' } },
  { path: '/activities/:id', component: ActivityDetailView, meta: { label: 'Activity' } },
  { path: '/progress', component: ProgressView, meta: { label: 'Progress' } },
  { path: '/goals', component: GoalsView, meta: { label: 'Goals' } },
  { path: '/strava', component: StravaConnectView, meta: { label: 'Strava' } },
  { path: '/settings', component: SettingsView, meta: { label: 'Settings' } },
]
