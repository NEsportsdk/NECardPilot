import { ImageResponse } from "next/og";

export const alt =
  "Vallective — collector intelligence for sports card collections";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function BrandGlyph() {
  return (
    <svg height="132" viewBox="0 0 512 512" width="132">
      <path
        d="M139 91L256 421"
        fill="none"
        stroke="#F5F7FB"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="62"
      />
      <path
        d="M373 91L256 421"
        fill="none"
        stroke="#7867FF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="62"
      />
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, #07090d 0%, #101323 55%, #241b54 100%)",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "76px 82px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "rgba(167, 139, 250, 0.13)",
            border: "1px solid rgba(196, 181, 253, 0.17)",
            borderRadius: 999,
            height: 360,
            position: "absolute",
            right: -70,
            top: -125,
            width: 360,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 735,
          }}
        >
          <span
            style={{
              color: "#A99BFF",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Collector intelligence
          </span>
          <strong
            style={{
              fontSize: 62,
              letterSpacing: "0.1em",
              lineHeight: 1,
              marginTop: 18,
            }}
          >
            VALLECTIVE
          </strong>
          <span
            style={{
              color: "#C9CED9",
              fontSize: 34,
              lineHeight: 1.3,
              marginTop: 23,
            }}
          >
            Collect what matters. Know what it&apos;s worth.
          </span>
          <div style={{ display: "flex", gap: 12, marginTop: 42 }}>
            {["Scan", "Organize", "Value", "Grade", "Sell"].map((label) => (
              <span
                key={label}
                style={{
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 999,
                  color: "#AEB5C3",
                  fontSize: 16,
                  padding: "9px 16px",
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            background: "#10141C",
            border: "1px solid #292D3B",
            borderRadius: 54,
            boxShadow: "0 28px 80px rgba(0, 0, 0, 0.42)",
            display: "flex",
            height: 244,
            justifyContent: "center",
            width: 244,
          }}
        >
          <BrandGlyph />
        </div>
      </div>
    ),
    size
  );
}
