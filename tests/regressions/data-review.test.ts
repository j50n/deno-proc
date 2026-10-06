/**
 * Claims from the review of the data formats before 0.26.0: every reader and
 * writer either keeps the data or throws, naming where.
 */

import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  csvToTsv,
  fromCsvToLazyRows,
  fromCsvToRows,
  fromJsonToRows,
  fromTsvToRows,
  LazyRow,
  toCsv,
  toJson,
  toRecord,
  toTsv,
  tsvToCsv,
} from "../../src/transforms/mod.ts";
import { readRows } from "../../src/wasm/flatdata.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = (text: string) => enumerate([encoder.encode(text)]);

async function text(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  let out = "";
  for await (const chunk of chunks) out += decoder.decode(chunk);
  return out;
}

/**
 * Runs `body` with `WebAssembly.instantiate` wrapped, so the test sees each
 * instance the module makes, after `patch` has had a chance to change its
 * exports.
 */
async function withInstances<T>(
  body: (instances: WebAssembly.Instance[]) => Promise<T>,
  patch: (exports: Record<string, unknown>) => void = () => {},
): Promise<T> {
  const original = WebAssembly.instantiate;
  const instances: WebAssembly.Instance[] = [];
  const wrapped = async (
    module: WebAssembly.Module,
    imports?: WebAssembly.Imports,
  ) => {
    const instance = await original(module, imports);
    const exports = { ...instance.exports } as Record<string, unknown>;
    patch(exports);
    instances.push(instance);
    return { exports } as unknown as WebAssembly.Instance;
  };
  Object.assign(WebAssembly, { instantiate: wrapped });
  try {
    return await body(instances);
  } finally {
    Object.assign(WebAssembly, { instantiate: original });
  }
}

// An allocation the module can't make traps; that must reach the caller as a
// plain Error saying what was too large, not `RuntimeError: unreachable`.

Deno.test("An allocation the module can't make throws an Error saying it was too large, with the trap as its cause.", async () => {
  // Buffers for 500 MB chunks need more than the 4 GiB a wasm32 memory has.
  // The pages are never touched, so this costs no real memory.
  const error = await assertRejects(
    async () => {
      for await (const _ of readRows(bytes("a\n"), 0x2C, true, 500_000_000)) {
        // nothing
      }
    },
    Error,
    "Row too large for the WebAssembly module's memory in CSV data",
  );
  assertInstanceOf(error.cause, WebAssembly.RuntimeError);
  assert(!(error instanceof WebAssembly.RuntimeError));
});

Deno.test("A feed that traps names the row it was growing a buffer for.", async () => {
  let feeds = 0;
  const trapOnSecondFeed = (exports: Record<string, unknown>) => {
    const feed = exports.reader_feed as (...args: number[]) => number;
    exports.reader_feed = (...args: number[]) => {
      const size = feed(...args);
      if (++feeds === 2) throw new WebAssembly.RuntimeError("unreachable");
      return size;
    };
  };
  const csv = "a,b\nc,d\n" + "x".repeat(200) + "\n";
  const error = await withInstances(
    () =>
      assertRejects(
        async () => {
          for await (const _ of readRows(bytes(csv), 0x2C, true, 64)) {
            // nothing
          }
        },
        Error,
        "Row too large for the WebAssembly module's memory in CSV data at row 3",
      ),
    trapOnSecondFeed,
  );
  assertInstanceOf(error.cause, WebAssembly.RuntimeError);
});

Deno.test("tsvToCsv holds a long field in about seven times its size, not twelve.", async () => {
  const field = "x".repeat(16 * 2 ** 20);
  const memory = await withInstances(async (instances) => {
    const csv = await text(bytes(`${field}\n`).transform(tsvToCsv()));
    assertEquals(csv.length, field.length + 1);
    return (instances[0].exports.memory as WebAssembly.Memory).buffer
      .byteLength;
  });
  assert(memory < 8 * field.length, `${memory / 2 ** 20} MiB`);
});

// An unclosed quote used to take in the rest of the input as one field.

Deno.test("An unclosed quote throws from every CSV reader, naming the row and field where it opened.", async () => {
  const csv = 'a,b\nc,"d\ne,f\n';
  const message = "Unclosed quote in CSV data at row 2, field 2";
  await assertRejects(
    () => bytes(csv).transform(fromCsvToRows()).collect(),
    Error,
    message,
  );
  await assertRejects(
    () => bytes(csv).transform(fromCsvToLazyRows()).collect(),
    Error,
    message,
  );
  await assertRejects(
    () => text(bytes('a,b\nc,"d e,f').transform(csvToTsv())),
    Error,
    message,
  );
});

