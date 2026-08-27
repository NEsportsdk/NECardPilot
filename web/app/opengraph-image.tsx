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
        d="M106 112c-4-13 3-27 16-31l42-13c13-4 27 3 31 16l80 263-36 93c-5 13-23 13-28 0L106 112Z"
        fill="#FFFFFF"
      />
      <path
        d="M406 112c4-13-3-27-16-31l-42-13c-13-4-27 3-31 16l-80 263 36 93c5 13 23 13 28 0l105-328Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
      <path
        d="M151 116l18-6 9 29-18 6-9-29Zm201 0-18-6-9 29 18 6 9-29Z"
        fill="#6950DC"
        opacity="0.72"
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
              color: "#A99DFF",
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
              fontSize: 78,
              letterSpacing: "-0.055em",
              lineHeight: 1,
              marginTop: 18,
            }}
          >
            Vallective
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
            background: "linear-gradient(145deg, #A88CFF, #6552E8)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 54,
            boxShadow: "0 28px 80px rgba(81, 61, 195, 0.42)",
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
