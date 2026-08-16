# TEMPORARY — DO NOT MERGE

This branch exists for ONE purpose: to run `pnpm seo:check` against fresh
production build output.

`scripts/seo-check.mjs` reads `.next/server/app`, so it needs a real build. The
build cannot run on the development machine — `next build` is OOM-killed there,
and is killed identically on untouched `origin/main`, so this is an environment
limit and not a property of the change. Vercel's builder has the memory, so the
check is run there by overriding the build command.

`vercel.json` here carries:

    "buildCommand": "pnpm build && pnpm seo:check"

A red deployment means `seo:check` failed and the gate is not met. A green one
means the build AND the SEO/JSON-LD checks both passed against fresh output.

**This branch and its vercel.json override must never be merged.** Delete the
branch once the gate is recorded. The product branch it was cut from is
`product/plate-first-decision`, whose own vercel.json is unmodified.
