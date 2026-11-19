import type { NextConfig } from "next";
import path from "path";
import { JS_WORKER_CSP, PY_WORKER_CSP } from "./lib/security/csp";

const nextConfig: NextConfig = {
  // Don't advertise the framework in an `x-powered-by` response header.
  poweredByHeader: false,
  webpack(config) {
    // Shim buffer-equal-constant-time for Node 22+ (SlowBuffer was removed)
    config.resolve.alias["buffer-equal-constant-time"] = path.join(
      __dirname,
      "lib/buffer-shim.js"
    );
    // ai@5's provider-utils has an optional dynamic import webpack can't
    // analyse ("Critical dependency"). Harmless; silenced for that module only.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@ai-sdk[\\/]provider-utils/, message: /Critical dependency/ },
    ];
    return config;
  },
  turbopack: {
    resolveAlias: {
      "buffer-equal-constant-time": "./lib/buffer-shim.js",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/devicons/devicon/**",
      },
    ],
  },
  // Lint and type errors now fail the build instead of shipping silently.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page is meant to be embedded; blocks clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Interviews need the mic; nothing needs the camera or location.
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(), geolocation=()",
          },
          // Pages get a nonce-based CSP from middleware.ts.
          // HSTS is already sent by Vercel on every deployment.
        ],
      },
      // Code-runner workers: their own narrow policies (lib/security/csp.ts).
      { source: "/runner/js-worker.js", headers: [{ key: "Content-Security-Policy", value: JS_WORKER_CSP }] },
      { source: "/runner/py-worker.js", headers: [{ key: "Content-Security-Policy", value: PY_WORKER_CSP }] },
    ];
  },
};

export default nextConfig;