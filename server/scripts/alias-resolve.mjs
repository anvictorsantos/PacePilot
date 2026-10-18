/**
 * Resolves the `@/` alias for Node itself.
 *
 * TypeScript and esbuild read `paths` from tsconfig.json, but Node runs
 * `src/index.ts` directly (type stripping) and its ESM resolver knows nothing
 * about tsconfig. This hook teaches it the one mapping, so the source can use
 * `@/…` everywhere without a bundler in the loop.
 *
 * Registered by `scripts/register-alias.mjs`, which `dev`, `start` and `test`
 * load with `--import`.
 */
const SRC = new URL('../src/', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@' || specifier.startsWith('@/')) {
    const target = new URL(specifier.slice(2), SRC).href
    return nextResolve(target, context)
  }
  return nextResolve(specifier, context)
}
