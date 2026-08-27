"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AuthenticatedUserCard, {
  type UserIdentity,
} from "@/components/auth/AuthenticatedUserCard";

type AppSidebarVariant =
  | "rail"
  | "fixed"
  | "grid"
  | "grid-cards"
  | "grid-scanner"
  | "grid-transactions";

type AppSidebarProps = {
  identity?: UserIdentity;
  onLogout?: () => void | Promise<void>;
  variant?: AppSidebarVariant;
};

type NavigationItem = {
  label: string;
  icon: string;
  href: string;
  matches: (pathname: string) => boolean;
};

const navigation: NavigationItem[] = [
  {
    label: "Home",
    icon: "⌂",
    href: "/",
    matches: (pathname) => pathname === "/",
  },
  {
    label: "Collections",
    icon: "◇",
    href: "/#collections",
    matches: (pathname) => pathname.startsWith("/collections"),
  },
  {
    label: "Cards",
    icon: "▱",
    href: "/cards",
    matches: (pathname) => pathname.startsWith("/cards"),
  },
  {
    label: "Scanner",
    icon: "◎",
    href: "/scanner",
    matches: (pathname) => pathname.startsWith("/scanner"),
  },
  {
    label: "Grading",
    icon: "◈",
    href: "/grading",
    matches: (pathname) => pathname.startsWith("/grading"),
  },
  {
    label: "Cardshow",
    icon: "▦",
    href: "/cardshow",
    matches: (pathname) => pathname.startsWith("/cardshow"),
  },
  {
    label: "Transactions",
    icon: "↕",
    href: "/transactions",
    matches: (pathname) => pathname.startsWith("/transactions"),
  },
  {
    label: "Analytics",
    icon: "⌁",
    href: "/analytics",
    matches: (pathname) => pathname.startsWith("/analytics"),
  },
];

