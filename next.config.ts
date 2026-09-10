import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, the service worker script can get cached by the CDN/
  // browser HTTP cache like any other public/ static file — the browser's
  // own SW-update byte-check then keeps comparing against a stale cached
  // copy of /sw.js and never notices a new deploy shipped a different one,
  // which is the classic "PWA never updates, have to uninstall/reinstall"
  // bug (field report 2026-09-10). no-cache forces revalidation with the
  // server on every check instead of trusting a cached copy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
