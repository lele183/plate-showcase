import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <span className="footer-wordmark">YANCO</span>
          <p>
            Made for the moments
            <br />
            around the table.
          </p>
        </div>
        <div>
          <span className="eyebrow">EXPLORE</span>
          <Link href="/">Dinnerware selector</Link>
          <Link href="/catalog">2026 collection</Link>
          <Link href="/studio">Plating studio</Link>
        </div>
        <div>
          <span className="eyebrow">LET’S SET YOUR TABLE</span>
          <p>Explore every piece in our latest catalog.</p>
          <a href="/catalog/yanco-2026.pdf" target="_blank" rel="noreferrer">
            View the full catalog <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Yanco International Inc.</span>
        <span>Budget tiers are estimates · 3D views are illustrative</span>
      </div>
    </footer>
  );
}
