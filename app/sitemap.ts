import type { MetadataRoute } from "next";

const SITE_URL = "https://mock-ai-prep.vercel.app";

// Only the public entry points are indexable; the rest requires an account.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/sign-up", "/sign-in"].map((path, i) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: i === 0 ? 1 : 0.8,
  }));
}
