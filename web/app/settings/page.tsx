"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import AppSidebar from "@/components/app/AppSidebar";
import {
  getUserIdentity,
  type UserIdentity,
} from "@/components/auth/AuthenticatedUserCard";
import { createClient } from "@/lib/supabase/client";

function formatDate(value: string | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<UserIdentity | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success"
  );

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (!isActive) {
        return;
      }

      if (error || !currentUser) {
        router.replace("/login");
        return;
      }

      const currentIdentity = getUserIdentity(currentUser);
      setUser(currentUser);
      setIdentity(currentIdentity);
      setDisplayName(currentIdentity.displayName);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = displayName.trim();

    if (normalizedName.length < 2) {
      setMessageTone("error");
      setMessage("Dit visningsnavn skal være mindst 2 tegn.");
      return;
    }

    if (normalizedName.length > 80) {
      setMessageTone("error");
      setMessage("Dit visningsnavn må højst være 80 tegn.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(user?.user_metadata ?? {}),
        display_name: normalizedName,
      },
    });

    if (error || !data.user) {
      setMessageTone("error");
      setMessage(
        error?.message
          ? `Profilen kunne ikke gemmes: ${error.message}`
          : "Profilen kunne ikke gemmes. Prøv igen."
      );
      setSaving(false);
      return;
    }

    const updatedIdentity = getUserIdentity(data.user);
    setUser(data.user);
    setIdentity(updatedIdentity);
    setDisplayName(updatedIdentity.displayName);
    setMessageTone("success");
    setMessage("Profilen er opdateret på tværs af Vallective.");
    setSaving(false);
  }

  return (
    <div className="settings-shell">
      <AppSidebar identity={identity} variant="fixed" />

      <main className="settings-main">
        <header className="settings-header">
          <div>
            <p className="eyebrow">Your account</p>
            <h1>Settings</h1>
            <p>
              Administrér den identitet, der vises i dit Vallective-workspace,
              og hold din konto sikker.
            </p>
          </div>

          <Link className="back-link" href="/">
            ← Back to dashboard
          </Link>
        </header>

        {loading ? (
          <section className="settings-panel loading-panel" aria-live="polite">
            <span className="loading-spinner" />
            <p>Loading your profile...</p>
          </section>
        ) : (
          <div className="settings-grid">
            <section className="settings-panel profile-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h2>Your collector identity</h2>
                </div>

                <span className="profile-avatar" aria-hidden="true">
                  {identity?.initials ?? "VA"}
                </span>
              </div>

              <form onSubmit={handleSubmit}>
                <label htmlFor="display-name">
                  <span>Display name</span>
                  <input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    disabled={saving}
                  />
                  <small>Used in the dashboard and throughout the app.</small>
                </label>

                <label htmlFor="email">
                  <span>Email</span>
                  <input
                    id="email"
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    aria-describedby="email-description"
                  />
                  <small id="email-description">
                    Your verified sign-in address. Email changes are handled
                    separately for account security.
                  </small>
                </label>

                {message && (
                  <p
                    className={`form-message form-message-${messageTone}`}
                    role="status"
                  >
                    {message}
                  </p>
                )}

                <div className="form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={
                      saving || displayName.trim() === identity?.displayName
                    }
                  >
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </form>
            </section>

            <aside className="settings-side-column">
              <section className="settings-panel security-panel">
                <div>
                  <p className="eyebrow">Security</p>
                  <h2>Password</h2>
                  <p>
                    Choose a strong, unique password and update it whenever you
                    need to secure the account.
                  </p>
                </div>

                <Link className="secondary-link" href="/change-password">
                  Change password →
                </Link>
              </section>

              <section className="settings-panel account-panel">
                <div className="panel-heading compact-heading">
                  <div>
                    <p className="eyebrow">Account</p>
                    <h2>Membership</h2>
                  </div>
                  <span className="status-badge">Active</span>
                </div>

                <dl>
                  <div>
                    <dt>Role</dt>
                    <dd>Collector</dd>
                  </div>
                  <div>
                    <dt>Email status</dt>
                    <dd>{user?.email_confirmed_at ? "Verified" : "Pending"}</dd>
                  </div>
                  <div>
                    <dt>Member since</dt>
                    <dd>{formatDate(user?.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Last sign-in</dt>
                    <dd>{formatDate(user?.last_sign_in_at)}</dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        )}
      </main>

      <style jsx>{`
        .settings-shell {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 82% 0%,
              rgba(124, 92, 255, 0.11),
              transparent 32%
            ),
            #080a10;
          color: #f8fafc;
        }

        .settings-main {
          min-height: 100vh;
          margin-left: 310px;
          padding: 50px clamp(28px, 4vw, 66px) 70px;
        }

        .settings-header {
          max-width: 1180px;
          margin: 0 auto 30px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #9f93ff;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .settings-header h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(44px, 5vw, 68px);
          letter-spacing: -0.055em;
          line-height: 0.98;
        }

        .settings-header > div > p:last-child {
          max-width: 680px;
          margin: 15px 0 0;
          color: #7d8598;
          font-size: 13px;
          line-height: 1.65;
        }

        .back-link,
        .secondary-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #a8afbe;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .back-link:hover,
        .secondary-link:hover {
          color: #ffffff;
        }

        .settings-grid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(310px, 0.8fr);
          gap: 22px;
          align-items: start;
        }

        .settings-side-column {
          display: grid;
          gap: 22px;
        }

        .settings-panel {
          padding: 27px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 22px;
          background: rgba(16, 19, 27, 0.95);
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
        }

        .profile-panel {
          border-color: rgba(139, 92, 246, 0.2);
          background:
            radial-gradient(
              circle at top right,
              rgba(124, 92, 255, 0.11),
              transparent 36%
            ),
            rgba(16, 19, 27, 0.98);
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 28px;
        }

        .compact-heading {
          margin-bottom: 20px;
        }

        .panel-heading h2,
        .security-panel h2 {
          margin: 0;
          color: #ffffff;
          font-size: 21px;
          letter-spacing: -0.035em;
        }

        .profile-avatar {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 18px;
          background: rgba(124, 92, 255, 0.13);
          color: #ddd6fe;
          font-size: 15px;
          font-weight: 900;
        }

        form {
          display: grid;
          gap: 21px;
        }

        label {
          display: grid;
          gap: 8px;
        }

        label > span,
        dt {
          color: #a5adbd;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        input {
          width: 100%;
          min-height: 52px;
          padding: 0 15px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 13px;
          outline: 0;
          background: rgba(7, 9, 14, 0.78);
          color: #ffffff;
          font-size: 13px;
        }

        input:focus {
          border-color: rgba(167, 139, 250, 0.7);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.11);
        }

        input:read-only {
          color: #858d9f;
          cursor: default;
        }

        label small {
          color: #626b7d;
          font-size: 10px;
          line-height: 1.55;
        }

        .form-message {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.5;
        }

        .form-message-success {
          border: 1px solid rgba(52, 211, 153, 0.2);
          background: rgba(16, 185, 129, 0.07);
          color: #a7f3d0;
        }

        .form-message-error {
          border: 1px solid rgba(248, 113, 113, 0.22);
          background: rgba(239, 68, 68, 0.07);
          color: #fecaca;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: 3px;
        }

        .primary-button {
          min-height: 48px;
          padding: 0 20px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #8b6dff, #6957dd);
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 13px 30px rgba(94, 70, 216, 0.24);
        }

        .primary-button:disabled {
          opacity: 0.48;
          box-shadow: none;
        }

        .security-panel {
          display: grid;
          gap: 23px;
        }

        .security-panel > div > p:last-child {
          margin: 12px 0 0;
          color: #70798b;
          font-size: 11px;
          line-height: 1.65;
        }

        .secondary-link {
          min-height: 46px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
        }

        .status-badge {
          padding: 6px 9px;
          border: 1px solid rgba(52, 211, 153, 0.18);
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.07);
          color: #86efac;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        dl {
          margin: 0;
          display: grid;
          gap: 0;
        }

        dl > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 0;
          border-top: 1px solid rgba(148, 163, 184, 0.08);
        }

        dd {
          margin: 0;
          color: #d8dce5;
          font-size: 11px;
          text-align: right;
        }

        .loading-panel {
          max-width: 1180px;
          min-height: 260px;
          margin: 0 auto;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 14px;
          color: #7d8598;
          font-size: 12px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border: 2px solid rgba(148, 163, 184, 0.14);
          border-top-color: #9f93ff;
          border-radius: 50%;
          animation: spin 750ms linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .settings-main {
            margin-left: 0;
            padding: 35px 24px 55px;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }

          .settings-side-column {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .settings-main {
            padding: 28px 14px 45px;
          }

          .settings-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-side-column {
            grid-template-columns: 1fr;
          }

          .settings-panel {
            padding: 20px;
            border-radius: 18px;
          }

          .form-actions,
          .primary-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
