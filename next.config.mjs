// Deployed as a fully static site to GitHub Pages. There is no server: bets and
// bankroll live in the browser's localStorage, and results are fetched straight
// from ESPN's public feed, which sends `access-control-allow-origin: *`.
//
// A project page is served from /<repo>, so asset and route URLs need that
// prefix. Set BASE_PATH='' to build for a root domain instead.
const basePath = process.env.BASE_PATH ?? '';

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
