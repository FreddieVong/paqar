/**
 * The one line that says who operates Paqar and what Paqar is not.
 *
 * ── WHY THIS IS A COMPONENT ────────────────────────────────────────────────
 *
 * It was written out by hand in two places: Shell's footer, used by every
 * inner page, and the homepage's own footer. The homepage keeps a DIFFERENT
 * footer on purpose — it carries the SEO hub links (Harga Model, Pemeriksaan
 * Fizikal, Banding Insurans) that inner pages have no reason to repeat — so
 * the answer is not to force one footer onto both. It is to stop the LEGAL
 * line being one of the things that can differ.
 *
 * It differed immediately. The change naming TENTEC SDN BHD landed on Shell
 * and not on the homepage, so the operating company appeared on every page of
 * the site except the one nearly everybody lands on first. That is the exact
 * page where a buyer who paused at an unfamiliar name on the Billplz screen
 * would come looking.
 *
 * ── WHY THE OPERATOR IS NAMED AT ALL ───────────────────────────────────────
 *
 * Clicking pay leaves paqar.my for a Billplz page headed TENTEC SDN BHD, with
 * no logo, asking for bank credentials. An unfamiliar company name at the
 * moment money is due reads as a scam. Naming it here — and in the terms,
 * About and privacy notice — turns that surprise into a confirmation.
 *
 * The registration number and registered address are deliberately absent,
 * pending counsel. A wrong company number in a legal statement is worse than
 * an absent one.
 */
export function FooterLegal({ className = '' }: { className?: string }) {
  return (
    <p className={`font-body text-[12px] text-[#6B7280] leading-relaxed ${className}`}>
      © {new Date().getFullYear()} Paqar oleh TENTEC SDN BHD · Perkhidmatan pihak
      ketiga · Bukan platform rasmi kerajaan
    </p>
  )
}
