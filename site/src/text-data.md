# Working with Text Data

## `UTF-8` Lines

Blah.

## `UTF-8` Chunked Lines

Blah.

Mention as string and as Uint8Array, since this is much faster.

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

`proc` provides a transformer wrapper around `TextDecoderStream` with
[textDecoder](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=textDecoder) and
around `TextLineStream` with
[textLine](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=textLine).

These transformers are a little slower than the `utf-8`-specialized
transformers, but support different character encodings and allow some
flexibility in splitting lines.

**Example**

```typescript
await read(resolve("./warandpeace.txt.gz"))
  .transform(gunzip)
  .transform(textDecoder())
  .transform(textLine())
  .map((line) => line.toLowerCase())
  .forEach((line) => console.log(line));
```

Note that most of the library assumes strings and arrays of strings represent line data. 
You can use [textEncoder](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=textEncoder) to convert
text chunks to `utf-8` encoded bytes correctly, assuming the data is not line-delimited.

## Something Something Positional \r Etc.

Not all processes that output text produce text that can be trivially be parsed
into lines.

apt

Reference Wiki for ANSI codes.
