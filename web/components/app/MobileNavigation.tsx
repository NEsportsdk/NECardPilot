"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  isMobileMoreNavigationActive,
  isMobileNavigationItemActive,
  mobileNavigationPathnameFromSegment,
  mobileMoreNavigation,
  mobilePrimaryNavigation,
  shouldShowMobileNavigation,
  type MobileNavigationIcon,
} from "@/lib/navigation/mobileNavigation";

function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getConnectivitySnapshot() {
  return navigator.onLine;
}

function getServerConnectivitySnapshot() {
  return true;
}

function NavigationIcon({ icon }: { icon: MobileNavigationIcon }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    height: 22,
    viewBox: "0 0 24 24",
    width: 22,
  } as const;

  switch (icon) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="M3.5 10.8 12 3.5l8.5 7.3" />
          <path d="M5.7 9.5v10.2h12.6V9.5M9.5 19.7v-6h5v6" />
        </svg>
      );
    case "cards":
      return (
        <svg {...commonProps}>
          <rect height="14" rx="2" transform="rotate(-5 11 12)" width="10" x="6" y="5" />
          <path d="m10.2 10.2 1.5-1.7 2.5 2.8M8.3 16.1l8-.7" />
        </svg>
      );
    case "scanner":
      return (
        <svg {...commonProps}>
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M8.5 12h7" />
        </svg>
      );
    case "collections":
      return (
        <svg {...commonProps}>
          <rect height="11" rx="2" width="8" x="4" y="7" />
          <rect height="11" rx="2" width="8" x="12" y="5" />
        </svg>
      );
    case "grading":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 15 6l3.9.2.9 3.8 1.9 3.4-3.3 2.1-1.6 3.5-3.8-.6L12 21l-2.6-1.9-3.8.6-1.6-3.5-3.3-2.1L2.6 10l.9-3.8L7.4 6 12 3.5Z" />
          <path d="m8.6 12.2 2.1 2.1 4.7-5" />
        </svg>
      );
    case "cardshow":
      return (
        <svg {...commonProps}>
          <path d="M4 9h16M5.5 9l1-5h11l1 5M6 9v11h12V9" />
          <path d="M9 20v-6h6v6M3 9a3 3 0 0 0 5 2.2A3 3 0 0 0 12 11a3 3 0 0 0 4 0 3 3 0 0 0 5-2" />
        </svg>
      );
    case "transactions":
      return (
        <svg {...commonProps}>
          <path d="M7 4v15m0 0-3-3m3 3 3-3M17 20V5m0 0-3 3m3-3 3 3" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...commonProps}>
          <path d="M4 19.5h16M6.5 17V11M12 17V5M17.5 17V8.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );
    case "more":
      return (
        <svg {...commonProps}>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      );
  }
}

