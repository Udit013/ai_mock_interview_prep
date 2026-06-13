// Polyfill SlowBuffer for Node.js 22+ compatibility.
// firebase-admin → jsonwebtoken → jwa → buffer-equal-constant-time uses
// SlowBuffer which was removed in Node.js 22.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const buf = await import("buffer");
    if (!(buf as { SlowBuffer?: unknown }).SlowBuffer) {
      (buf as { SlowBuffer?: unknown }).SlowBuffer = Buffer;
    }
  }
}
