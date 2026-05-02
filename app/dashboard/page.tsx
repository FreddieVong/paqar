import { Nav }   from '@/components/layout/Nav'
import { Shell } from '@/components/layout/Shell'

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-8 text-center">
          <p className="text-slate-400 text-sm">Dashboard coming in Feature 3.</p>
        </div>
      </Shell>
    </>
  )
}
