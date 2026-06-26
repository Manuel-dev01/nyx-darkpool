import { dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

// NOTE: the engine API proxy is no longer a build-time `rewrites()` (which baked
// the engine origin into the image). It is now a RUNTIME route handler at
// `app/api/engine/[...path]/route.ts`, which reads `ENGINE_ORIGIN` per request.
// That makes the same build portable across Vercel (→ Railway engine public URL)
// and Docker/Railway (→ http://engine:8080), changed via env with no rebuild.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone/server.js) for a slim
  // Docker runtime image. Harmless on Vercel (it uses its own build output).
  output: "standalone",
  // This project lives inside a larger repo with other lockfiles; pin the
  // file-tracing root to this app so Next doesn't infer a parent directory.
  outputFileTracingRoot: here,
};

export default nextConfig;
