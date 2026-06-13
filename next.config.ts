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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/devicons/devicon/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;