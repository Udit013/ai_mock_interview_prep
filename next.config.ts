import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack(config) {
    // Shim buffer-equal-constant-time for Node 22+ (SlowBuffer was removed)
    config.resolve.alias["buffer-equal-constant-time"] = path.join(
      __dirname,
      "lib/buffer-shim.js"
    );
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
          // HSTS is already sent by Vercel on every deployment.
        ],
      },
    ];
  },
};

export default nextConfig;