Deno.test("A quote closed at the very end is no error.", async () => {
  assertEquals(
    await bytes('a,"b\nc"').transform(fromCsvToRows()).flatten().collect(),
    [["a", "b\nc"]],
  );
});

// A row that would be written as a blank line reads back as no row.

Deno.test("toTsv refuses a row of one empty field, which would be a blank line.", async () => {
  await assertRejects(
    () => text(enumerate([["a"], [""], ["b"]]).transform(toTsv())),
    Error,
    "Invalid row (one empty field) in TSV data at row 2",
  );
});

Deno.test("csvToTsv refuses a CSV row of one empty field.", async () => {
  await assertRejects(
    () => text(bytes('a\n""\nb\n').transform(csvToTsv())),
    Error,
    "Invalid row (one empty field) in TSV data at row 2",
  );
});

Deno.test("Every row writer refuses a row with no fields, from a string array or a LazyRow.", async () => {
  const lazy = LazyRow.fromStringArray;
  const writers = [[toCsv, "CSV"], [toTsv, "TSV"], [
    toRecord,
    "record",
  ]] as const;
  for (const [writer, format] of writers) {
    const message = `Invalid row (no fields) in ${format} data at row 2`;
    await assertRejects(
      () => text(enumerate([[["a"], []]]).transform(writer())),
      Error,
      message,
    );
    await assertRejects(
      () => text(enumerate([[lazy(["a"]), lazy([])]]).transform(writer())),
      Error,
      message,
    );
  }
});

Deno.test("An item [] is an empty batch, and every row writer writes nothing for it.", async () => {
  const writers = [[toCsv, "a\n"], [toTsv, "a\n"], [
    toRecord,
    "a\x1E",
  ]] as const;
  for (const [writer, written] of writers) {
    assertEquals(
      await text(enumerate([[], ["a"]]).transform(writer())),
      written,
    );
  }
});

Deno.test("toCsv writes a row of one empty field as a quoted empty field.", async () => {
  const csv = await text(enumerate([[""]]).transform(toCsv()));
  assertEquals(csv, '""\n');
  assertEquals(
    await bytes(csv).transform(fromCsvToRows()).flatten().collect(),
    [
      [""],
    ],
  );
});

// fromJsonToRows({ schema }) used to throw away what schema.parse returned.

Deno.test("fromJsonToRows yields what schema.parse returns.", async () => {
  const schema = {
    parse: (value: unknown) => ({
      ...(value as Record<string, unknown>),
      seen: true,
    }),
  };
  assertEquals(
    await bytes('{"a":1}\n{"a":2}\n').transform(fromJsonToRows({ schema }))
      .flatten().collect(),
    [{ a: 1, seen: true }, { a: 2, seen: true }] as unknown[],
  );
});

Deno.test("Values after sampleSize are yielded as JSON.parse made them.", async () => {
  const schema = { parse: (value: unknown) => ({ wrapped: value }) };
  assertEquals(
    await bytes("1\n2\n3\n").transform(
      fromJsonToRows({ schema, sampleSize: 1 }),
    ).flatten().collect(),
    [{ wrapped: 1 }, 2, 3] as unknown[],
  );
});

// toJson takes one value per item, the reverse of fromJsonToRows().flatten().

Deno.test("toJson writes each item as one value, arrays included.", async () => {
  assertEquals(
    await text(enumerate([[1, 2], { a: [3] }, "s"]).transform(toJson())),
    '[1,2]\n{"a":[3]}\n"s"\n',
  );
});

Deno.test("toJson round-trips what fromJsonToRows().flatten() reads.", async () => {
  const jsonl = '[1,2]\n{"a":null}\n"s"\n7\n';
  const values = await bytes(jsonl).transform(fromJsonToRows()).flatten()
    .collect();
  assertEquals(await text(enumerate(values).transform(toJson())), jsonl);
});

Deno.test("toJson refuses an item JSON can't represent, naming it.", async () => {
  const cases: [unknown, string][] = [
    [undefined, "Item 2 can't be written as JSON (undefined)"],
    [() => 1, "Item 2 can't be written as JSON (function)"],
    [Symbol("s"), "Item 2 can't be written as JSON (symbol)"],
  ];
  for (const [value, message] of cases) {
    await assertRejects(
      () => text(enumerate([1, value]).transform(toJson())),
      TypeError,
      message,
    );
  }
  const error = await assertRejects(
    () => text(enumerate([1, 2n]).transform(toJson())),
    TypeError,
    "Item 2 can't be written as JSON",
  );
  assertInstanceOf(error.cause, TypeError);
});

