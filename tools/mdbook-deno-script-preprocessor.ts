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
      "--no-cache",
      "Do not cache. Rerun scripts on any build.",
    )
    .option(
      "--cache-duration <duration:number>",
      "Cache duration (in hours). May be fractional.",
      { default: 24.0 },
    )
    .action(async ({ concurrently, cache, cacheDuration }) => {
      const [context, book]: [Context, Book] = JSON.parse(
        (await enumerate(Deno.stdin.readable).transform(toLines).collect())
          .join("\n"),
      );

      await enumerate(book.sections.filter((it) => isChapter(it)) as Chapter[])
        .concurrentUnorderedMap(async (chapter) => {
          if (chapter.Chapter.content.indexOf("<script>") >= 0) {
            const hash = await digestMessage(chapter.Chapter.content);
            const key = [context.root, chapter.Chapter.path];

            const kv = await Deno.openKv();
            try {
              const now = new Date().getTime();
              const hour = 60 * 60 * 1000;

              const cachedContent = (await kv.get(key)).value as
                | CacheEntry
                | null;

              if (
                cache && cachedContent?.hash === hash &&
                now - cachedContent?.timestamp.getTime() < cacheDuration * hour
              ) {
                console.error(
                  blue(
                    `cached [from ${cachedContent.timestamp.toISOString()}]: ${
                      JSON.stringify(key)
                    }`,
                  ),
                );
                chapter.Chapter.content = cachedContent.content;
              } else {
                console.error(cyan(`generated: ${JSON.stringify(key)}`));
                const postContent = await parseChapter(context, chapter);
                kv.set(key, {
                  timestamp: new Date(),
                  hash,
                  content: postContent,
                });
                chapter.Chapter.content = postContent;
              }
            } finally {
              kv.close();
            }
          }
        }, { concurrency: concurrently ? undefined : 1 }).forEach((_) => {});

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
      } else {
        console.error(JSON.stringify(module));
        throw new EvalError(`module requires default export [line: ${line()}]`);
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
