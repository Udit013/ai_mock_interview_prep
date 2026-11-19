/**
 * The single canonical production URL. Metadata, Open Graph, robots and the
 * sitemap all read it from here. The previous domain (mock-ai-prep.vercel.app)
 * redirects to this one at the Vercel edge, so old links keep working.
 * Share links use the visiting origin instead, so they work on previews too.
 */
export const SITE_URL = "https://prepwise-studio.vercel.app";
