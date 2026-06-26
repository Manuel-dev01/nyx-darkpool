// Runtime reverse-proxy for the Go engine API.
//
// The browser only ever calls same-origin `/api/engine/*`; this handler forwards
// each request server-side to the engine at `ENGINE_ORIGIN` (read at REQUEST time,
// not build time). That makes the deployment portable: set ENGINE_ORIGIN as a
// plain env var on Vercel (→ the Railway engine's public URL) or in Docker/Railway
// (→ http://engine:8080 / the private domain) and change it anytime, no rebuild.
//
// This replaces the old next.config `rewrites()` (which baked the engine origin
// into the build). No CORS is involved — the browser talks only to this origin.
import { type NextRequest } from "next/server";

// Force the Node.js runtime (we use fetch with arbitrary methods/bodies) and never
// cache — this is a live proxy. On Vercel this becomes a Node serverless function.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function engineOrigin(): string {
  return (process.env.ENGINE_ORIGIN ?? "http://localhost:8080").replace(/\/+$/, "");
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const target = `${engineOrigin()}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    ...(hasBody ? { body: await req.text() } : {}),
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (e) {
    // Engine unreachable (wrong ENGINE_ORIGIN, engine down) — surface a clear 502.
    return Response.json(
      { error: "engine unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const body = await upstream.arrayBuffer();
  const respHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) respHeaders.set("content-type", upstreamType);
  return new Response(body, { status: upstream.status, headers: respHeaders });
}

// In Next 15 route handlers receive `params` as a Promise.
type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => proxy(req, (await ctx.params).path);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
