# Coding standards

The code should read like it was written by someone who cared, and the public
API should be predictable enough that a reader, or an LLM, guesses right about a
method it hasn't seen. These are the conventions that make that so.

## Tooling

- `deno fmt`, `deno lint`, and `deno check` pass on everything, with Deno's
  default rules. That includes no `any`; use `unknown` and narrow.
- Dependencies in `deno.json` are pinned to exact versions, so nothing moves
  until someone runs `deno update --latest` on purpose (`build.sh` does).
- Every doc comment example type-checks: `deno check --doc-only mod.ts src/`.
  How to write doc comments is in
  [Documentation guidelines](./documentation.md).

## Names and files

- Files in `src/` are kebab-case (`writable-iterable.ts`); tests end in
  `.test.ts`.
- Classes are PascalCase (`ProcessEnumerable`), functions and variables
  camelCase (`concurrentMap`), constants SCREAMING_SNAKE_CASE (`HOURS`,
  `FIELD_SEPARATOR`).
- A name says what the thing is or does. `enumerate()` wraps an iterable;
  `.enum()` numbers its items. Two names that close need the doc comments to
  point at each other, as those do.

## The shape of the public API

**Options come first.** `run({ cwd }, "ls")`, `.run({ fnStderr }, "grep", "x")`.
The command and its arguments are the rest parameters, each argument its own
string, with no shell parsing.

**A member that names a value is a getter; one that does something is a
method.** `.lines`, `.chunkedLines`, `.first`, `.status`, and `.pid` take no
parentheses; `collect()`, `map()`, and `count()` do. Add a getter only for
something with no arguments that reads as a noun, and say "A getter" in its doc
comment, because `.first()` is the most common mistake people make with the
library.

**Steps are lazy, consumers return promises.** A method that returns an
`Enumerable` does nothing until something pulls; a method that returns a promise
is a consumer. `.run()` is the documented exception, because it starts a
process. Keep it the only one.

**Wrong calls fail to type-check.** Members that only work on some item types
use conditional types that resolve to `never` otherwise (`Lines<T>`,
`Run<S, T>`, `ByteSink<T>`), so `.lines` on numbers is a compile error, not a
run-time surprise.

**Errors arrive at the consumer, after the data.** A failure throws from the
`await` that consumes the pipeline, after every item before it has been
delivered. Process failures are subclasses of `ProcessError`. When one error
leads to another, set `cause`; never swallow an error, and let an error from a
user's callback arrive unchanged where possible.

**Strings are lines.** Where text becomes bytes (`toBytes`, `toStdout()`, a
process's stdin), each string gets a `"\n"`; bytes pass as they are. So code
using the library shouldn't append `"\n"` to strings (the output gets blank
lines) or call `toBytes` before `toStdout()` (it does that itself).

**Transformers plug into `.transform()`.** A transformer is a function from one
async iterable to another. Ones with no configuration are passed as they are
(`.transform(toBytes)`, `.transform(gunzip)`); ones with configuration are
factories that return one (`buffer(size)`). In `@j50n/proc/transforms`, every
parser and writer is a factory, with or without options (`fromTsvToRows()`,
`toCsv({ crlf: true })`), so they all read the same way.

**Say what happens, not what we wish.** If something holds memory, doesn't wait,
or skips a check, the doc comment says so (`tee` buffers,
`WritableIterable.write()` doesn't wait, stopping early skips the exit-code
check). A design that is simpler but has a cost is fine; a hidden cost is not.

## Inside the code

- **Don't leave a promise unobserved.** When the code starts work now and awaits
  it later, wrap the promise in `handled()` from `src/helpers.ts`, or a
  rejection in between becomes an unhandled-rejection crash.
- **Close what you open on every path.** Iterators get `return()` when a
  consumer stops early; generator `finally` blocks are where files, writers, and
  stdin get closed. A test for early stopping goes with any new source.
- **Comments say why.** History and benchmarks belong in the book or a commit
  message. Internal helpers get a short comment only where the code doesn't
  speak for itself.

## Tests and examples

- A new feature comes with tests named for the claim they prove ("take(n) ends
  after the nth item, without waiting for another."), and a bug fix with a test
  in `tests/regressions/` that failed before the fix.
- Example data uses placeholders, never real names, addresses, or keys.

See [Testing](./testing.md) for where tests go and how the book's examples are
checked.
