"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it can't rely on the app's stylesheet or components.
 */
const GlobalError = ({ reset }: { error: Error; reset: () => void }) => (
  <html lang="en">
    <body
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#08090d",
        color: "#d6e0ff",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <main>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          PrepWise hit a problem
        </h1>
        <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
          Please try again. If it keeps happening, reload the page.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: 9999,
            border: 0,
            fontWeight: 700,
            background: "#cac5fe",
            color: "#020408",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </main>
    </body>
  </html>
);

export default GlobalError;
