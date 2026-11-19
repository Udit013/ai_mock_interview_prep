import { ImageResponse } from "next/og";

// Social preview card, rendered from code in the product's own palette —
// no image asset to drift out of date with the design.
export const alt = "PrepWise — AI mock interview practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const bar = (h: number, color: string) => (
    <div style={{ width: 11, height: h, borderRadius: 5.5, background: color }} />
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#f7f6f3",
          color: "#1a1916",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20.5,
              background: "#1a1916",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5.5,
            }}
          >
            {/* Same geometry as app/icon.svg, scaled 2.75× */}
            {bar(22, "#f7f6f3")}
            {bar(55, "#fb923c")}
            {bar(36, "#f7f6f3")}
            {bar(16.5, "#f7f6f3")}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>PrepWise</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, maxWidth: 960 }}>
            Practise the interview before the interview.
          </div>
          <div style={{ fontSize: 32, color: "#66625a" }}>
            Adaptive voice interviews · live coding · résumé and job-description targeting · scored feedback
          </div>
        </div>
      </div>
    ),
    size
  );
}
