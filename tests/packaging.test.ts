import { assertEquals } from "@std/assert";
import { walk } from "jsr:@std/fs@1/walk";
import config from "../deno.json" with { type: "json" };
import { FLATDATA_WASM_BASE64 } from "../src/wasm/flatdata-wasm.ts";

const root = new URL("../", import.meta.url);

Deno.test("The embedded WASM module matches wasm/flatdata.wasm.", async () => {
  const built = await Deno.readFile(new URL("wasm/flatdata.wasm", root));
  assertEquals(
    FLATDATA_WASM_BASE64,
    built.toBase64(),
    "run tools/embed-wasm.ts",
  );
});

Deno.test("Every documented import of the package names a real export.", async () => {
  const exported = new Set(
    Object.keys(config.exports).map((key) => key.replace(/^\./, "")),
  );
  const importOf = /@j50n\/proc(?:@[^\s"'`/]+)?(\/[\w.\-/]*)?["'`]/g;
  const missing: string[] = [];

  const files = ["README.md", "mod.ts"].map((path) => new URL(path, root));
  for (const dir of ["src", "site/src"]) {
    for await (
      const entry of walk(new URL(dir, root), {
        exts: [".md", ".ts"],
        skip: [/api-docs/],
      })
    ) {
      files.push(new URL(`file://${entry.path}`));
    }
  }

  for (const file of files) {
    const text = await Deno.readTextFile(file);
    for (const [, subpath = ""] of text.matchAll(importOf)) {
      if (!exported.has(subpath)) {
        missing.push(
          `${file.pathname.slice(root.pathname.length)}: ${subpath}`,
        );
      }
    }
  }

  assertEquals(missing, []);
});
