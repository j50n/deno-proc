#!/usr/bin/env -S deno --unstable run

import { enumerate, isString, toLines } from "./deps/proc.ts";
import { bestTypeNameOf } from "./deps/proc-hidden.ts";
import { resolve, toFileUrl } from "./deps/path.ts";
import { toHashString } from "./deps/crypto.ts";
import { blue, cyan, red } from "./deps/colors.ts";
import { Command } from "./deps/cliffy.ts";
import config from "../version.json" assert { type: "json" };

interface Chapter {
  Chapter: {
    name: string;
    content: string;
    path: string;
    number: number[];
    sub_items?: unknown[];
  };
}

interface Context {
  root: string;
}

function isChapter(obj: unknown): obj is Chapter {
  return obj != null && typeof obj === "object" && "Chapter" in obj &&
    obj.Chapter != null;
}

type Section = Chapter | { PartTitle: string } | "Separator";

interface Book {
  sections: Section[];
}

interface CacheEntry {
  timestamp: Date;
  hash: string;
  content: string;
}

async function digestMessage(message: string) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return toHashString(hash, "hex");
}

if (Deno.args.length >= 2 && Deno.args[Deno.args.length - 2] === "supports") {
  const kind = Deno.args[Deno.args.length - 1];
  if (kind === "html") {
    Deno.exit(0);
  } else {
    console.error(red(`generator type not supported: '${kind}'`));
    Deno.exit(1);
  }
} else {
  await new Command()
    .name("mdbook-deno-script-preprocessor")
    .description("Generate markdown with scripts.")
    .version(config.version)
    .command("clear-cache")
    .description("Clear cached chapters/data.")
    .action(async () => {
      const kv = await Deno.openKv();

      try {
        for await (const { key } of kv.list({ prefix: [] })) {
          console.error(cyan(`removing cache entry: ${key}`));
          kv.delete(key);
        }
      } finally {
        kv.close();
      }
    })
    .command("process")
    .description(
      `Act as a preprocessor for ${cyan("mdbook")}. This is run from ${
        cyan("book.toml")
      }.`,
    )
    .usage("[options]")
    .option(
      "--concurrently",
      "Execute chapters concurrently.",
    )
    .option(
      "--cache-timeout <timeout:number>",
      "Cache timeout (in seconds). May be fractional.",
      { default: 10 },
    )
    .action(async ({ concurrently, cacheTimeout }) => {
      const SECOND = 1000;

      const [context, book]: [Context, Book] = JSON.parse(
        (await enumerate(Deno.stdin.readable).transform(toLines).collect())
          .join("\n"),
      );

      /*
       * Used to allow forcing regeneration of the newest chapter. Sometimes we
       * can't tell where the file change came from, so it is a good bet that the
       * last active chapter worked on would be the target of the change. Not
       * perfect, but better than nothing.
       */
      let maxTimestamp = Number.MIN_SAFE_INTEGER;

      type ChapterCalc = {
        chapter: Chapter;
        key: string[];
        hash: string;
        cachedContent: CacheEntry | null;
      };

      function extractChapters(items: unknown[] | undefined): Chapter[] {
        return (items ?? [])
          .filter(isChapter)
          .flatMap(
            (item) => [item, ...extractChapters(item.Chapter.sub_items)],
          );
      }

      const chapters = await enumerate(extractChapters(book.sections))
        .concurrentUnorderedMap(async (chapter) => {
          if (chapter.Chapter.content.indexOf("<script>") >= 0) {
            const hash = await digestMessage(
              JSON.stringify({
                content: chapter.Chapter.content,
                name: chapter.Chapter.name,
                number: chapter.Chapter.number,
              }),
            );
            const key = [context.root, chapter.Chapter.path];

            const kv = await Deno.openKv();
            try {
              const cachedContent = (await kv.get(key)).value as
                | CacheEntry
                | null;

              if (
                cachedContent != null &&
                cachedContent.timestamp.getTime() > maxTimestamp
              ) {
                maxTimestamp = cachedContent.timestamp.getTime();
              }

              const now = new Date().getTime();

              const useCache = cachedContent?.hash === hash &&
                now - cachedContent?.timestamp.getTime() < cacheTimeout * SECOND;

              return {
                chapter,
                key,
                hash,
                cachedContent: useCache ? cachedContent : null,
              };
            } finally {
              kv.close();
            }
          }
        }).filterNot((it) => it == null).collect() as ChapterCalc[];

      await enumerate(chapters)
        .concurrentUnorderedMap(
          async ({ chapter, key, hash, cachedContent }) => {
            if (/*forceUpdate ||*/ cachedContent == null) {
              const kv = await Deno.openKv();
              try {
                console.error(
                  `${cyan(`generated: ${JSON.stringify(key)}`)}`,
                );

                const postContent = await parseChapter(context, chapter);
                kv.set(key, {
                  timestamp: new Date(),
                  hash,
                  content: postContent,
                });
                chapter.Chapter.content = postContent;
              } finally {
                kv.close();
              }
            } else {
              console.error(
                blue(
                  `cached [from ${cachedContent.timestamp.toISOString()}]: ${
                    JSON.stringify(key)
                  }`,
                ),
              );

              chapter.Chapter.content = cachedContent.content;
            }
          },
          { concurrency: concurrently ? undefined : 1 },
        ).forEach((_) => {});

      console.log(JSON.stringify(book));
    }).parse();
}

async function parseChapter(
  context: Context,
  chapter: Chapter,
): Promise<string> {
  const OPEN_TAG = "<script>";
  const CLOSE_TAG = "</script>";

  const content = chapter.Chapter.content;

  const chapterContext = (() => {
    const path = resolve(context.root);
    return { path: (p: string) => toFileUrl(resolve(path, p)) };
  })();

  const chunks: string[] = [];

  let pos = 0;
  for (;;) {
    const start = content.indexOf(OPEN_TAG, pos);

    if (start === -1) {
      chunks.push(content.substring(pos));
      break;
    }

    chunks.push(content.substring(pos, start));

    const line = () => content.substring(0, start).split("\n").length;

    const end = content.indexOf(CLOSE_TAG, start);

    if (end === -1) {
      throw new SyntaxError(`missing closing script tag [line: ${line()}]`);
    }

    const script = content.substring(start + OPEN_TAG.length, end);
    try {
      const module = await import(
        "data:application/javascript," + encodeURIComponent(script)
      );

      if ("default" in module && typeof module.default === "function") {
        const result = await module.default(chapterContext);

        if (isString(result)) {
          chunks.push(result);
        } else if (result != null) {
          throw new TypeError(
            `expected string but got ${
              bestTypeNameOf(result)
            } [line: ${line()}]`,
          );
        }
      }
    } catch (e) {
      chunks.push(
        `

---
⚠️ **Error**

\`\`\`javascript
${script}
\`\`\`

<pre><code style="white-space: pre-wrap !important;">
${
          e.toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
        }
</code></pre>

---

`,
      );
    }

    pos = end + CLOSE_TAG.length;
  }

  return chunks.join("");
}
