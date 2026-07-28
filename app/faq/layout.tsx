import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

/**
 * Wraps /faq and every /faq/* guide.
 *
 * The guides previously rendered a bare <div className="max-w-3xl …"> with no
 * Nav and no Shell, so they shipped with no site navigation and no footer —
 * a crawler landing on one saw a single outbound link, and a reader had no
 * way back into the site. They opted out of Shell because its default
 * max-w-lg squeezes their multi-column tables; Shell now takes width="wide"
 * (max-w-3xl) so they keep their room and still get the footer's internal
 * links.
 *
 * Doing this as a route layout rather than editing eight pages keeps the
 * chrome in one place — a future guide gets it for free.
 */
export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <Shell width="wide">{children}</Shell>
    </>
  )
}
