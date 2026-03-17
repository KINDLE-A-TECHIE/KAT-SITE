import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KAT Learning — Tech Education for African Kids and Teens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0D1F45 0%, #132B5E 45%, #1E5FAF 100%)",
          fontFamily: "sans-serif",
          padding: "64px",
          position: "relative",
        }}
      >
        {/* Decorative blobs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "rgba(77,179,230,0.18)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: 40,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(30,95,175,0.25)",
            filter: "blur(50px)",
          }}
        />

        {/* Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 100,
            padding: "8px 20px",
            width: "fit-content",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#4DB3E6",
            }}
          />
          <span style={{ color: "#93c5fd", fontSize: 16, fontWeight: 600, letterSpacing: "0.1em" }}>
            KAT ACADEMY · KINDLEATECHIE.COM
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.06,
            color: "#ffffff",
            maxWidth: 820,
            marginBottom: 28,
            letterSpacing: "-0.02em",
          }}
        >
          Tech education built for African kids and teens.
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: 26,
            color: "#93c5fd",
            maxWidth: 640,
            lineHeight: 1.5,
            marginBottom: 48,
          }}
        >
          Live mentors · Age-based tracks · Real portfolio projects · Parent visibility
        </div>

        {/* Stat pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { value: "500+", label: "Students" },
            { value: "3", label: "Tracks (8–19)" },
            { value: "4.9★", label: "Avg Rating" },
          ].map(({ value, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 16,
                padding: "16px 28px",
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 800, color: "#ffffff" }}>{value}</span>
              <span style={{ fontSize: 14, color: "#93c5fd", marginTop: 2 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
