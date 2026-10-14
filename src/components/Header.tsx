"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight, UserRound, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
export default function Header() {
  const path = usePathname();
  const { user, openAuth, signOut } = useAuth();
  const [mobile, setMobile] = useState(false);
  return (
    <>
      <Link href="/catalog" className="announcement">
        <span className="announcement-copy">
          Thoughtfully selected. Beautifully served.
        </span>
        <span className="announcement-cta">
          Discover the 2026 Yanco collection
          <ArrowUpRight size={13} aria-hidden="true" />
        </span>
      </Link>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Yanco home">
            <Image
              src="/yanco-logo.png"
              alt="Yanco"
              width={148}
              height={71}
              className="logo"
            />
            <span>DINNERWARE SELECTOR</span>
          </Link>
          <nav
            id="main-navigation"
            aria-label="Main navigation"
            className={mobile ? "main-nav open" : "main-nav"}
          >
            {[
              ["/", "Find your dinnerware"],
              ["/catalog", "The collection"],
              ["/studio", "Plating studio"],
              ["/workspace", "My workspace"],
            ].map(([href, label]) => (
              <Link
                onClick={() => setMobile(false)}
                key={href}
                href={href}
                className={path === href ? "active" : ""}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link className="account-link" href="/workspace">
                  <UserRound size={17} />
                  <span>{user.email?.split("@")[0]}</span>
                </Link>
                <button
                  className="icon-button"
                  onClick={signOut}
                  aria-label="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button className="account-link" onClick={openAuth}>
                <UserRound size={17} />
                <span>Sign in</span>
              </button>
            )}
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-expanded={mobile}
              aria-controls="main-navigation"
              aria-label={mobile ? "Close menu" : "Open menu"}
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
