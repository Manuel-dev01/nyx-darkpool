import { dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The design surfaces are fully static; nothing dynamic to configure.
  reactStrictMode: true,
  // This project lives inside a larger repo with other lockfiles; pin the
  // file-tracing root to this app so Next doesn't infer a parent directory.
  outputFileTracingRoot: here,
};

export default nextConfig;
