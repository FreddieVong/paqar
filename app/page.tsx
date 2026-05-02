import { Nav }       from '@/components/layout/Nav'
import { Shell }     from '@/components/layout/Shell'
import { CheckForm } from '@/components/check/CheckForm'

export default function HomePage() {
  return (
    <>
      <Nav />
      <Shell>
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Check your car.
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Saman, blacklist &amp; document status in one place.
          </p>
        </div>
        <CheckForm />
      </Shell>
    </>
  )
}
