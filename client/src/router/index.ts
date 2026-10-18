// Views are loaded per route (dynamic import) so the initial chunk stays the app
// shell — vue, router, pinia, i18n, sentry — and each feature is fetched on the
// navigation that needs it instead of shipping every page up front.
export default [
  {
    path: '/',
    component: () => import('@/features/landing/views/LandingView.vue'),
    meta: { public: true, label: 'PacePilot' },
  },
  {
    path: '/login',
    component: () => import('@/features/auth/views/LoginView.vue'),
    meta: { public: true, label: 'Sign in' },
  },
  {
    path: '/plan',
    component: () => import('@/features/training-plan/views/TrainingPlanView.vue'),
    meta: { label: 'Training Plan' },
  },
  {
    path: '/workout',
    component: () => import('@/features/today/views/TodayWorkoutView.vue'),
    meta: { label: "Today's Workout" },
  },
  {
    path: '/activities',
    component: () => import('@/features/activities/views/ActivitiesView.vue'),
    meta: { label: 'Activities' },
  },
  {
    path: '/activities/:id',
    component: () => import('@/features/activities/views/ActivityDetailView.vue'),
    meta: { label: 'Activity' },
  },
  {
    path: '/progress',
    component: () => import('@/features/progress/views/ProgressView.vue'),
    meta: { label: 'Progress' },
  },
  {
    path: '/goals',
    component: () => import('@/features/goals/views/GoalsView.vue'),
    meta: { label: 'Goals' },
  },
  {
    path: '/strava',
    component: () => import('@/features/strava/views/StravaConnectView.vue'),
    meta: { label: 'Strava' },
  },
  {
    path: '/settings',
    component: () => import('@/features/settings/views/SettingsView.vue'),
    meta: { label: 'Settings' },
  },
]
