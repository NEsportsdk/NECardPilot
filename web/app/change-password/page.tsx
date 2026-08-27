"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

  return "Adgangskoden kunne ikke ændres. Prøv igen.";
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
        text: "En 6-cifret sikkerhedskode er sendt til din email. Indtast koden nedenfor og gem adgangskoden igen.",
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

    if (password.length < 12) {
      setMessage({
        tone: "error",
        text: "Vælg en adgangskode på mindst 12 tegn.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        tone: "error",
        text: "De to adgangskoder er ikke ens.",
      });
      return;
    }

    if (showNonceField && !/^\d{6}$/.test(nonce.trim())) {
      setMessage({
        tone: "error",
        text: "Indtast den 6-cifrede sikkerhedskode fra emailen.",
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
            text: "Din session er ældre end Supabase tillader til en direkte passwordændring. Klik på ‘Send 6-cifret kode’, og prøv igen med koden fra emailen.",
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
        text: "Adgangskoden er ændret. Brug den nye adgangskode på din iPhone. Hvis computeren logger ud, logger du blot ind igen med den nye kode.",
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
          <p>Kontrollerer din aktive session...</p>
        </section>

        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="password-page">
      <section className="password-card">
        <header>
          <span className="eyebrow">ACCOUNT SECURITY</span>
          <h1>Vælg en ny adgangskode</h1>
          <p>
            Du er allerede logget ind på computeren. Derfor kan NECardPilot
            ændre adgangskoden sikkert fra din aktive Supabase-session.
          </p>
        </header>

        <div className="account-row">
          <span>LOGGET IND SOM</span>
          <strong>{email || "Ukendt email"}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>Ny adgangskode</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindst 12 tegn"
              disabled={isSaving}
            />
          </label>

          <label>
            <span>Gentag ny adgangskode</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Skriv den samme kode igen"
              disabled={isSaving}
            />
          </label>

          {showNonceField && (
            <div className="reauth-section">
              <div>
                <strong>Ekstra sikkerhedskontrol</strong>
                <p>
                  Supabase kan kræve en emailkode, fordi din nuværende session
                  er mere end 24 timer gammel.
                </p>
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() => void sendReauthenticationCode()}
                disabled={isSendingCode || isSaving}
              >
                {isSendingCode ? "Sender kode..." : "Send 6-cifret kode"}
              </button>

              <label className="nonce-field">
                <span>Sikkerhedskode</span>
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
              Tilbage til Home
            </Link>

            <button
              className="primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Ændrer adgangskode..." : "Gem ny adgangskode"}
            </button>
          </div>
        </form>

        <p className="privacy-note">
          Adgangskoden vises eller gemmes ikke i NECardPilot. Den sendes direkte
          til Supabase Auth.
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
