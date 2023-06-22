# Working with Text Data

Streaming data doesn't have to be line-delimited text, but it probably will be
most of the time. Many *nix tools work with this type of data or some variation
of it.

Line-delimited text data is simply:

- `utf-8` encoded bytes
- logically separated into lines with `\n` or alternately `\r\n` (Windows style)
  characters

Here is how you process text data in `proc`.

## `UTF-8` Lines

This is the "normal" way to work with line-delimited text. It should be a good
solution most of the time.

The
[lines](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=ProcessEnumerable#accessor_lines)
method converts a line at a time.

```typescript
await run("ls", "-la")
  .lines
  .forEach((it) => console.log(it));
```

Alternately you can use
[transform](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable#method_transform_0)
with the [toLines](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=toLines)
transformer function.

```typescript
await read(resolve("./warandpeace.txt.gz"))
  .transform(toLines)
  .forEach((it) => console.log(it));
```

The
[Enumerable.run](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable#method_run_0)
method will automatically treat `string` values as lines, adding `\n` to them
and converting back into `utf-8` encoded bytes.

Note that this _always_ assumes string data passed to it is line-delimited. If
that isn't the case (you may be working with buffered text data that is not
delimited at all, for example), you **must** convert text data back to
`Uint8Array` yourself or `\n` characters will be added.

## Traditional Text and Lines

Deno provides a native
[TextDecoderStream](https://deno.land/api?s=TextDecoderStream) to bulk-convert
`Uint8Array` data into text. The boundaries are arbitrary. The characters will
always be correct, but this can break within a word or within a
control-character sequence. `TextDecoderStream` supports many standard character
encodings.

To parse this data into lines, Deno provides
[TextLineStream](https://deno.land/std/streams/mod.ts?s=TextLineStream). This
splits the data into lines on `\n` and optionally `\r`.

These are meant to be used together to convert to text then split into lines.

The traditional stream implementation is a little slower than the
`utf-8`-specialized transformers, but they support different character encodings
and allow some flexibility in defining the split.

```typescript
await read(resolve("./warandpeace.txt.gz"))
  .transform(gunzip)
  .transform(new TextDecoderStream())
  .transform(new TextLineStream())
  .map((line) => line.toLowerCase())
  .forEach((line) => console.log(line));
```

Note that most of the library assumes strings and arrays of strings represent
line data. For text that is not divided on lines, you can use
[TextEncoderStream](https://deno.land/api?s=TextEncoderStream) to convert back
to `utf-8` bytes. Note that unlike `TextDecoderStream` this does not support
multiple encodings. This is in line with the official specification.

## Not All Text Data is Text Data

There are many command-line utilities that use ANSI color and position
sequences, as well as raw carriage-returns (`\r`) to enhance the user experience
at the console. The codes are normally interpreted by the terminal, but if you
dump them to file, you can see they make a mess. You've probably seen this in
log files before.

This type of streamed text data can't be strictly interpreted as lines. You may
be able to hack around the fluff. Use
[stripColor](https://deno.land/std/fmt/colors.ts?doc=&s=stripColor) (Deno `std`
library) to remove ANSI escape codes from strings. If the utility is using raw
`\r`, you may have to deal with that as well.

The best solution is to turn off color and progress for command-line utilities
you use for processing. This is not always possible (Debian `apt` is a famous
example of this).

Reference the [ANSI escape code](https://en.wikipedia.org/wiki/ANSI_escape_code)
wiki page.

You can _always_ get around this problem by never attempting to split on lines.

```typescript
await run("apt", "install", "build-essential")
  .writeTo(Deno.stdout.writable, { noclose: true });
```
