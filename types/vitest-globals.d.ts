/**
 * vitest.config.ts sets `globals: true`, but nothing told TypeScript. Every
 * test file therefore reported "Cannot find name 'describe'/'it'/'expect'" —
 * 238 errors, which made `tsc --noEmit` unusable as a local gate and let 42
 * genuine type errors accumulate behind the noise.
 *
 * It was invisible in CI because `next build` filters __tests__ and *.test.*
 * out of its own type check (see runTypeCheck's regexIgnoredFile), so the
 * build stayed green throughout.
 *
 * A reference file rather than a `types` array in tsconfig.json: setting
 * `types` switches off automatic inclusion of every other @types package,
 * which would take React and Node's globals with it.
 */
/// <reference types="vitest/globals" />