export default function MobileNavigation() {
  const pathname = mobileNavigationPathnameFromSegment(
    useSelectedLayoutSegment()
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getServerConnectivitySnapshot
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        moreButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = sheetRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (!shouldShowMobileNavigation(pathname)) {
    return null;
  }

  const moreActive = isMobileMoreNavigationActive(pathname);

  function closeMenu() {
    setMenuOpen(false);
    moreButtonRef.current?.focus();
  }

  return (
    <div className="mobile-navigation-root">
      {!isOnline ? (
        <div className="connectivity-banner" role="status">
          <span aria-hidden="true" />
          You&apos;re offline. Some data may be unavailable.
        </div>
      ) : null}

      {menuOpen ? (
        <>
          <button
            aria-label="Close more navigation"
            className="mobile-navigation-backdrop"
            onClick={closeMenu}
            type="button"
          />

          <section
            aria-labelledby="mobile-navigation-title"
            aria-modal="true"
            className="mobile-navigation-sheet"
            ref={sheetRef}
            role="dialog"
          >
            <header>
              <div>
                <p>Workspace</p>
                <h2 id="mobile-navigation-title">More from Vallective</h2>
              </div>

              <button
                aria-label="Close menu"
                className="sheet-close-button"
                onClick={closeMenu}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="more-navigation-grid">
              {mobileMoreNavigation.map((item) => {
                const active = isMobileNavigationItemActive(pathname, item);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`more-navigation-link ${
                      active ? "more-navigation-link-active" : ""
                    }`}
                    href={item.href}
                    key={item.label}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="more-navigation-icon">
                      <NavigationIcon icon={item.icon} />
                    </span>
                    <strong>{item.label}</strong>
                    <span aria-hidden="true" className="more-navigation-arrow">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      <div className="mobile-navigation-dock-shell">
        <nav className="mobile-navigation-dock" aria-label="Mobile navigation">
          {mobilePrimaryNavigation.map((item) => {
            const active = isMobileNavigationItemActive(pathname, item);
            const scanner = item.icon === "scanner";

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`mobile-navigation-link ${
                  active ? "mobile-navigation-link-active" : ""
                } ${scanner ? "mobile-navigation-link-scanner" : ""}`}
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                <span className="mobile-navigation-icon">
                  <NavigationIcon icon={item.icon} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className={`mobile-navigation-link ${
              moreActive || menuOpen ? "mobile-navigation-link-active" : ""
            }`}
            onClick={() => setMenuOpen((current) => !current)}
            ref={moreButtonRef}
            type="button"
          >
            <span className="mobile-navigation-icon">
              <NavigationIcon icon="more" />
            </span>
            <span>More</span>
          </button>
        </nav>
      </div>

      <style jsx global>{`
        .mobile-navigation-root {
          display: none;
        }

        @media (max-width: 620px) {
          body {
            padding-bottom: calc(82px + env(safe-area-inset-bottom));
          }

          .mobile-navigation-root {
            display: block;
          }

          .mobile-navigation-dock-shell {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 110;
            padding: 0 9px calc(8px + env(safe-area-inset-bottom));
            pointer-events: none;
          }

          .mobile-navigation-dock {
            min-height: 66px;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            align-items: end;
            gap: 2px;
            padding: 7px;
            border: 1px solid rgba(167, 139, 250, 0.2);
            border-radius: 21px;
            background: rgba(11, 14, 21, 0.94);
            box-shadow:
              0 20px 60px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.025) inset;
            backdrop-filter: blur(26px) saturate(1.25);
            pointer-events: auto;
          }

          .mobile-navigation-link {
            position: relative;
            min-width: 0;
            min-height: 51px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 4px 2px;
            border: 0;
            border-radius: 14px;
            background: transparent;
            color: #727b8e;
            font-size: 9px;
            font-weight: 750;
            line-height: 1;
            text-decoration: none;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-navigation-link::after {
            position: absolute;
            right: 26%;
            bottom: 1px;
            left: 26%;
            height: 2px;
            border-radius: 999px;
            background: transparent;
            content: "";
          }

          .mobile-navigation-link-active {
            color: #d8d2ff;
          }

          .mobile-navigation-link-active::after {
            background: #9589ff;
            box-shadow: 0 0 10px rgba(149, 137, 255, 0.7);
          }

          .mobile-navigation-icon {
            width: 28px;
            height: 28px;
            display: grid;
            place-items: center;
          }

          .mobile-navigation-icon svg,
          .more-navigation-icon svg {
            stroke: currentColor;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-width: 1.65;
          }

          .mobile-navigation-link-scanner {
            min-height: 62px;
            margin-top: -17px;
            color: #ffffff;
          }

          .mobile-navigation-link-scanner .mobile-navigation-icon {
            width: 48px;
            height: 48px;
            border: 1px solid rgba(196, 181, 253, 0.5);
            border-radius: 17px;
            background: linear-gradient(145deg, #9b82ff, #6552e8);
            box-shadow:
              0 13px 30px rgba(101, 82, 232, 0.38),
              0 0 0 5px rgba(10, 13, 20, 0.94);
          }

          .mobile-navigation-link-scanner::after {
            display: none;
          }

          .mobile-navigation-link:focus-visible,
          .sheet-close-button:focus-visible,
          .more-navigation-link:focus-visible {
            outline: 2px solid #a78bfa;
            outline-offset: 2px;
          }

          .mobile-navigation-backdrop {
            position: fixed;
            inset: 0;
            z-index: 100;
            width: 100%;
            border: 0;
            background: rgba(2, 4, 8, 0.76);
            backdrop-filter: blur(8px);
          }

          .mobile-navigation-sheet {
            position: fixed;
            right: 9px;
            bottom: calc(82px + env(safe-area-inset-bottom));
            left: 9px;
            z-index: 105;
            max-height: calc(100dvh - 112px - env(safe-area-inset-bottom));
            overflow-y: auto;
            overscroll-behavior: contain;
            padding: 21px;
            border: 1px solid rgba(167, 139, 250, 0.2);
            border-radius: 24px;
            background:
              radial-gradient(
                circle at 88% 0%,
                rgba(124, 92, 255, 0.16),
                transparent 42%
              ),
              #0e1119;
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.58);
          }

          .mobile-navigation-sheet header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
          }

          .mobile-navigation-sheet header p,
          .mobile-navigation-sheet header h2 {
            margin: 0;
          }

          .mobile-navigation-sheet header p {
            color: #9589ff;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .mobile-navigation-sheet header h2 {
            margin-top: 5px;
            color: #ffffff;
            font-size: 20px;
            letter-spacing: -0.035em;
          }

          .sheet-close-button {
            width: 40px;
            height: 40px;
            flex: 0 0 auto;
            border: 1px solid rgba(148, 163, 184, 0.12);
            border-radius: 13px;
            background: rgba(255, 255, 255, 0.04);
            color: #a9b0be;
            font-size: 24px;
            line-height: 1;
            cursor: pointer;
          }

          .more-navigation-grid {
            display: grid;
            gap: 8px;
          }

          .more-navigation-link {
            min-height: 58px;
            display: grid;
            grid-template-columns: 40px 1fr auto;
            align-items: center;
            gap: 12px;
            padding: 8px 13px 8px 9px;
            border: 1px solid rgba(148, 163, 184, 0.1);
            border-radius: 15px;
            background: rgba(255, 255, 255, 0.025);
            color: #858ea1;
            text-decoration: none;
          }

          .more-navigation-link-active {
            border-color: rgba(167, 139, 250, 0.28);
            background: rgba(124, 92, 255, 0.1);
            color: #ddd6fe;
          }

          .more-navigation-icon {
            width: 40px;
            height: 40px;
            display: grid;
            place-items: center;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.045);
            color: #9f93ff;
          }

          .more-navigation-link strong {
            color: #e8eaf0;
            font-size: 12px;
          }

          .more-navigation-arrow {
            color: #626b7d;
            font-size: 15px;
          }

          .connectivity-banner {
            position: fixed;
            right: 17px;
            bottom: calc(86px + env(safe-area-inset-bottom));
            left: 17px;
            z-index: 98;
            min-height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 12px;
            border: 1px solid rgba(251, 191, 36, 0.2);
            border-radius: 12px;
            background: rgba(47, 35, 12, 0.94);
            color: #fde68a;
            font-size: 9px;
            font-weight: 700;
            text-align: center;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
          }

          .connectivity-banner > span {
            width: 7px;
            height: 7px;
            flex: 0 0 auto;
            border-radius: 50%;
            background: #fbbf24;
            box-shadow: 0 0 10px rgba(251, 191, 36, 0.7);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-navigation-root *,
          .mobile-navigation-root *::before,
          .mobile-navigation-root *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
