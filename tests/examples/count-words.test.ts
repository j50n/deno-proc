import { TextLineStream } from "../deps/streams.ts";
import { fromFileUrl } from "../deps/path.ts";
import { assertEquals } from "../deps/asserts.ts";
import { ProcReadableStream } from "../../mod.ts";

class ToLowerCaseStream extends TransformStream<string, string> {
  constructor(options?: { lineOrientedText?: boolean }) {
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController,
      ) => {
        controller.enqueue(
          `${chunk.toLocaleLowerCase()}${
            options?.lineOrientedText ? "\n" : ""
          }`,
        );
      },
    });
  }
}

async function countWords(stream: ReadableStream<Uint8Array>) {
  let count = 0;
  for await (
    const _ of stream.pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
  ) {
    count++;
  }
  return count;
}

/**
 * This doesn't appear to be a horrible way to do things. Nitpicks are boilerplate
 * `{ stdin: "piped", stdout: "piped" }` and call to `.spawn()`, along with
 * separate call to link `stdout` to `stdin` of next process. At first glance,
 * much better than the old `Deno.run` API.
 *
 * Does the following:
 *
 *   - read file `warandpeace.txt.gz` (out of copyright, so legal)
 *   - decompress it using Deno stream decompression (not external call to `gunzip`)
 *   - split into words using a simple `grep` recipe
 *   - convert to lower-case using `.toLocaleLowerCase()` (not the bash `tr` version)
 *   - in tee stream 1:
 *       - sort alphabetically
 *       - uniq to collapse to unique words
 *       - count the words (unique words)
 *   - in tee stream 2:
 *       - count the words (total words)
 */
Deno.test({
  name: "I can count the words in a file, longhand version.",
  async fn() {
    const wapFile = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
      { read: true },
    );

    const grepWords = new Deno.Command("grep", {
      args: ["-o", "-E", "(\\w|')+"],
      stdin: "piped",
      stdout: "piped",
    }).spawn();

    wapFile.readable
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeTo(grepWords.stdin);

    /*
     * Tee here. Using one stream for unique words and the other for total.
     */
    const [words1, words2] = grepWords.stdout
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new ToLowerCaseStream())
      .pipeThrough(new TextEncoderStream()).tee();

    const sort = new Deno.Command("sort", { stdin: "piped", stdout: "piped" })
      .spawn();
    words1.pipeTo(sort.stdin);

    const uniq = new Deno.Command("uniq", { stdin: "piped", stdout: "piped" })
      .spawn();
    sort.stdout.pipeTo(uniq.stdin);

    const [uniqCount, totalCount] = await Promise.all([
      countWords(uniq.stdout),
      countWords(words2),
    ]);

    console.log(
      `War and Peace contains ${uniqCount.toLocaleString()} unique words.`,
    );
    console.log(`There are ${totalCount.toLocaleString()} total words.`);
    console.log("Counts include proper names.");

    assertEquals(uniqCount, 17_557, "The number of unique words is correct.");
    assertEquals(totalCount, 572_642, "The total number words is correct.");
  },
});

Deno.test({
  name: "I can count the words in a file, short version.",
  async fn() {
    const wapFile = await Deno.open(
      fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
      { read: true },
    );

    const wapStream = new ProcReadableStream(wapFile.readable);

    const [words1, words2] = wapStream
      .pipeThrough(new DecompressionStream("gzip"))
      .spawn("grep", { args: ["-o", "-E", "(\\w|')+"] })
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new ToLowerCaseStream())
      .pipeThrough(new TextEncoderStream()).tee();

    const [uniqCount, totalCount] = await Promise.all([
      countWords(words1.spawn("sort").spawn("uniq").stdout),
      countWords(words2),
    ]);

    console.log(
      `War and Peace contains ${uniqCount.toLocaleString()} unique words.`,
    );
    console.log(`There are ${totalCount.toLocaleString()} total words.`);
    console.log("Counts include proper names.");

    assertEquals(uniqCount, 17_557, "The number of unique words is correct.");
    assertEquals(totalCount, 572_642, "The total number words is correct.");
  },
});
