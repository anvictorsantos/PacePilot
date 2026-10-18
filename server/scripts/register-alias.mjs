/**
 * Registers the `@/` alias hook for this process. Loaded with
 * `node --import ./scripts/register-alias.mjs …` (see package.json).
 */
import { register } from 'node:module'

register(new URL('./alias-resolve.mjs', import.meta.url))
