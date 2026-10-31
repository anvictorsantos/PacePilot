// Facade over the canonical sport vocabulary. Provider sport tables stay in each
// adapter; `kindOfActivity` lives here because stored rows are the engine's input.
export {
  Sport,
  SPORTS,
  isRunSport,
  kindForSport,
  kindOfActivity,
} from '@/modules/activities/domain/value-object/Sport.ts'