// Row numbers in errors are plain numbers, the same in every locale.

Deno.test("Row numbers in errors have no thousands separators.", async () => {
  const rows = Array.from({ length: 1234 }, (_, i) => [String(i)]);
  rows.push(["a\tb"]);
  await assertRejects(
    () => text(enumerate([rows]).transform(toTsv())),
    Error,
    "Invalid character (tab) in TSV data at row 1235, field 1",
  );
  const tsv = "a\n".repeat(1234) + "b\rc\n";
  await assertRejects(
    () => bytes(tsv).transform(fromTsvToRows()).collect(),
    Error,
    "Invalid character (CR) in TSV data at row 1235, field 1",
  );
});

// Every separator CSV can't use is a RangeError, whatever its type.

Deno.test("A separator that isn't a string throws a RangeError.", () => {
  for (const separator of [null, 0, 44, {}, [","], true]) {
    const options = { separator } as unknown as { separator: string };
    assertThrows(() => fromCsvToRows(options), RangeError);
    assertThrows(() => fromCsvToLazyRows(options), RangeError);
    assertThrows(() => toCsv(options), RangeError);
    assertThrows(() => csvToTsv(options), RangeError);
    assertThrows(() => tsvToCsv(options), RangeError);
  }
});

// fieldEquals used to encode a lone surrogate as U+FFFD and match it.

Deno.test("fieldEquals with a lone surrogate matches no field.", async () => {
  const [row] = await bytes("�,a\n").transform(fromCsvToLazyRows())
    .flatten().collect();
  assert(row.fieldEquals(0, "�"));
  assert(!row.fieldEquals(0, "\uD800"));
  assert(!row.fieldEquals(0, "\uDFFF"));
  assert(row.fieldEquals(1, "a"));
});

// A U+FEFF at the very start of the output is a byte order mark, which every
// reader drops; written there unprotected, it was lost on the way back.

Deno.test("toCsv and tsvToCsv quote a first field that starts with U+FEFF, so it reads back.", async () => {
  const rows = [["﻿a", "b"], ["﻿c"]];
  const csv = await text(enumerate([rows]).transform(toCsv()));
  assertEquals(csv, '"﻿a",b\n﻿c\n');
  assertEquals(
    await bytes(csv).transform(fromCsvToRows()).flatten().collect(),
    rows,
  );
  // The TSV reader drops the first byte order mark; the second is data.
  const converted = await text(
    bytes("﻿﻿a\tb\n﻿c\n").transform(tsvToCsv()),
  );
  assertEquals(converted, csv);
});

Deno.test("toTsv, toRecord, and csvToTsv refuse a first field that starts with U+FEFF.", async () => {
  for (
    const [writer, format] of [[toTsv, "TSV"], [toRecord, "record"]] as const
  ) {
    await assertRejects(
      () => text(enumerate([["﻿a", "b"]]).transform(writer())),
      Error,
      `Invalid character (byte order mark) in ${format} data at row 1, field 1`,
    );
    assertEquals(
      await text(enumerate([[["a"], ["﻿b"]]]).transform(writer())),
      format === "TSV" ? "a\n﻿b\n" : "a\x1E﻿b\x1E",
    );
  }
  await assertRejects(
    () => text(bytes('"﻿a",b\n').transform(csvToTsv())),
    Error,
    "Invalid character (byte order mark) in TSV data at row 1, field 1",
  );
  assertEquals(
    await text(bytes('a\n"﻿b"\n').transform(csvToTsv())),
    "a\n﻿b\n",
  );
});

// TextEncoder writes U+FFFD for a lone surrogate, which UTF-8 can't hold.

Deno.test("Every row writer refuses a field holding a lone surrogate, naming it.", async () => {
  const writers = [[toCsv, "CSV"], [toTsv, "TSV"], [
    toRecord,
    "record",
  ]] as const;
  for (const [writer, format] of writers) {
    await assertRejects(
      () =>
        text(enumerate([[["a", "🎉"], ["b", "x\uD800y"]]]).transform(writer())),
      Error,
      `Invalid character (lone surrogate) in ${format} data at row 2, field 2`,
    );
    await assertRejects(
      () => text(enumerate([["a"], ["\uDFFF"]]).transform(writer())),
      Error,
      `Invalid character (lone surrogate) in ${format} data at row 2, field 1`,
    );
  }
});
