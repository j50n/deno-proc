/**
 * The module returns pointers as `i32`, which JavaScript reads as signed, so
 * an address past 2 GiB came back negative and every view of it threw.
 */

import { assertEquals } from "@std/assert";
import { address } from "../../src/wasm/flatdata.ts";

Deno.test("An address past 2 GiB, returned as a negative i32, reads as the address.", () => {
  assertEquals(address(5), 5);
  assertEquals(address(2 ** 31 - 1), 2 ** 31 - 1);
  assertEquals(address(-(2 ** 31)), 2 ** 31);
  assertEquals(address(-1878323152), 2416644144);
  assertEquals(address(-1), 2 ** 32 - 1);
});

Deno.test("Every pointer an export returns is read through address().", async () => {
  // The exports that return pointers, named in the source, each read as
  // address(wasm.<name>(...)).
  const source = await Deno.readTextFile(
    new URL("../../src/wasm/flatdata.ts", import.meta.url),
  );
  const pointers = [
    "reader_input",
    "reader_output",
    "reader_byte_ends",
    "reader_text_ends",
    "csv2tsv_input",
    "csv2tsv_output",
    "tsv2csv_input",
    "tsv2csv_output",
  ];
  for (const name of pointers) {
    const calls = source.match(new RegExp(`wasm\\.${name}\\(`, "g")) ?? [];
    const wrapped =
      source.match(new RegExp(`address\\(wasm\\.${name}\\(`, "g")) ?? [];
    assertEquals(wrapped.length, calls.length, name);
    assertEquals(calls.length > 0, true, name);
  }
});
