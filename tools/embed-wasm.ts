#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Embed `wasm/flatdata.wasm` in `src/wasm/flatdata-wasm.ts` as base64.
 *
 * The library can't read the `.wasm` file at run time: installed from JSR, its
 * modules have `https:` URLs, and `Deno.readFile` reads only local files.
 * Embedded, the module loads anywhere without extra permissions.
 *
 * Run after rebuilding the `.wasm` (`build.sh` does).
 */

const root = new URL("../", import.meta.url);
const wasm = await Deno.readFile(new URL("wasm/flatdata.wasm", root));

await Deno.writeTextFile(
  new URL("src/wasm/flatdata-wasm.ts", root),
  `// Generated from wasm/flatdata.wasm by tools/embed-wasm.ts. Do not edit.\n\n` +
    `/** The flatdata WASM module, base64-encoded. */\n` +
    `export const FLATDATA_WASM_BASE64 =\n  "${wasm.toBase64()}";\n`,
);
