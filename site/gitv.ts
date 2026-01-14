#!/usr/bin/env -S deno run --allow-run --allow-read

/**
 * Convert `@{{gitv}}` in the book content to the latest `git` tag, like `@0.24.1`.
 */

import { run, toLines } from "../mod.ts";
import { enumerate } from "../src/enumerable.ts";

interface Chapter {
  Chapter: {
    content: string;
    sub_items?: unknown[];
  };
}

function isChapter(obj: unknown): obj is Chapter {
  return obj != null && typeof obj === "object" && "Chapter" in obj &&
    obj.Chapter != null;
}

type Section = Chapter | { PartTitle: string } | "Separator";

interface Book {
  sections?: Section[];
  items?: Section[];
}

interface Context {
  root: string;
}

function extractChapters(items: unknown[] | undefined): Chapter[] {
  return (items ?? [])
    .filter(isChapter)
    .flatMap(
      (item) => [item, ...extractChapters(item.Chapter.sub_items)],
    );
}

if (Deno.args[0] === "supports") {
  Deno.exit(0);
} else {
  const [_context, book]: [Context, Book] = JSON.parse(
    (await enumerate(Deno.stdin.readable).transform(toLines).collect())
      .join("\n"),
  );

  const gitv = (await run("git", "describe", "--tags").lines.first)
    .split("-")[0];

  const sections = book.sections || book.items || [];
  const chapters = extractChapters(sections);

  for (const chapter of chapters) {
    chapter.Chapter.content = chapter.Chapter.content.replaceAll(
      "@{{gitv}}",
      `@${gitv}`,
    );
  }

  console.log(JSON.stringify(book));
}
