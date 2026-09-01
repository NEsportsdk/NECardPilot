"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import VallectiveMark from "@/components/brand/VallectiveMark";
import { validatePassword } from "@/lib/auth/forms";
import { createClient } from "@/lib/supabase/client";

type MessageTone = "info" | "success" | "error";

type PageMessage = {
  tone: MessageTone;
  text: string;
} | null;

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "We couldn't change your password. Try again.";
}

function requiresReauthentication(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("reauth") ||
    normalized.includes("nonce") ||
    normalized.includes("recently signed in")
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nonce, setNonce] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [showNonceField, setShowNonceField] = useState(false);
  const [message, setMessage] = useState<PageMessage>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      setCheckingSession(false);
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  async function sendReauthenticationCode() {
    setIsSendingCode(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.reauthenticate();

      if (error) {
        throw error;
      }

      setShowNonceField(true);
      setMessage({
        tone: "info",
        text: "A six-digit security code has been sent to your email. Enter it below, then save your password again.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: getReadableError(error),
      });
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const passwordResult = validatePassword(password);

    if (!passwordResult.ok) {
      setMessage({
        tone: "error",
        text: passwordResult.message,
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        tone: "error",
        text: "The passwords don't match.",
      });
      return;
    }

    if (showNonceField && !/^\d{6}$/.test(nonce.trim())) {
      setMessage({
        tone: "error",
        text: "Enter the six-digit security code from your email.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const attributes = nonce.trim()
        ? {
            password,
            nonce: nonce.trim(),
          }
        : {
            password,
          };

      const { error } = await supabase.auth.updateUser(attributes);

      if (error) {
        if (requiresReauthentication(error.message)) {
          setShowNonceField(true);
          setMessage({
            tone: "info",
            text: "Your session is too old for a direct password change. Select ‘Send six-digit code’, then try again with the code from your email.",
          });
          return;
        }

        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setNonce("");
      setShowNonceField(false);
      setMessage({
        tone: "success",
        text: "Your password has been changed and now works across all your devices.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: getReadableError(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="password-page">
        <section className="password-card password-loading">
          <span className="spinner" />
          <p>Checking your active session...</p>
        </section>

        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="password-page">
      <section className="password-card">
        <header>
          <div className="brand-mark">
            <VallectiveMark />
          </div>
          <span className="eyebrow">ACCOUNT SECURITY</span>
          <h1>Choose a new password</h1>
          <p>
            Choose a strong password. If you arrived from a reset link,
            Supabase has already created a secure temporary session.
          </p>
        </header>

        <div className="account-row">
          <span>SIGNED IN AS</span>
          <strong>{email || "Unknown email"}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              disabled={isSaving}
            />
          </label>

          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter the same password again"
              disabled={isSaving}
            />
          </label>

          {showNonceField && (
            <div className="reauth-section">
              <div>
                <strong>Additional security check</strong>
                <p>
                  An email code may be required when your current session is
                  too old for a direct password change.
                </p>
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() => void sendReauthenticationCode()}
                disabled={isSendingCode || isSaving}
              >
                {isSendingCode ? "Sending code..." : "Send six-digit code"}
              </button>

              <label className="nonce-field">
                <span>Security code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={nonce}
                  onChange={(event) =>
                    setNonce(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  disabled={isSaving}
                />
              </label>
            </div>
          )}

          {message && (
            <div className={`message message-${message.tone}`} role="status">
              {message.text}
            </div>
          )}

          <div className="actions">
            <Link href="/" className="cancel-link">
              Back to Home
            </Link>

            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Changing password..." : "Save new password"}
            </button>
          </div>
        </form>

        <p className="privacy-note">
          Vallective never displays or stores your password. It is sent
          directly to Supabase Auth.
        </p>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .password-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 75% 10%, rgba(124, 92, 255, 0.13), transparent 35%),
      #080a10;
    color: #f8fafc;
  }

  .password-card {
    width: min(620px, 100%);
    padding: 30px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 24px;
    background: #11131c;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
  }

  .password-loading {
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 13px;
    color: #9299aa;
  }

  .brand-mark {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    margin-bottom: 20px;
    padding: 6px;
    border-radius: 15px;
    border: 1px solid #292d3b;
    background: #10141c;
    color: #f5f7fb;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
  }

  .brand-mark :global(svg) {
    width: 100%;
    height: 100%;
  }

  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(167, 139, 250, 0.2);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }

  .eyebrow {
    color: #9f93ff;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.15em;
  }

  h1 {
    margin: 9px 0 0;
    color: #ffffff;
    font-size: 30px;
    letter-spacing: -0.04em;
  }

  header p {
    margin: 10px 0 0;
    color: #9299aa;
    font-size: 13px;
    line-height: 1.6;
  }

  .account-row {
    margin-top: 22px;
    padding: 14px 15px;
    border: 1px solid rgba(148, 163, 184, 0.11);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.022);
  }

  .account-row span,
  label > span {
    display: block;
    color: #7e879a;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .account-row strong {
    display: block;
    margin-top: 6px;
    color: #ffffff;
    font-size: 13px;
  }

  form {
    display: grid;
    gap: 14px;
    margin-top: 20px;
  }

  label {
    display: grid;
    gap: 7px;
  }

  input {
    width: 100%;
    min-height: 46px;
    padding: 0 13px;
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 12px;
    outline: none;
    background: rgba(0, 0, 0, 0.2);
    color: #ffffff;
    font: inherit;
    font-size: 13px;
  }

  input:focus {
    border-color: rgba(167, 139, 250, 0.65);
    box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.08);
  }

  .reauth-section {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 15px;
    background: rgba(245, 158, 11, 0.06);
  }

  .reauth-section strong {
    color: #fde68a;
    font-size: 12px;
  }

  .reauth-section p {
    margin: 5px 0 0;
    color: #c7ad65;
    font-size: 11px;
    line-height: 1.5;
  }

  .nonce-field input {
    letter-spacing: 0.22em;
    font-size: 17px;
    font-weight: 800;
  }

  .message {
    padding: 13px 14px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.55;
  }

  .message-info {
    border: 1px solid rgba(96, 165, 250, 0.2);
    background: rgba(59, 130, 246, 0.07);
    color: #bfdbfe;
  }

  .message-success {
    border: 1px solid rgba(52, 211, 153, 0.22);
    background: rgba(16, 185, 129, 0.07);
    color: #a7f3d0;
  }

  .message-error {
    border: 1px solid rgba(248, 113, 113, 0.24);
    background: rgba(239, 68, 68, 0.08);
    color: #fecaca;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
  }

  .primary-button,
  .secondary-button,
  .cancel-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 750;
    text-decoration: none;
    cursor: pointer;
  }

  .primary-button {
    border: 0;
    background: linear-gradient(135deg, #8b5cf6, #6d5ce7);
    color: #ffffff;
  }

  .secondary-button,
  .cancel-link {
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: rgba(255, 255, 255, 0.03);
    color: #a5adbd;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .privacy-note {
    margin: 18px 0 0;
    color: #5f687a;
    font-size: 10px;
    line-height: 1.5;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 560px) {
    .password-page {
      padding: 12px;
    }

    .password-card {
      padding: 22px 18px;
      border-radius: 20px;
    }

    h1 {
      font-size: 26px;
    }

    .actions {
      align-items: stretch;
      flex-direction: column-reverse;
    }

    .primary-button,
    .cancel-link {
      width: 100%;
    }
  }
`;
