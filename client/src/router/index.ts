// Views are loaded per route (dynamic import) so the initial chunk stays the app
// shell — vue, router, i18n, sentry — and each feature is fetched on the
// navigation that needs it instead of shipping every page up front.
export default [
  {
    path: '/',
    component: () => import('@/features/landing/views/LandingView.vue'),
    meta: { public: true },
  },
  {
    path: '/login',
    component: () => import('@/features/auth/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/plan',
    component: () => import('@/features/training-plan/views/TrainingPlanView.vue'),
  },
  {
    path: '/workout',
    component: () => import('@/features/today/views/TodayWorkoutView.vue'),
  },
  {
    path: '/activities',
    component: () => import('@/features/activities/views/ActivitiesView.vue'),
  },
  {
    path: '/activities/:id',
    component: () => import('@/features/activities/views/ActivityDetailView.vue'),
  },
  {
    path: '/progress',
    component: () => import('@/features/progress/views/ProgressView.vue'),
  },
  {
    path: '/goals',
    component: () => import('@/features/goals/views/GoalsView.vue'),
  },
  {
    path: '/settings',
    component: () => import('@/features/settings/views/SettingsView.vue'),
  },
]
