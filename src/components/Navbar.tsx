"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import Logo from "@/components/Logo";

function NavLink({
  href,
  label,
  active,
  external,
  onClick,
  compact = false,
}: {
  href: string;
  label: string;
  active: boolean;
  external?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const className = compact
    ? `flex items-center h-[44px] px-4 text-[13px] font-medium border-l-[3px] mono uppercase tracking-[0.1em] transition-colors ${
        active
          ? "text-[var(--y)] border-[var(--y)] bg-[#111]"
          : "text-white border-transparent hover:text-[var(--y)] hover:bg-[#111]"
      }`
    : `mono relative flex items-center h-[56px] px-4 text-[12px] font-semibold tracking-[0.12em] uppercase transition-colors ${
        active ? "text-[var(--y)]" : "text-white hover:text-[var(--y)]"
      }`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {label}
      {!compact && active && (
        <span className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: "var(--y)" }} />
      )}
    </Link>
  );
}

export default function Navbar() {
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || (pathname?.startsWith("/market") ?? false);
    return pathname?.startsWith(href) ?? false;
  };

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  return (
    <>
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 h-[56px]"
        style={{ background: "var(--k)", borderBottom: "2px solid var(--k)" }}
      >
        <Link href="/" className="flex items-center shrink-0">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center h-[56px] gap-1 absolute left-1/2 -translate-x-1/2">
          <NavLink href="/" label="Markets" active={isActive("/")} />
          <NavLink href="/portfolio" label="Portfolio" active={isActive("/portfolio")} />
          <NavLink href="/leaderboard" label="Leaderboard" active={isActive("/leaderboard")} />
          {isAdmin && <NavLink href="/admin" label="Admin" active={isActive("/admin")} />}
          <NavLink href="/docs" label="Docs" active={isActive("/docs")} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "icon" }}
            showBalance={{ smallScreen: false, largeScreen: false }}
          />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex items-center justify-center h-[40px] w-[40px] text-white hover:text-[var(--y)] transition-colors"
            style={{ border: "2px solid var(--y)", background: "transparent" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 top-[56px] z-40 bg-black/70 md:hidden"
            onClick={closeMenu}
            aria-hidden
          />
          <div
            className="fixed inset-x-0 top-[56px] z-50 md:hidden"
            style={{ background: "var(--k)", borderBottom: "2px solid var(--y)" }}
          >
            <nav className="flex flex-col">
              <NavLink href="/" label="Markets" active={isActive("/")} onClick={closeMenu} compact />
              <NavLink href="/portfolio" label="Portfolio" active={isActive("/portfolio")} onClick={closeMenu} compact />
              <NavLink href="/leaderboard" label="Leaderboard" active={isActive("/leaderboard")} onClick={closeMenu} compact />
              {isAdmin && (
                <NavLink href="/admin" label="Admin" active={isActive("/admin")} onClick={closeMenu} compact />
              )}
              <NavLink href="/docs" label="Docs" active={isActive("/docs")} onClick={closeMenu} compact />
            </nav>
          </div>
        </>
      )}
    </>
  );
}
