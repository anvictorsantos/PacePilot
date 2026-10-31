// Views load per route so the initial chunk stays the app shell; each feature is
// fetched on the navigation that needs it.
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
    path: '/forgot-password',
    component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
    meta: { public: true },
  },
  {
    path: '/reset-password',
    component: () => import('@/features/auth/views/ResetPasswordView.vue'),
    meta: { public: true },
  },
  {
    path: '/verify-email',
    component: () => import('@/features/auth/views/VerifyEmailView.vue'),
    meta: { public: true },
  },
  {
    path: '/connect',
    component: () => import('@/features/auth/views/ConnectProviderView.vue'),
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
