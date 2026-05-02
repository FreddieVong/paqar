import Link from 'next/link'

export function Nav() {
  return (
    <nav className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-sm" />
        </div>
        <span className="font-extrabold text-slate-900 tracking-tight">Paqar</span>
      </Link>
      <Link href="/auth" className="text-sm text-teal-700 font-semibold hover:underline">
        Sign in
      </Link>
    </nav>
  )
}