export default function AppSidebar({
  identity,
  onLogout,
  variant = "grid",
}: AppSidebarProps) {
  const pathname = usePathname();
  const settingsActive =
    pathname.startsWith("/settings") || pathname.startsWith("/change-password");

  return (
    <aside className={`app-sidebar app-sidebar-${variant}`}>
      <div className="sidebar-top">
        <Link className="brand" href="/" aria-label="Vallective home">
          <div className="brand-mark">V</div>

          <div className="brand-copy">
            <p className="brand-name">Vallective</p>
            <p className="brand-subtitle">Collector Intelligence</p>
          </div>
        </Link>

        <nav className="navigation" aria-label="Primary navigation">
          <p className="navigation-label">Workspace</p>

          {navigation.map((item) => {
            const active = item.matches(pathname);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`navigation-item ${active ? "navigation-item-active" : ""}`}
                href={item.href}
                key={item.label}
                title={item.label}
              >
                <span className="navigation-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="navigation-copy">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer">
        <Link
          aria-current={settingsActive ? "page" : undefined}
          className={`settings-link ${settingsActive ? "navigation-item-active" : ""}`}
          href="/settings"
        >
          <span className="navigation-icon" aria-hidden="true">
            ⚙
          </span>
          <span className="navigation-copy">Settings</span>
        </Link>

        <AuthenticatedUserCard identity={identity} onLogout={onLogout} />
      </div>

      <style jsx>{`
        .app-sidebar {
          min-width: 0;
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 30px 20px 22px;
          border-right: 1px solid rgba(148, 163, 184, 0.11);
          background: rgba(8, 10, 16, 0.97);
          color: #f8fafc;
          backdrop-filter: blur(24px);
        }

        .app-sidebar-rail {
          position: fixed;
          inset: 0 auto 0 0;
          width: var(--sidebar-width);
          padding: 28px 18px 20px;
        }

        .app-sidebar-fixed {
          position: fixed;
          inset: 0 auto 0 0;
          width: 310px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 10px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 15px;
          background: linear-gradient(145deg, #9b82ff, #6552e8);
          color: #ffffff;
          font-size: 20px;
          font-weight: 900;
          box-shadow: 0 14px 35px rgba(124, 92, 255, 0.28);
        }

        .app-sidebar-rail .brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          font-size: 17px;
        }

        .brand-name,
        .brand-subtitle,
        .navigation-label {
          margin: 0;
        }

        .brand-name {
          color: #ffffff;
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -0.025em;
        }

        .brand-subtitle {
          margin-top: 4px;
          color: #71798b;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .navigation {
          display: grid;
          gap: 5px;
          margin-top: 42px;
        }

        .app-sidebar-rail .navigation {
          margin-top: 30px;
        }

        .navigation-label {
          padding: 0 13px 10px;
          color: #596172;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .navigation-item,
        .settings-link {
          width: 100%;
          min-height: 47px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 14px;
          border-radius: 12px;
          color: #8d95a7;
          font-size: 13px;
          font-weight: 680;
          text-align: left;
          text-decoration: none;
          transition:
            background 150ms ease,
            color 150ms ease,
            transform 150ms ease;
        }

        .app-sidebar-rail .navigation-item,
        .app-sidebar-rail .settings-link {
          min-height: 44px;
          padding: 0 12px;
        }

        .navigation-item:hover,
        .settings-link:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
        }

        .navigation-item:focus-visible,
        .settings-link:focus-visible,
        .brand:focus-visible {
          outline: 2px solid rgba(167, 139, 250, 0.78);
          outline-offset: 2px;
        }

        .navigation-item-active {
          background: rgba(124, 92, 255, 0.16);
          color: #e8e2ff;
        }

        .navigation-icon {
          width: 23px;
          display: inline-flex;
          justify-content: center;
          flex: 0 0 auto;
          color: #929bad;
          font-size: 15px;
          font-weight: 850;
        }

        .navigation-item-active .navigation-icon {
          color: #c4b5fd;
        }

        .sidebar-footer {
          display: grid;
          gap: 13px;
        }

        @media (max-width: 1050px) {
          .app-sidebar-grid-scanner {
            position: sticky;
            width: 100%;
            height: auto;
            padding: 13px 16px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .app-sidebar-grid-scanner .sidebar-top {
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .app-sidebar-grid-scanner .brand-copy,
          .app-sidebar-grid-scanner .navigation-label,
          .app-sidebar-grid-scanner .navigation-copy,
          .app-sidebar-grid-scanner .sidebar-footer {
            display: none;
          }

          .app-sidebar-grid-scanner .brand {
            padding: 0;
          }

          .app-sidebar-grid-scanner .navigation {
            display: flex;
            gap: 4px;
            margin: 0 0 0 auto;
            overflow-x: auto;
          }

          .app-sidebar-grid-scanner .navigation-item {
            width: 40px;
            min-height: 40px;
            justify-content: center;
            padding: 0;
          }
        }

        @media (max-width: 980px) {
          .app-sidebar-grid,
          .app-sidebar-fixed {
            position: static;
            width: 100%;
            height: auto;
            padding: 17px 16px 13px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .app-sidebar-grid .navigation,
          .app-sidebar-fixed .navigation {
            display: flex;
            gap: 7px;
            margin-top: 16px;
            padding-bottom: 2px;
            overflow-x: auto;
          }

          .app-sidebar-grid .navigation-label,
          .app-sidebar-fixed .navigation-label,
          .app-sidebar-grid .sidebar-footer,
          .app-sidebar-fixed .sidebar-footer {
            display: none;
          }

          .app-sidebar-grid .navigation-item,
          .app-sidebar-fixed .navigation-item {
            width: auto;
            min-width: max-content;
            min-height: 40px;
            padding: 0 12px;
            border: 1px solid rgba(148, 163, 184, 0.1);
          }
        }

        @media (max-width: 850px) {
          .app-sidebar-grid-cards {
            position: static;
            width: 100%;
            height: auto;
            padding: 18px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .app-sidebar-grid-cards .navigation {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 22px;
          }

          .app-sidebar-grid-cards .navigation-label,
          .app-sidebar-grid-cards .sidebar-footer {
            display: none;
          }

          .app-sidebar-grid-cards .navigation-item {
            justify-content: center;
            padding-inline: 8px;
          }

          .app-sidebar-grid-cards .navigation-icon {
            display: none;
          }
        }

        @media (max-width: 780px) {
          .app-sidebar-grid-transactions {
            position: static;
            width: 100%;
            height: auto;
            padding: 18px;
            border-right: 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.11);
          }

          .app-sidebar-grid-transactions .navigation {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            margin-top: 24px;
          }

          .app-sidebar-grid-transactions .navigation-label,
          .app-sidebar-grid-transactions .sidebar-footer,
          .app-sidebar-grid-transactions .navigation-icon {
            display: none;
          }

          .app-sidebar-grid-transactions .navigation-item {
            justify-content: center;
            padding-inline: 8px;
          }

          .app-sidebar-rail {
            width: var(--sidebar-width);
            padding-inline: 11px;
          }

          .app-sidebar-rail .brand {
            justify-content: center;
            padding-inline: 8px;
          }

          .app-sidebar-rail .brand-copy,
          .app-sidebar-rail .navigation-label,
          .app-sidebar-rail .navigation-copy,
          .app-sidebar-rail .sidebar-footer {
            display: none;
          }

          .app-sidebar-rail .navigation-item {
            justify-content: center;
            padding: 0;
          }
        }

        @media (max-width: 620px) {
          .app-sidebar-grid-cards .navigation,
          .app-sidebar-grid-transactions .navigation {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .app-sidebar-rail {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
}
