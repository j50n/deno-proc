#!/usr/bin/env -S deno run 

import { isString, toLines } from "../mod3.ts";
import { enumerate } from "../src/enumerable.ts";
import { bestTypeNameOf } from "../src/helpers.ts";
import { resolve, toFileUrl } from "./deps/path.ts";
import { red } from "../legacy/deps-test.ts";
import { toHashString } from "./deps/crypto.ts";

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

export function isChapter(obj: unknown): obj is Chapter {
  return obj != null && typeof obj === "object" && "Chapter" in obj &&
    obj.Chapter != null;
}

type Section = Chapter | { PartTitle: string } | "Separator";

interface Book {
  sections: Section[];
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
  const [context, book]: [Context, Book] = JSON.parse(
    (await enumerate(Deno.stdin.readable).transform(toLines).collect())
      .join("\n"),
  );

  for (
    const chapter of book.sections.filter((it) => isChapter(it)) as Chapter[]
  ) {
    chapter.Chapter.content = await parseChapter(context, chapter);
  }

  console.log(JSON.stringify(book));
}

async function parseChapter(
  context: Context,
  chapter: Chapter,
): Promise<string> {
  const OPEN_TAG = "<script>";
  const CLOSE_TAG = "</script>";

  const content = chapter.Chapter.content;

  async function digestMessage(message: string) {
    const data = new TextEncoder().encode(message);
    const hash = await crypto.subtle.digest("SHA-1", data);
    return toHashString(hash, "hex");
  }

  console.error(JSON.stringify(await digestMessage(content)));

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

    const module = await import(
      "data:application/javascript," + encodeURIComponent(script)
    );

    if ("default" in module && typeof module.default === "function") {
      const result = await module.default(chapterContext);

      if (isString(result)) {
        chunks.push(result);
      } else if (result != null) {
        throw new TypeError(
          `expected string but got ${bestTypeNameOf(result)} [line: ${line()}]`,
        );
      }
    } else {
      console.error(JSON.stringify(module));
      throw new EvalError(`module requires default export [line: ${line()}]`);
    }

    pos = end + CLOSE_TAG.length;
  }

  return chunks.join("");
}
