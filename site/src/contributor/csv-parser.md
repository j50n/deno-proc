# The CSV reader

The CSV and TSV parsers, `csvToTsv()`, `tsvToCsv()`, and the `flatdata` CLI all
run on one WebAssembly module, built from Embedded Swift in `swift/`. It is
about 12 KB and has no imports. This page is the map; the doc comments in
`swift/Sources/` carry the details, and `src/wasm/flatdata.ts` is the TypeScript
side.

## What it reads

| Input                               | Result                                     |
| ----------------------------------- | ------------------------------------------ |
| `"a, b"` (quoted separator)         | `a, b`                                     |
| `"say ""hi"""` (doubled quote)      | `say "hi"`                                 |
| `"two` LF `lines"`                  | the line break is kept                     |
| `ab"c` (quote inside a field)       | `ab"c`: the quote is content               |
| `"a"b` (text after a closing quote) | `ab`                                       |
| LF or CRLF                          | ends a row                                 |
| any other CR outside quotes         | an error naming its row and field          |
| CR inside quotes                    | content                                    |
| blank line                          | no row                                     |
| `""` alone on a line                | a row of one empty field                   |
| a quote still open at the end       | an error naming where the quote opened     |
| UTF-8 byte order mark at the start  | dropped (in TypeScript, before the module) |

TSV is the same reader with a tab separator and quoting off, so a quote is
content and the CR rule holds everywhere. A CR that ends the input is an error
too, which is why a CR-only file fails at its first line end instead of reading
as one long row.

## The lexer

`CSVLexer` (`swift/Sources/CSV/CSVLexer.swift`) is the state machine behind the
reader and `csvToTsv()`. It finds the bytes that can matter (quote, LF, CR, the
separator, and one `extra` byte a sink asks for, such as a tab for `csvToTsv`)
64 at a time: the SIMD classifiers in `swift/Sources/SIMDKernels/` compare four
16-byte vectors and return a 64-bit mask. The lexer walks the set bits; the
bytes between them go to the sink as one run. A scalar step on each candidate
byte decides what it is, with four states: field start, unquoted, quoted, and
quote in quoted. The SIMD finds candidates and the state machine decides, so a
separator inside quotes is just content. Runs are copied 16 bytes at a time.

A CR outside quotes looks at the next byte. When the CR ends a chunk, the next
chunk's first byte decides. On a CR it refuses, the scan stops and the sink
records the row and field, counted from 1, through `StreamOperation`'s
`refusal`; a feed then returns -1, and `src/wasm/flatdata.ts` turns that into
the `Invalid character (CR) in CSV data at row N, field M` error. Refusing is
kept out of the hot loop, because carrying its state through every iteration
cost 10 to 20%. A quote still open when the stream ends is refused the same way,
as a different `Refusal` kind, at the row and field where it opened: no field or
row ends inside quotes, so the sink is still there.

The three operations differ in what they write:

- `CSVReader` writes each row in record format (a field ends in `0x1F`, the last
  of a row in `0x1E`) and records where every field ends: `byteEnds` in the
  output bytes and `textEnds` in UTF-16 code units of those bytes decoded. The
  lexer counts UTF-8 continuation bytes and 4-byte leads with SIMD too, so
  `textEnds` costs no extra pass. Only whole rows go out: a row cut off by the
  end of a chunk moves to the front of the buffer for the next feed, so a row
  never straddles two batches, and a row longer than a chunk just grows the
  buffer.
- `CSVToTSV` writes fields with tabs and rows with LF, and refuses a tab, CR, or
  LF inside a field, which TSV can't hold, and a row of one empty field, which
  would be a blank line. Its output is not held back.
- `TSVToCSV` has a simpler scanner of its own, on the same SIMD classifiers,
  since TSV has no quoting. It quotes a field only when the field holds the
  separator or a quote, which it knows only at the field's end, so a field cut
  off by a chunk is carried to the next one.

## From bytes to rows

`readRows()` copies the input into the module's buffer in chunks of
`BATCH_SIZE_BYTES` (128 KiB), however the source chunked it, and feeds each one.
A batch is the complete rows that chunk finished, as views of WASM memory.
`batchRows()` in `src/transforms/common.ts` decodes the whole batch with one
`TextDecoder` call and slices fields out by `textEnds`; that is several times
faster than decoding field by field. `lazyRows()` in `lazy-row.ts` copies the
batch out of WASM memory and wraps each row, so `getField` decodes one field by
`byteEnds`, and `fieldEquals` compares bytes without decoding.

## Memory

Each stream gets its own module instance (the module is compiled once), and
drops it when the stream ends. That is the only way memory is released: the
allocator, `swift/Sources/Arena/arena.c`, is a bump arena whose `free` does
nothing. It suffices because wasm memory can't shrink anyway, and buffers grow
by doubling, so what a stream abandons is less than what it uses. One instance
per stream also means two streams read at once never share state.

What bounds the memory is the longest row, not the input: the reader holds a row
whole, and `TSVToCSV` holds a field whole, in its input and again in its output,
where it reserves the field's size plus its quotes. The arena grows memory by
just what an allocation needs, so a stream's memory runs to about 2 times its
longest row in the reader and 5 to 7 times its longest field in `tsvToCsv()`,
depending on where the doubling buffers land (measured: a field of 128 MiB took
896 MiB, one of 512 MiB took 2,561 MiB). Before, the arena doubled memory too
and `TSVToCSV` reserved three times the field, and the same 128 MiB took 1,536
MiB. `csvToTsv()` holds nothing back and runs in constant memory.

A wasm32 memory can't pass 4 GiB. When an allocation can't be made, the arena
traps: the Embedded Swift runtime doesn't check for a null pointer, and would
write through it into the module's own memory at address 0. Every operation sets
`currentRow` before it grows a buffer, so after the trap the TypeScript side
reads `current_row` and throws
`Row too large for the WebAssembly module's memory in CSV data at row N` (for
`tsvToCsv()`, `Field too large ...`), with the `RuntimeError` as its cause. In
practice that is a row, or a `tsvToCsv()` field, of around a gigabyte. The
exports return pointers as `i32`, which JavaScript reads as negative past 2 GiB,
so `src/wasm/flatdata.ts` reads every pointer through `address()`
(`pointer >>> 0`).

## Tests

`tests/transforms/reference.ts` is a plain TypeScript reader and writer for CSV
and TSV, written the slow, obvious way and sharing no code with the module.
`readers.test.ts` and `convert.test.ts` check the module against it on a list of
edge cases at chunk sizes of 1, 7, 63, 64, 65, and 1,000 bytes, which puts a
chunk boundary at every position that matters: inside a CRLF, a doubled quote, a
UTF-8 character, a SIMD block. They also cover fields of several megabytes, CR
and unclosed-quote refusals with their row and field, a byte order mark split
across chunks, invalid UTF-8, and streams read at the same time.
`round-trip.test.ts` checks that what the writers write reads back the same.

[Building and releasing](./build-process.md#the-webassembly-module) covers the
build.
