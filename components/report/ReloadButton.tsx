'use client'

// Smallest possible client boundary: BuyerReportContent is a server component
// and must stay one. This exists only because window.location.reload() needs
// the client.
//
// It replaces an `<a href="">` that looked like a reload control but was not
// one — an empty href resolves to the current URL, so the browser treated it
// as an in-page navigation and, with no onClick, nothing reloaded.

export function ReloadButton({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309] focus-visible:ring-offset-2 rounded-[4px] ${className}`}
    >
      {children}
    </button>
  )
}
