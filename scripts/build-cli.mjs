import { build } from "esbuild";

// When esbuild bundles CJS dependencies into ESM format, it creates a __require
// shim that checks `typeof require !== "undefined"`. In pure ESM contexts (Node.js
// with "type":"module"), `require` is undefined, causing:
//   "Dynamic require of 'util' is not supported"
//
// Fix: inject `createRequire` in the banner so the shim finds a working `require`.
const banner = [
  "#!/usr/bin/env node",
  'import { createRequire as __createRequire } from "node:module";',
  "const require = __createRequire(import.meta.url);"
].join("\n");

await build({
  entryPoints: ["src/cli/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false, // keep readable for debugging in V1
  legalComments: "none",
  logLevel: "info",
  banner: { js: banner },
  // undici is bundled for proxy support
  outfile: "dist/duoduo-widget.js"
});
