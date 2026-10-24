/**
 * Backwards-compatible facade over the canonical sport vocabulary.
 *
 * The provider sport tables live in each adapter: this module must not know a
 * provider's labels. `kindOfActivity` remains here because stored rows
 * are the engine's input, not a provider's.
 */
export {
  Sport,
  SPORTS,
  isRunSport,
  kindForSport,
  kindOfActivity,
} from '@/modules/activities/domain/value-object/Sport.ts'
