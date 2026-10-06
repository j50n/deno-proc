# API at a glance

Everything `@j50n/proc` and `@j50n/proc/transforms` export, grouped by what you
would use it for, one line each. Each name links to its full entry on JSR.
[Key ideas](../start/key-ideas.md) explains how the pieces fit.

```typescript
import { enumerate, read, run } from "@j50n/proc";
import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
```

## Running commands

- [`run(...cmd)`](https://jsr.io/@j50n/proc/doc/~/run): start a command now;
  returns its stdout to read. Options go first: `run({ cwd, env }, "ls")`.
- [`.run(...cmd)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.run):
  pipe the items (lines or bytes) into a command's stdin; returns its output.
- [`ProcessEnumerable`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable): what
  `run()` returns; an `Enumerable` of stdout bytes, plus `.pid` and `.status`.
- [`.status`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable.prototype.status):
  a promise of the exit status, without throwing on failure. A getter.
- [`.pid`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable.prototype.pid): the
  child's process ID. A getter.
- [`ProcessOptions`](https://jsr.io/@j50n/proc/doc/~/ProcessOptions): `cwd`,
  `env`, `fnStderr`, `fnError`, `buffer`.
- [`StderrHandler`](https://jsr.io/@j50n/proc/doc/~/StderrHandler): the type of
  `fnStderr`, which reads the child's stderr instead of letting it reach the
  terminal.
- [`ErrorHandler`](https://jsr.io/@j50n/proc/doc/~/ErrorHandler): the type of
  `fnError`, which decides what a failure throws, or suppresses it.
- [`Cmd`](https://jsr.io/@j50n/proc/doc/~/Cmd): a command and its arguments,
  `[program, ...args]`.
- [`Process`](https://jsr.io/@j50n/proc/doc/~/Process): the low-level child
  process under `run()`; use it to write stdin as you go, or to choose how each
  stream is connected.
- [`ProcessStreamOptions`](https://jsr.io/@j50n/proc/doc/~/ProcessStreamOptions):
  options for `new Process`: `ProcessOptions` plus `stdin`, `stdout`, `stderr`.
- [`PipeKinds`](https://jsr.io/@j50n/proc/doc/~/PipeKinds): `"piped"`,
  `"inherit"`, or `"null"`.

## Errors

- [`ProcessError`](https://jsr.io/@j50n/proc/doc/~/ProcessError): base class of
  the four below; catch it to handle any process failure.
- [`ExitCodeError`](https://jsr.io/@j50n/proc/doc/~/ExitCodeError): a command
  exited non-zero; `.code`, `.command`.
- [`SignalError`](https://jsr.io/@j50n/proc/doc/~/SignalError): a command was
  killed by a signal; `.signal`, `.command`.
- [`TimeoutError`](https://jsr.io/@j50n/proc/doc/~/TimeoutError): a command ran
  past its `timeoutMs` and was stopped; `.timeoutMs`, `.command`.
- [`UpstreamError`](https://jsr.io/@j50n/proc/doc/~/UpstreamError): a command
  succeeded but its input failed; `.cause` is the original error.

## Shutting down

- [`main(program, { timeoutMs })`](https://jsr.io/@j50n/proc/doc/~/main): run
  your program, and however it ends, stop the children and wait for them before
  exiting. For containers and services.
- [`terminateAll({ signal, timeoutMs })`](https://jsr.io/@j50n/proc/doc/~/terminateAll):
  signal every child proc started and wait for them, without exiting.

## Sources

- [`enumerate(iterable)`](https://jsr.io/@j50n/proc/doc/~/enumerate): wrap an
  array, Set, generator, stream, or any (async) iterable as an `Enumerable`.
- [`read(path)`](https://jsr.io/@j50n/proc/doc/~/read): a file's bytes, opened
  when reading starts.
- [`readLines(path)`](https://jsr.io/@j50n/proc/doc/~/readLines): a UTF-8 file's
  lines; the same as `read(path).lines`.
- [`range({ from, to | until, step })`](https://jsr.io/@j50n/proc/doc/~/range):
  a sequence of numbers.
- [`RangeToOptions`](https://jsr.io/@j50n/proc/doc/~/RangeToOptions),
  [`RangeUntilOptions`](https://jsr.io/@j50n/proc/doc/~/RangeUntilOptions): the
  two shapes of `range`'s options (`to` excludes the end, `until` includes it).
- [`WritableIterable`](https://jsr.io/@j50n/proc/doc/~/WritableIterable): a
  queue you `write()` to from callbacks and read with `for await`. No
  backpressure: writes never wait.
- [`Writable`](https://jsr.io/@j50n/proc/doc/~/Writable): something with
  `write()` and `close()`: a `WritableIterable` or a process's stdin.

## Enumerable

[`Enumerable`](https://jsr.io/@j50n/proc/doc/~/Enumerable) is the async sequence
every source returns. Steps return a new `Enumerable`; consumers return a
promise. Read it once.

Steps:

- [`map(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.map):
  transform each item; `fn` may be async.
- [`filter(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.filter),
  [`filterNot(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.filterNot):
  keep, or drop, the items `fn` accepts.
- [`flatMap(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.flatMap):
  map each item to an iterable and yield its items.
- [`flatten()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.flatten):
  yield the items of each item; turns parser batches into rows.
- [`enum()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.enum): number
  the items as `[item, index]`.
- [`concurrentMap(fn, { concurrency })`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concurrentMap):
  `map` with several calls at once; results in input order.
- [`concurrentUnorderedMap(fn, { concurrency })`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concurrentUnorderedMap):
  `map` with several calls at once; results as they finish.
- [`ConcurrentOptions`](https://jsr.io/@j50n/proc/doc/~/ConcurrentOptions):
  `concurrency`, default `navigator.hardwareConcurrency`.
- [`transform(fn | stream)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.transform):
  pass the whole sequence through a transformer function or a `TransformStream`,
  such as `DecompressionStream` or `fromCsvToRows()`.
- [`take(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.take): the
  first `n` items, then close the source.
- [`drop(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.drop): skip
  the first `n` items.
- [`concat(other)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concat):
  these items, then `other`'s.
- [`zip(other)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.zip): pair
  items by position.
- [`unzip()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.unzip): split
  pairs into two Enumerables (holds items in memory, as `tee` does).
- [`tee(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.tee): split
  into `n` copies that each see every item; keeps items in memory until all have
  read them.
- [`.lines`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.lines): decode
  bytes into lines of text. A getter.
- [`.chunkedLines`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.chunkedLines):
  the same lines in arrays, one per chunk; faster for many short lines. A
  getter.
- [`run(...cmd)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.run):
  pipe into a command (see above). Starts at the call, unlike the other steps.

Consumers:

- [`collect()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.collect),
  [`toArray()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.toArray):
  every item, in an array.
- [`forEach(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.forEach):
  call `fn` on each item, waiting for each.
- [`reduce(fn, zero)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.reduce):
  fold the items into one value.
- [`count(fn?)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.count):
  how many items, or how many pass `fn`.
- [`find(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.find): the
  first item `fn` accepts, or `undefined`.
- [`some(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.some),
  [`every(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.every):
  whether any, or all, items pass `fn`.
- [`.first`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.first): a
  promise of the first item; `RangeError` if there is none. A getter.
- [`writeTo(path | stream | writable)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.writeTo):
  write to a file (bytes, or strings as lines; `{ atomic: true }` replaces it
  only once everything is written), a `WritableStream`, or a `Writable`.
- [`writeBytesTo(writer)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.writeBytesTo):
  write bytes to a `Writer & Closer` such as a `Deno.FsFile`, then close it.
- [`toStdout()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.toStdout):
  write lines or bytes to stdout.
- `for await (const item of e)`: iterate it yourself.

## Transformers

Functions to pass to `.transform()`.

- [`toLines`](https://jsr.io/@j50n/proc/doc/~/toLines),
  [`toChunkedLines`](https://jsr.io/@j50n/proc/doc/~/toChunkedLines): bytes to
  lines, or arrays of lines; what `.lines` and `.chunkedLines` use.
- [`toByteLines`](https://jsr.io/@j50n/proc/doc/~/toByteLines): split bytes into
  lines without decoding, for data that isn't UTF-8.
- [`toBytes`](https://jsr.io/@j50n/proc/doc/~/toBytes): lines of text (or bytes)
  to byte chunks, a newline after each string; use before `writeTo` or a
  `CompressionStream`.
- [`buffer(size)`](https://jsr.io/@j50n/proc/doc/~/buffer): join small byte
  chunks into chunks of at least `size` bytes.
- [`gzip`](https://jsr.io/@j50n/proc/doc/~/gzip),
  [`gunzip`](https://jsr.io/@j50n/proc/doc/~/gunzip): compress and decompress;
  for plain bytes, `CompressionStream` and `DecompressionStream` do the same.
- [`jsonParse`](https://jsr.io/@j50n/proc/doc/~/jsonParse): parse each line as
  JSON; a blank line throws.
- [`jsonStringify`](https://jsr.io/@j50n/proc/doc/~/jsonStringify): each item to
  a line of JSON.
- [`debug`](https://jsr.io/@j50n/proc/doc/~/debug): log each item as it passes
  (to stdout), unchanged.
- [`transformerFromTransformStream(stream)`](https://jsr.io/@j50n/proc/doc/~/transformerFromTransformStream):
  wrap a `TransformStream` as a transformer function.
- [`TransformerFunction`](https://jsr.io/@j50n/proc/doc/~/TransformerFunction):
  the type of a transformer, `(AsyncIterable<T>) => AsyncIterable<U>`; an
  `async function*` is the usual way to write one.
- [`TransformStream`](https://jsr.io/@j50n/proc/doc/~/TransformStream): the
  `{ writable, readable }` pair `.transform()` also accepts.
- [`StandardData`](https://jsr.io/@j50n/proc/doc/~/StandardData): what `toBytes`
  and a process's stdin accept: `string`, `string[]`, `Uint8Array`,
  `Uint8Array[]`.

`toBufferSource` is deprecated; use `toBytes`.

## Utilities

- [`sleep(ms)`](https://jsr.io/@j50n/proc/doc/~/sleep): wait.
- [`SECONDS`](https://jsr.io/@j50n/proc/doc/~/SECONDS),
  [`MINUTES`](https://jsr.io/@j50n/proc/doc/~/MINUTES),
  [`HOURS`](https://jsr.io/@j50n/proc/doc/~/HOURS),
  [`DAYS`](https://jsr.io/@j50n/proc/doc/~/DAYS),
  [`WEEKS`](https://jsr.io/@j50n/proc/doc/~/WEEKS): milliseconds, for
  `sleep(2 * SECONDS)` or a cache timeout.
- [`cache(key, value, { timeout })`](https://jsr.io/@j50n/proc/doc/~/cache):
  keep a computed value in Deno KV across runs; needs `--unstable-kv`.
- [`fetchRecord(key)`](https://jsr.io/@j50n/proc/doc/~/fetchRecord): read the
  raw cache entry, expired or not, for debugging.
- [`concat(arrays)`](https://jsr.io/@j50n/proc/doc/~/concat): join byte arrays
  into one.
- [`concatLines(arrays)`](https://jsr.io/@j50n/proc/doc/~/concatLines): join
  byte arrays with a newline after each.
- [`writeAll(data, writer)`](https://jsr.io/@j50n/proc/doc/~/writeAll): write
  all the bytes to a `Writer`, such as `Deno.stdout`.
- [`shuffle(array)`](https://jsr.io/@j50n/proc/doc/~/shuffle): shuffle in place.
- [`isString(value)`](https://jsr.io/@j50n/proc/doc/~/isString): type guard for
  a string primitive.

## Helper types

These name the result types of some methods; you rarely write them.

- [`Lines`](https://jsr.io/@j50n/proc/doc/~/Lines),
  [`ChunkedLines`](https://jsr.io/@j50n/proc/doc/~/ChunkedLines),
  [`ByteSink`](https://jsr.io/@j50n/proc/doc/~/ByteSink),
  [`Run`](https://jsr.io/@j50n/proc/doc/~/Run): what `.lines`, `.chunkedLines`,
  `writeBytesTo`, and `.run()` return; `never` when the items are the wrong
  type, so the mistake fails to type-check.
- [`ElementType`](https://jsr.io/@j50n/proc/doc/~/ElementType): the item type of
  an iterable; what `flatten()` yields.
- [`Unzip`](https://jsr.io/@j50n/proc/doc/~/Unzip): what `unzip()` returns.
- [`Tuple`](https://jsr.io/@j50n/proc/doc/~/Tuple),
  [`TupleOf`](https://jsr.io/@j50n/proc/doc/~/TupleOf): what `tee(n)` returns.

## Data formats: `@j50n/proc/transforms`

Parsers take bytes and yield **batches** (arrays of rows); add `.flatten()` for
one row at a time. Writers take rows or batches and yield bytes. See
[Data formats](../data/overview.md).

- [`fromCsvToRows(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/fromCsvToRows):
  parse CSV into batches of `string[]` rows.
- [`fromCsvToLazyRows(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/fromCsvToLazyRows):
  parse CSV into batches of `LazyRow`s, which decode a field only when read.
- [`toCsv(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/toCsv): write
  rows as CSV, quoting where needed.
- [`csvToTsv(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/csvToTsv),
  [`tsvToCsv(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/tsvToCsv):
  convert CSV to TSV and back, bytes to bytes, without making rows.
- [`CsvParseOptions`](https://jsr.io/@j50n/proc/doc/transforms/~/CsvParseOptions),
  [`CsvStringifyOptions`](https://jsr.io/@j50n/proc/doc/transforms/~/CsvStringifyOptions):
  `separator`, and `crlf` for writing.
- [`fromTsvToRows()`](https://jsr.io/@j50n/proc/doc/transforms/~/fromTsvToRows),
  [`fromTsvToLazyRows()`](https://jsr.io/@j50n/proc/doc/transforms/~/fromTsvToLazyRows):
  parse TSV.
- [`toTsv()`](https://jsr.io/@j50n/proc/doc/transforms/~/toTsv): write TSV;
  throws on a tab, CR, or LF in a field.
- [`fromJsonToRows(options)`](https://jsr.io/@j50n/proc/doc/transforms/~/fromJsonToRows):
  parse JSON lines into batches of values, optionally checked by a schema.
- [`toJson()`](https://jsr.io/@j50n/proc/doc/transforms/~/toJson): write one
  value per item as JSON lines; throws a `TypeError` on an item with no JSON
  form.
- [`JsonOptions`](https://jsr.io/@j50n/proc/doc/transforms/~/JsonOptions):
  `schema` and `sampleSize`.
- [`ZodSchema`](https://jsr.io/@j50n/proc/doc/transforms/~/ZodSchema): anything
  with a `parse(value)` method, a Zod schema included.
- [`fromRecordToRows()`](https://jsr.io/@j50n/proc/doc/transforms/~/fromRecordToRows),
  [`fromRecordToLazyRows()`](https://jsr.io/@j50n/proc/doc/transforms/~/fromRecordToLazyRows):
  parse the record format.
- [`toRecord()`](https://jsr.io/@j50n/proc/doc/transforms/~/toRecord): write the
  record format, for handing rows to another program.
- [`FIELD_SEPARATOR`](https://jsr.io/@j50n/proc/doc/transforms/~/FIELD_SEPARATOR),
  [`RECORD_SEPARATOR`](https://jsr.io/@j50n/proc/doc/transforms/~/RECORD_SEPARATOR):
  `"\x1F"` and `"\x1E"`, the record format's separators.
- [`Row`](https://jsr.io/@j50n/proc/doc/transforms/~/Row): one row, a
  `string[]`.
- [`LazyRow`](https://jsr.io/@j50n/proc/doc/transforms/~/LazyRow): a row that
  decodes fields on demand: `getField(i)`, `fieldEquals(i, value)`,
  `columnCount`, `toStringArray()`, and `LazyRow.fromStringArray(fields)` to
  make one.
- [`BATCH_SIZE_BYTES`](https://jsr.io/@j50n/proc/doc/transforms/~/BATCH_SIZE_BYTES):
  about 128 KiB, how much input makes a batch.

The package also has a command-line converter, `jsr:@j50n/proc/flatdata`; see
[The flatdata CLI](../data/flatdata.md).
