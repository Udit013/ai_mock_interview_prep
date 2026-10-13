import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/sign-in", "/sign-up"],
      // Everything else is behind sign-in or private (shared reports opt out
      // via their own noindex meta tag).
      disallow: ["/api/", "/interview", "/resume", "/share/"],
    },
    sitemap: "https://mock-ai-prep.vercel.app/sitemap.xml",
  };
}
