import { assertEquals } from "@std/assert";
import { enumerate } from "../mod.ts";

/*
 * `.lines` against a reference that needs no streaming: split the bytes on LF
 * (never part of a longer character), decode each line on its own, drop one
 * CR from the end of each, and drop the empty piece after a final newline.
 * Invalid UTF-8 is an error naming its line, after the lines before it. The
 * input is random bytes chosen to hit LF, CR, multibyte characters, a BOM and
 * invalid sequences, cut into random chunks, some empty.
 */

/** A small seeded generator, so a failure can be run again. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = [
  0x61, // a
  0x0A, // LF
  0x0D, // CR
  0xE2,
  0x82,
  0xAC, // €
  0xF0,
  0x9F,
  0x98,
  0x80, // 😀
  0xEF,
  0xBB,
  0xBF, // BOM
  0xFF, // never valid
  0x80, // a continuation byte alone
];

function reference(bytes: Uint8Array): string[] {
  const out: string[] = [];
  let start = 0;
  for (let n = 1;; n++) {
    let end = bytes.indexOf(0x0A, start);
    const last = end === -1;
    if (last) end = bytes.length;
    let line: string;
    try {
      // A BOM is dropped only at the very start.
      line = new TextDecoder("utf-8", { fatal: true, ignoreBOM: start !== 0 })
        .decode(bytes.subarray(start, end));
    } catch {
      out.push(`ERROR Invalid UTF-8 at line ${n}`);
      return out;
    }
    if (last && line === "") return out;
    out.push(line.endsWith("\r") ? line.slice(0, -1) : line);
    if (last) return out;
    start = end + 1;
  }
}

async function lines(chunks: Uint8Array[]): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const line of enumerate(chunks).lines) out.push(line);
  } catch (e) {
    out.push(`ERROR ${(e as Error).message}`);
  }
  return out;
}

Deno.test(".lines matches a line-at-a-time reference on random bytes in random chunks.", async () => {
  const next = random(20261006);
  for (let run = 0; run < 20_000; run++) {
    const bytes = Uint8Array.from(
      { length: Math.floor(next() * 24) },
      () => ALPHABET[Math.floor(next() * ALPHABET.length)],
    );
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length;) {
      const size = next() < 0.1 ? 0 : 1 + Math.floor(next() * 6);
      chunks.push(bytes.slice(i, i + size));
      i += size;
    }
    assertEquals(
      await lines(chunks),
      reference(bytes),
      `bytes ${[...bytes]} in chunks of ${chunks.map((c) => c.length)}`,
    );
  }
});
