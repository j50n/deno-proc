# Counting words

The task: the ten most common words in _War and Peace_, read from a gzipped copy
(1.1 MB compressed, 3.2 MB of text). First with the classic shell pipeline, run
through proc:

```typescript
{{#include ../../examples/recipes/word-count-shell.ts}}
```

```text
{{#include ../../examples/recipes/word-count-shell.out}}
```

`read()` gives the file's bytes, `DecompressionStream` unzips them, and each
`.run()` is one `|`. The commands run at the same time, as they do in a shell,
and proc hands each one's output to the next as bytes, without decoding it.
`.take(10)` does the job of `head`: once it has ten lines it closes the
pipeline, the last `sort` dies of SIGPIPE on its next write, and that is not an
error ([stopping early](../start/key-ideas.md#4-stopping-early-is-fine)). If
`tr` or `sort` failed, the `await` would throw.

Arguments go to each program as they are, with no shell in between, so `"\n"` is
a real newline character and nothing needs quoting.

## The same in TypeScript

```typescript
{{#include ../../examples/recipes/word-count-js.ts}}
```

```text
{{#include ../../examples/recipes/word-count-js.out}}
```

Same answer, no child processes, and no `--allow-run`. `flatMap` turns each line
into its words, and `forEach` counts them into a `Map`. The callback has braces
because `forEach` wants a function that returns nothing, and `counts.set()`
returns the map, which fails the type check.

## Making it faster

Every step in a pipeline costs an `await` per item, and this book has about
580,000 words. Handling lines in arrays, with plain loops inside, cuts that to
one `await` per chunk of input:

```typescript
{{#include ../../examples/recipes/word-count-fast.ts}}
```

```text
{{#include ../../examples/recipes/word-count-fast.out}}
```

Measured on one laptop, this ran two to three times faster than the `flatMap`
version, and faster than the shell pipeline. That one spends most of its time in
`sort`, comparing by the rules of your locale;
`run({ env: { LC_ALL: "C" } },
"sort")` compares bytes instead and was about
four times faster. Reach for `.chunkedLines` when a pipeline does very little
per item and there are a great many items; for most scripts, `.lines` is fast
enough.

## Getting the words right

The shell version has a flaw that is easy to miss. `tr` works on bytes, so every
letter outside A-Z is a word break:

```typescript
{{#include ../../examples/recipes/word-count-unicode.ts}}
```

```text
{{#include ../../examples/recipes/word-count-unicode.out}}
```

The book is full of names like Rostóv and Bolkónski, and the shell pipeline
counts their pieces as words. A regular expression with `\p{L}` (any letter,
with the `u` flag) gets them right; swap it into either TypeScript version. This
is the usual reason to move a text pipeline from the shell into code: not speed,
but control over what counts as a word.

## Variations

- **A plain file**: drop the `.transform(...)` line.
- **Many files**: run the count for each with
  [`concurrentMap`](../iterables/concurrency.md) and add up the maps.
- **Total words only**: `.flatMap(...).count()`.
- **A file too big for memory**: the pipeline streams, but the `Map` holds every
  distinct word. For a word count that is small; for distinct values from a huge
  log it may not be, and the shell's `sort` (which spills to disk) is the better
  tool.
