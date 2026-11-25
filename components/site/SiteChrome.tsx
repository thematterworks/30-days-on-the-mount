import Link from "next/link";

/** The mountain line, the brand's mark. */
export function MountainMark({ width = 44, className = "" }: { width?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/invite/mountain-line.png" alt="" width={width} style={{ width }} className={className} />;
}

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-3">
        <MountainMark width={42} />
        <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/85">30 Days on the Mount</span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-white/75 sm:flex">
        <Link href="/#how" className="hover:text-white">How it works</Link>
        <Link href="/#why" className="hover:text-white">Why it matters</Link>
        <Link href="/#begin" className="hover:text-white">Begin</Link>
      </nav>
    </header>
  );
}

/**
 * The footer on every public page. The operating company appears here, in
 * the small print, because the text-message program is registered under it
 * and every consent surface must name it (see the business-identity note).
 */
export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-20">
      <div className="flex flex-col gap-8 border-t border-white/15 pt-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <MountainMark width={36} className="opacity-80" />
          <span className="site-serif text-white/70">Thirty days in the words of Jesus.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/community-guidelines" className="hover:text-white">Community Guidelines</Link>
          <a href="mailto:30daysonthemount@gmail.com" className="hover:text-white">Contact</a>
        </nav>
      </div>
      <p className="mt-8 text-[11px] text-white/40">
        © {new Date().getFullYear()} 30 Days on the Mount, operated by The Matterworks LLC.
      </p>
    </footer>
  );
}

/** A long page to read: the terms, the privacy policy, the guidelines. */
export function LegalPage({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="site-legal relative z-10 mx-auto max-w-2xl px-6 pb-8 pt-10">
        <div className="site-eyebrow">Effective {effective}</div>
        <h1 className="mt-4">{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
