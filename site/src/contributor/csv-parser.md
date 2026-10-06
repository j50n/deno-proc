# CSV parser specification

This page describes what the CSV parsers in the WebAssembly module actually do,
bugs included, so a contributor changing or replacing them knows the behavior
callers see today. The code is in Odin, in `odin/src/exports.odin` (the parsers
that run) and `odin/src/csv/csv.odin` (shared types, the writers, and parsers
nothing calls). The maintainer is rewriting them; until that lands, this is the
behavior a replacement has to keep or deliberately change.

## Which parser runs where

The WASM module exports three CSV parsers. Two are used:

| Parser                     | Entry points (`exports.odin`)                                               | Used by                                                      |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| LazyRow direct parser      | `create_lazyrow_direct_parser`, `parse_to_lazyrow`, `finish_lazyrow_direct` | `fromCsvToRows`, `fromCsvToLazyRows`, `flatdata csv2lazyrow` |
| Direct parser              | `create_direct_parser`, `parse_direct`, `finish_direct`                     | `flatdata csv2record`, `flatdata csv2tsv`                    |
| Delimited and span parsers | `create_delimited_parser`, `create_span_parser`, ...                        | nothing                                                      |

The delimited parser in `csv/csv.odin` is the one with a strict mode, error
positions, and an expected field count. No TypeScript calls it, so none of that
is reachable from the library or the CLI. The direct parser takes a `strict`
argument, always passed 0, and ignores it.

On the TypeScript side, `FlatdataProcessor` (`src/wasm/flatdata-processor.ts`)
copies each input chunk into WASM memory in slices of at most 64 KiB
(`CHUNK_SIZE`) and calls the parser once per slice, then once more to finish.
`csvToLazyRowsStreaming` reads the length-prefixed rows the LazyRow parser
writes and yields them in batches of 100 as binary-backed `LazyRow`s;
`fromCsvToRows` converts each batch with `toStringArray()`. The separator is
checked in `csvSeparator()` in `src/transforms/csv.ts` (one ASCII character, not
`"`, CR, or LF); the CLI passes `separator.charCodeAt(0)` unchecked.

## The state machine

Both parsers work on bytes, so UTF-8 passes through untouched; decoding happens
later, in TypeScript. They share five states (`CsvState`): `FieldStart`,
`Unquoted`, `Quoted`, `QuoteInQuoted` (just saw a `"` inside quotes), and
`RecordEnd` (just saw a CR). "LF" below is the input record separator, which the
callers always set to LF.

| State           | `"`                      | separator          | CR                 | LF                      | other byte         |
| --------------- | ------------------------ | ------------------ | ------------------ | ----------------------- | ------------------ |
| `FieldStart`    | → `Quoted`               | end empty field    | see below          | end row, if one started | keep, → `Unquoted` |
| `Unquoted`      | keep (text)              | end field          | → `RecordEnd`      | end row                 | keep               |
| `Quoted`        | → `QuoteInQuoted`        | keep               | keep               | keep                    | keep               |
| `QuoteInQuoted` | keep one `"`, → `Quoted` | end field          | → `RecordEnd`      | end row                 | **error**          |
| `RecordEnd`     | end row, reprocess       | end row, reprocess | end row, reprocess | end row                 | end row, reprocess |

A row "started" once any byte of it, a separator, or an opening quote has been
seen, so an empty line ends nothing and is skipped. Rows may have any number of
fields. A quoted field that is never closed takes the rest of the input, and the
finish call emits it.

The two parsers differ in a few places:

- **CR in `FieldStart`.** The LazyRow parser drops it and stays in `FieldStart`,
  so a CR right after a separator or at the start of a line is lost rather than
  ending the row: `a,\rb` reads as `["a", "b"]`. The direct parser goes to
  `RecordEnd`, and in `RecordEnd` writes a record end whether or not a row
  started, so a CRLF blank line becomes an empty record while an LF blank line
  is skipped.
- **Output.** The LazyRow parser builds each row in fixed buffers in its state
  and appends it to the shared `output_buffer` as
  `u32 length, u32 field count, u32 length per field, bytes`. The direct parser
  writes `\x1F`/`\x1E` (or tab/LF for `csv2tsv`) into a fixed `work_buffer`,
  returns only complete records, and carries the incomplete one to the next
  call.

## The silent-stop bug

In `QuoteInQuoted`, any byte other than `"`, the separator, CR, or LF sets
`p.error` to `InvalidCharAfterQuote` and returns 0. Inputs like `"ab" ,c`,
`"ab"cd`, and `"a"b"` trigger it. The error is never reported (no export reads
it), so:

- The call that hits it returns 0, so the rows it had already written to the
  output for that slice are never handed to TypeScript.
- Every later `parse_to_lazyrow` / `parse_direct` call returns 0 at once.
- `finish_lazyrow_direct` doesn't check the error. It emits the row in progress,
  so the last row the library yields is the fragment before the bad byte:
  `id,name\n1,Ada\n"2" ,Grace\n` yields only `[["2"]]`.
- `parse_direct` returns before refilling its carry, so `finish_direct` emits
  nothing, and the CLI exits 0 with its output cut short, often to nothing.

Rows from earlier slices have already been yielded, so the loss starts at the
beginning of the slice (at most 64 KiB) holding the bad byte. A fix needs the
error to reach TypeScript (an export to read it, or a negative return) so the
transforms can throw. Another option is leniency: keep the text after the quote
as part of the field, as a quote inside an unquoted field already is.

## Limits

These fail silently too:

| Limit                  | Parser  | What happens past it                                                                                                        |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `MAX_FIELDS` = 1,024   | LazyRow | no more field lengths are recorded; the rest of the row's text, without separators, ends up in field 1,024                  |
| `MAX_ROW_DATA` = 4 MiB | LazyRow | bytes past 4 MiB of field text in a row are dropped                                                                         |
| `work_buffer` = 2 MiB  | direct  | bytes past 2 MiB per call are dropped, record ends included, so a long row loses its end and the rows after it in the slice |

The fixed buffers live inside each parser's state, so creating a LazyRow parser
allocates about 4 MiB, and a direct parser 2 MiB.

## The writers

`toCsv` frames its rows in the LazyRow binary layout and calls `lazyrow_to_csv`
(`csv/csv.odin`). A field is quoted if it holds the separator, `"`, CR, or LF,
with each `"` doubled; otherwise it is copied as it is. Rows end in LF, or CRLF.
A row of no fields, or of one empty field, becomes an empty line, which the
parsers then skip. The output buffer is sized at twice the input, which covers
the worst case (every byte a quote). `toTsv` and `toRecord` check fields in
TypeScript, then use `lazyrow_to_tsv` and `lazyrow_to_record` for binary-backed
LazyRows; those don't check anything.

## Tests and build

`odin/build.sh` runs `odin test src/csv` and builds `wasm/flatdata.wasm`; the
root `build.sh` then runs `tools/embed-wasm.ts`, which writes the module into
`src/wasm/flatdata-wasm.ts` as base64 (installed from JSR, the library can't
read a `.wasm` file). The Odin tests in `odin/src/csv/csv_test.odin` exercise
the delimited parser, which nothing uses; the two parsers that run have no Odin
tests. Their behavior is covered from TypeScript, in
`tests/transforms/csv.test.ts` and the `tests/flatdata*` tests. None of them
feeds text after a closing quote or exceeds a limit. `odin/test.sh` points at
`odin/tests/`, which doesn't exist.
