import { dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

// Origin of the Go engine's HTTP API. The browser never calls it directly —
// requests to /api/engine/* are proxied here by the rewrite below, so there is
// no CORS to configure and the engine binding stays private to the server.
const ENGINE_ORIGIN = process.env.ENGINE_ORIGIN ?? "http://localhost:8080";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This project lives inside a larger repo with other lockfiles; pin the
  // file-tracing root to this app so Next doesn't infer a parent directory.
  outputFileTracingRoot: here,
  // Proxy the product UI's API calls to the engine (works in `next dev` and
  // `next start`). Client code only ever fetches relative `/api/engine/...`.
  async rewrites() {
    return [
      { source: "/api/engine/:path*", destination: `${ENGINE_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
