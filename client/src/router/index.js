import DashboardView from '@/views/DashboardView.vue'
import TrainingPlanView from '@/views/TrainingPlanView.vue'
import TodayWorkoutView from '@/views/TodayWorkoutView.vue'
import ActivitiesView from '@/views/ActivitiesView.vue'
import ActivityDetailView from '@/views/ActivityDetailView.vue'
import ProgressView from '@/views/ProgressView.vue'
import GoalsView from '@/views/GoalsView.vue'
import StravaConnectView from '@/views/StravaConnectView.vue'
import SettingsView from '@/views/SettingsView.vue'

export default [
  { path: '/', component: DashboardView, meta: { label: 'Dashboard' } },
  { path: '/plan', component: TrainingPlanView, meta: { label: 'Training Plan' } },
  { path: '/workout', component: TodayWorkoutView, meta: { label: "Today's Workout" } },
  { path: '/activities', component: ActivitiesView, meta: { label: 'Activities' } },
  { path: '/activities/:id', component: ActivityDetailView, meta: { label: 'Activity' } },
  { path: '/progress', component: ProgressView, meta: { label: 'Progress' } },
  { path: '/goals', component: GoalsView, meta: { label: 'Goals' } },
  { path: '/strava', component: StravaConnectView, meta: { label: 'Strava' } },
  { path: '/settings', component: SettingsView, meta: { label: 'Settings' } },
]
