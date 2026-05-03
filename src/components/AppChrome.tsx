"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Persistent shell around every route: brand header, top tab nav, conditional
// footer. Mirrors the original App.tsx layout one-to-one, but uses
// `usePathname()` to figure out which tab is active instead of local state.
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The graph view is the only route that runs full-bleed with no footer.
  const isGraph = pathname === "/graph" || pathname.startsWith("/graph/");

  function isActive(href: string) {
    if (href === "/") {
      // Root is the Browse landing — also match /browse so the Browse tab
      // stays highlighted when users hit that legacy URL directly.
      return pathname === "/" || pathname === "/browse" || pathname.startsWith("/browse/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">वंश · Vamsha</h1>
          <p className="app-subtitle">Family History & Heritage Tracker</p>
          <p className="app-credit">
            <span className="app-credit-label">Crafted by</span>
            <span className="app-credit-name">Akshay Nimbal</span>
          </p>
        </div>
      </header>

      <nav className="app-nav">
        <Link
          href="/"
          className={`nav-tab ${isActive("/") ? "active" : ""}`}
        >
          <span className="nav-icon">◉</span>
          Browse Families
        </Link>
        <Link
          href="/graph"
          className={`nav-tab ${isActive("/graph") ? "active" : ""}`}
        >
          <span className="nav-icon">✦</span>
          Family Graph
        </Link>
        <Link
          href="/add"
          className={`nav-tab ${isActive("/add") ? "active" : ""}`}
        >
          <span className="nav-icon">+</span>
          Add Member
        </Link>
        <Link
          href="/paths"
          className={`nav-tab ${isActive("/paths") ? "active" : ""}`}
        >
          <span className="nav-icon">⇄</span>
          Find Relations
        </Link>
      </nav>

      <main className={`app-main ${isGraph ? "app-main-graph" : ""}`}>
        {children}
      </main>

      {!isGraph && (
        <footer className="app-footer">
          <p>
            Vamsha — Preserving family history for generations to come.
            <br />
            <small>
              Data stored as a graph to capture the rich, interconnected
              relationships across families.
            </small>
          </p>
          <p className="app-footer-credit">
            Crafted with care by <strong>Akshay Nimbal</strong>
          </p>
        </footer>
      )}
    </div>
  );
}
