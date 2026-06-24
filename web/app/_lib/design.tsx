import { readFileSync } from "fs";
import { join } from "path";

/**
 * Renders an approved design canvas verbatim.
 *
 * The markup in `app/_content/*.html` is the body of the corresponding
 * Claude Design canvas (see `web/design-src/`), kept byte-for-byte so the
 * implemented pages stay pixel-identical to the source. It is read at build
 * time (these routes are statically generated) and injected as-is — the inline
 * styles and inline SVGs work unchanged, which is why this is the embed
 * approach rather than a hand-rewrite into TSX.
 */
export function Design({ file }: { file: string }) {
  const html = readFileSync(join(process.cwd(), "app/_content", file), "utf8");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
