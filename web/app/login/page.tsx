import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = firstValue(params.error);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top right, rgba(124, 92, 255, 0.16), transparent 35%), #080a10",
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "30px",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          borderRadius: "22px",
          background: "rgba(17, 19, 28, 0.96)",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div
          style={{
            width: "54px",
            height: "54px",
            display: "grid",
            placeItems: "center",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #8b5cf6, #6d5ce7)",
            fontSize: "23px",
            fontWeight: 800,
            boxShadow: "0 12px 30px rgba(124, 92, 255, 0.28)",
          }}
        >
          N
        </div>

        <p
          style={{
            margin: "22px 0 0",
            color: "#a99dfd",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.15em",
          }}
        >
          NECARDPILOT
        </p>

        <h1
          style={{
            margin: "9px 0 0",
            fontSize: "34px",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
          }}
        >
          Log ind
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            color: "#8f98aa",
            fontSize: "14px",
            lineHeight: 1.55,
          }}
        >
          Brug din NECardPilot-konto til at fortsætte til scanner og
          portefølje.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              marginTop: "20px",
              padding: "13px 14px",
              border: "1px solid rgba(248, 113, 113, 0.28)",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.09)",
              color: "#fecaca",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}

        <form action={login} style={{ marginTop: "24px" }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#a8afbd",
              fontSize: "11px",
              fontWeight: 750,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            E-mail
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              borderRadius: "12px",
              outline: "none",
              background: "rgba(0, 0, 0, 0.2)",
              color: "#ffffff",
              fontSize: "16px",
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: "block",
              margin: "18px 0 8px",
              color: "#a8afbd",
              fontSize: "11px",
              fontWeight: 750,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Adgangskode
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              borderRadius: "12px",
              outline: "none",
              background: "rgba(0, 0, 0, 0.2)",
              color: "#ffffff",
              fontSize: "16px",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              minHeight: "50px",
              marginTop: "22px",
              border: 0,
              borderRadius: "13px",
              background: "linear-gradient(135deg, #8b5cf6, #6d5ce7)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(124, 92, 255, 0.24)",
            }}
          >
            Log ind
          </button>
        </form>

        <p
          style={{
            margin: "18px 0 0",
            color: "#626b7d",
            fontSize: "11px",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Nye brugere oprettes foreløbig af administratoren.
        </p>
      </section>
    </main>
  );
}