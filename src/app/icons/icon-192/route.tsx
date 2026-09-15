import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: 32,
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            color: "#4ade80",
            fontFamily: "sans-serif",
          }}
        >
          B
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
