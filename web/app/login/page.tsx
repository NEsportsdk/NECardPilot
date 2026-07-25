"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Fejl: ${error.message}`);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Fejl: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Brugeren er oprettet. Tjek din e-mail for bekræftelse.");
    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          padding: "28px",
        }}
      >
        <h1 style={{ marginTop: 0 }}>NECardPilot</h1>
        <h2>Log ind</h2>

        <form onSubmit={handleLogin}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: "8px" }}
          >
            E-mail
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "18px",
              boxSizing: "border-box",
            }}
          />

          <label
            htmlFor="password"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Adgangskode
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "20px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ marginRight: "12px" }}
          >
            {loading ? "Arbejder..." : "Log ind"}
          </button>

          <button type="button" onClick={handleSignUp} disabled={loading}>
            Opret bruger
          </button>
        </form>

        {message && <p style={{ marginTop: "18px" }}>{message}</p>}
      </section>
    </main>
  );
}