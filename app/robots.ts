import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/sign-in", "/sign-up"],
      // Everything else is behind sign-in or private (shared reports opt out
      // via their own noindex meta tag).
      disallow: ["/api/", "/interview", "/resume", "/share/"],
    },
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
