# Documentation Guidelines

## Who reads these docs

Two readers, and the docs have to work for both:

- **A developer who just found proc.** In a minute they should know what it is
  for, and in five they should have it working in their project.
- **An LLM helping someone use proc.** It reads the JSR page, the doc comments,
  and the book, often only part of them, and then writes code. It learns the
  library's idioms only from what we wrote, so a claim that is false or vague
  turns straight into broken code in someone's project.

Everything below follows from those two readers.

## What makes a page or a comment good

**It says what the thing is for before how it works.** Lead with the purpose and
when to reach for it. A reader who knows why a function exists can work out most
of the details; a reader with only the details misuses it.

**It is true, and checked.** The code is the arbiter. Before writing a claim
about behavior, read the code, and when the code doesn't settle it, run a probe.
Vague phrases ("handles errors properly", "manages resources automatically")
hide whether a claim is true; say what actually happens ("throws `ExitCodeError`
after the last line of output").

**It names the traps.** Where people go wrong is the most useful thing to write
down: what happens if they skip a step, and what they see when they do. "If you
don't read stdout, a child that writes more than the pipe holds blocks forever,
and your program hangs" is worth more than "always consume output."

**It is short.** Say a thing once, in the place a reader would look for it, and
link to it from elsewhere. No preambles, no summaries of what was just said, no
"Key points" lists that repeat the prose.

**It sounds like a person who knows the library.** Plain, direct, specific. No
marketing ("superpowers", "blazing", "seamless"), no emoji, no comparisons with
Node streams or other libraries unless a reader needs one to choose.

## Doc comments

Doc comments are the API reference: they appear in `deno doc`, on the JSR pages,
and in editors, and an LLM often sees nothing else.

- The first sentence says what it does, in plain words. It is the summary shown
  in lists, so it stands alone.
- Then, where it applies: why you would use it, what to watch for, and how it
  fails (what it throws, and when).
- Name parameters and return values with `@param` and `@returns` when the
  signature doesn't already make them obvious. Don't restate the type.
- One or two `@example` blocks, each minimal and complete: it imports what it
  uses from `@j50n/proc` (or `@j50n/proc/transforms`) and type-checks.
- History, design derivations, and benchmarks don't go in comments. Put them in
  the book if they matter.
- Internal and private members get a short comment only where the code doesn't
  explain itself.

`src/shutdown.ts` is a good model.

## The book

The book (`site/src`) is for learning the library and for the topics that cross
many functions: pipelines, errors, shutdown, data formats. It doesn't repeat the
API reference; it links to it.

- Each page answers one question a reader has ("How do I pipe one command into
  another?"), and its title says which.
- Examples come first and carry the explanation. Prose fills in what the code
  can't show.
- Code that runs lives in `site/examples/` as a file, and the page pulls it in
  with `\{{#include ../../examples/name.ts}}`. `tests/book_examples.test.ts`
  checks and runs every file there, so an example can't drift from the code.
- A fragment that can't stand alone (a deliberate mistake, a sketch) is marked
  as such in the prose.

## The README and `mod.ts`

`mod.ts`'s module comment is the JSR landing page. It and the README say the
same short thing: what proc is for, a handful of examples, the few concepts
everyone needs, and a link to the book. Keep them in step.

## Checking your work

```sh
deno check --doc-only mod.ts src/   # every doc comment example type-checks
deno test -A tests/book_examples.test.ts   # every book example runs
```
