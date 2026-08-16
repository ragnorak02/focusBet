// Deployed as a fully static site to GitHub Pages. There is no server: bets and
// bankroll live in the browser's localStorage, and results are fetched straight
// from ESPN's public feed, which sends `access-control-allow-origin: *`.
//
// A project page is served from /<repo>, so asset and route URLs need that
// prefix. NEXT_PUBLIC_BASE_PATH is used (rather than a plain BASE_PATH) because
// client code has to build the same prefix at runtime to fetch odds.json, and
// only NEXT_PUBLIC_* vars get inlined into the browser bundle.
// Leave it unset to build for a root domain.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: basePath || undefined,
  // Emits /events/index.html rather than /events.html, which is what Pages
  // serves correctly for a directory-style URL.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
