# Enumerable and its methods

An `Enumerable` is an async sequence with the methods you know from arrays.
`run()`, `read()`, and `range()` return one, and `enumerate()` wraps anything
else you can iterate: an array, a Set, a generator, a `ReadableStream`.

```typescript
{{#include ../../examples/iterables/chain.ts}}
```

```text
{{#include ../../examples/iterables/chain.out}}
```

Each step returns a new `Enumerable`, and the consumer at the end (`reduce`
here) pulls the items through and returns a promise. Callbacks may be async;
each call is awaited before the next one starts. To run several at once, use
[`concurrentMap`](./concurrency.md). [Key ideas](../start/key-ideas.md) covers
how sources, steps, and consumers fit together.

## `enumerate()` is not `.enum()`

```typescript
{{#include ../../examples/iterables/enumerate-vs-enum.ts}}
```

```text
{{#include ../../examples/iterables/enumerate-vs-enum.out}}
```

`enumerate(iterable)` is a function: it wraps an iterable so you can call the
methods on it, and leaves the items alone. `.enum()` is a method on an
`Enumerable`: it numbers the items, turning each into `[item, index]` from 0.
Python's `enumerate` is proc's `.enum()`.

## The methods

Change items:

| Member                                                                                                            | What it does                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`map(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.map)                                             | Replace each item with `fn(item)`, one call at a time.            |
| [`enum()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.enum)                                             | Number the items: each becomes `[item, index]`.                   |
| [`concurrentMap(fn, opts)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concurrentMap)                   | `map` with several calls at once; results in input order.         |
| [`concurrentUnorderedMap(fn, opts)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concurrentUnorderedMap) | `map` with several calls at once; results as they finish.         |
| [`transform(step)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.transform)                               | Pass the whole sequence through a generator or `TransformStream`. |

Filter:

| Member                                                                            | What it does                           |
| --------------------------------------------------------------------------------- | -------------------------------------- |
| [`filter(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.filter)       | Keep the items for which `fn` is true. |
| [`filterNot(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.filterNot) | Drop the items for which `fn` is true. |

Slice:

| Member                                                                 | What it does                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| [`take(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.take) | The first `n` items (default 1); then close the source. |
| [`drop(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.drop) | Skip the first `n` items (default 1).                   |

Combine:

| Member                                                                         | What it does                                               |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [`concat(other)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.concat) | These items, then `other`'s.                               |
| [`zip(other)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.zip)       | Pairs `[mine, other's]`, ending with the shorter sequence. |
| [`flatten()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.flatten)    | Replace each item, itself iterable, with its items.        |
| [`flatMap(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.flatMap)  | `map`, then `flatten`.                                     |

Split:

| Member                                                                  | What it does                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`tee(n)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.tee)    | `n` Enumerables (default 2), each with every item.          |
| [`unzip()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.unzip) | Pairs `[a, b]` into two Enumerables, the `a`s and the `b`s. |

Consume (each returns a promise):

| Member                                                                            | What it does                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`collect()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.collect)       | Every item, in an array. `toArray()` is the same.               |
| [`forEach(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.forEach)     | Call `fn` on each item.                                         |
| [`reduce(fn, zero)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.reduce) | Fold into one value, as `Array.prototype.reduce` does.          |
| [`count(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.count)         | How many items, or how many for which `fn` is true.             |
| [`first`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.first)             | The first item. A getter; throws `RangeError` if there is none. |
| [`find(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.find)           | The first item for which `fn` is true, or `undefined`.          |
| [`some(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.some)           | Whether `fn` is true for any item; stops at the first.          |
| [`every(fn)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.every)         | Whether `fn` is true for all items; stops at the first false.   |

A `for await` loop is a consumer too.

Text, processes, and output:

| Member                                                                                      | What it does                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`lines`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.lines)                       | Bytes decoded as UTF-8 lines of text. A getter.                 |
| [`chunkedLines`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.chunkedLines)         | The same lines in arrays, one per chunk read; faster. A getter. |
| [`run(...cmd)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.run)                   | Pipe the items into a command's stdin; yields its stdout.       |
| [`writeTo(path)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.writeTo)             | Write bytes to a file, or items to a `WritableStream`.          |
| [`writeBytesTo(writer)`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.writeBytesTo) | Write bytes to a `Writer & Closer`, such as a `Deno.FsFile`.    |
| [`toStdout()`](https://jsr.io/@j50n/proc/doc/~/Enumerable.prototype.toStdout)               | Write lines or bytes to stdout.                                 |

The output of `run()` also has
[`pid`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable.prototype.pid) and
[`status`](https://jsr.io/@j50n/proc/doc/~/ProcessEnumerable.prototype.status);
see [Running a command](../processes/running.md). Files and stdout are in
[Files and standard streams](./files.md).

## Steps to pass to `transform()`

| Function                                                                                                                   | What it does                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`toBytes`](https://jsr.io/@j50n/proc/doc/~/toBytes)                                                                       | Lines of text (or bytes) into byte chunks, a `"\n"` after each line. |
| [`toLines`](https://jsr.io/@j50n/proc/doc/~/toLines)                                                                       | Bytes into lines; what `.lines` uses.                                |
| [`toChunkedLines`](https://jsr.io/@j50n/proc/doc/~/toChunkedLines)                                                         | Bytes into arrays of lines; what `.chunkedLines` uses.               |
| [`toByteLines`](https://jsr.io/@j50n/proc/doc/~/toByteLines)                                                               | Bytes split into lines without decoding, in arrays.                  |
| [`buffer(size)`](https://jsr.io/@j50n/proc/doc/~/buffer)                                                                   | Join small byte chunks into chunks of at least `size` bytes.         |
| [`gzip`](https://jsr.io/@j50n/proc/doc/~/gzip), [`gunzip`](https://jsr.io/@j50n/proc/doc/~/gunzip)                         | Compress or decompress; take lines or bytes.                         |
| [`jsonStringify`](https://jsr.io/@j50n/proc/doc/~/jsonStringify), [`jsonParse`](https://jsr.io/@j50n/proc/doc/~/jsonParse) | One JSON value per string, each way.                                 |
| [`debug`](https://jsr.io/@j50n/proc/doc/~/debug)                                                                           | Print each item as it passes, unchanged.                             |

The data formats (`fromCsvToRows()`, `toTsv()`, ...) are steps too, from
`@j50n/proc/transforms`; see [Data formats](../data/overview.md). To write your
own, see [Writing your own steps](./custom-steps.md).

## More examples

```typescript
{{#include ../../examples/iterables/slice-combine.ts}}
```

```text
{{#include ../../examples/iterables/slice-combine.out}}
```

`concat` and `zip` take an async iterable, so wrap an array in `enumerate()`
first; the types refuse a plain array.

```typescript
{{#include ../../examples/iterables/consume.ts}}
```

```text
{{#include ../../examples/iterables/consume.out}}
```

`numbers()` makes a new `Enumerable` for each line because each one can be read
only once. `find`, `some`, `every`, and `first` stop reading as soon as they
have their answer, and close the source.

```typescript
{{#include ../../examples/iterables/tee.ts}}
```

```text
{{#include ../../examples/iterables/tee.out}}
```

## Traps

- **An `Enumerable` is read once.** A second `collect()` gets nothing, without
  an error. Keep the array from the first, or `tee()` the sequence.
- **`tee()` and `unzip()` hold items in memory** until every branch has read
  them. If one branch races ahead of another, everything in between is kept. If
  the source throws, only the branch whose read hit the error throws.
- **`first` throws on an empty sequence** (`RangeError`), and `reduce` with no
  starting value throws `TypeError`. `find` returns `undefined` instead.
- **`flatten()` on strings gives characters**, because a string is iterable.
- **`lines` and `chunkedLines` are getters**: `.lines`, not `.lines()`. Only an
  `Enumerable` of bytes has them; on anything else the type is `never`.
