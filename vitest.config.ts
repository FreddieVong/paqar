import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    /**
     * Other checkouts are not this checkout's test suite.
     *
     * `.claude/worktrees/` holds full working copies of other branches, each
     * with its own __tests__ directory. Vitest's default include swept all of
     * them, so `npm test` reported 147 failing files and 512 failing tests
     * that belong to unrelated, half-finished branches — drowning this
     * branch's real results and making a green run impossible to recognise.
     *
     * Excluded rather than deleted: the worktrees are live workspaces. Run
     * their tests from inside them, where their own config applies.
     */
    /**
     * Async assertions must not encode an assumption about machine speed.
     *
     * @testing-library's findBy* defaults to a 1000ms timeout. With 130+ test
     * files running in parallel, a saturated box exceeds that for reasons that
     * have nothing to do with the code under test — which produced an
     * intermittent failure in proof-before-paywall.test.tsx that moved between
     * assertions on each run and passed 29/29 in isolation every time.
     *
     * Raising the ceiling is not masking a defect: a genuinely broken assertion
     * fails at 5s exactly as it fails at 1s, while a correct one that needed
     * 1.2s under load now passes deterministically. The real resource leak that
     * was ALSO contributing (an uncancelled poll timer in FreePriceEvidence)
     * was fixed separately and is pinned by __tests__/components/poll-cleanup.
     */
    testTimeout: 15_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.claude/worktrees/**',
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
