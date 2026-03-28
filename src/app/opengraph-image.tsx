import { ImageResponse } from "next/og";

export const alt = "NHK やさしいにほんご - 한국어 번역과 함께 읽는 쉬운 일본어 뉴스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          padding: 60,
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            width: 80,
            height: 4,
            background: "#e94560",
            borderRadius: 2,
            marginBottom: 32,
            display: "flex",
          }}
        />

        {/* Main title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -1,
            marginBottom: 12,
            display: "flex",
          }}
        >
          NHK やさしいにほんご
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 48,
            display: "flex",
          }}
        >
          쉬운 일본어 뉴스 리더
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {["한국어 번역", "후리가나", "동사 활용 분석", "음성 재생"].map(
            (label) => (
              <div
                key={label}
                style={{
                  fontSize: 22,
                  color: "#ffffff",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  padding: "10px 24px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                }}
              >
                {label}
              </div>
            ),
          )}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
            display: "flex",
          }}
        >
          매일 업데이트되는 NHK Easy News를 한국어와 함께
        </div>
      </div>
    ),
    { ...size },
  );
}
