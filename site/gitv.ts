#!/usr/bin/env -S deno run --allow-run --allow-read

/**
 * Convert `{{gitv}}` in the book content to the latest `git` tag, like `0.20.17`.
 *
 * My very first `mdbook` plugin.
 */

import { run, toLines } from "../mod3.ts";
import { enumerate } from "../src/enumerable.ts";

type Section = {
  Chapter: {
    content: string;
  };
};

function isSection(obj: unknown): obj is Section {
  return obj != null && typeof obj === "object" && "Chapter" in obj &&
    obj.Chapter != null;
}

type CONTEXT = unknown;
type BOOK = {
  sections: Section[];
};
type Input = [CONTEXT, BOOK];

if (Deno.args[0] === "supports") {
  Deno.exit(0);
} else {
  const [_context, book]: Input = JSON.parse(
    (await enumerate(Deno.stdin.readable).transform(toLines).collect())
      .join("\n"),
  );

  const gitv = (await run("git", "describe", "--tags").lines.first)
    .split("-")[0];

  // deno eval --quiet 'import { run } from "https://deno.land/x/proc/mod3.ts"; console.log(JSON.stringify({ version: (await run("git", "describe", "--tags").lines.first).split("-")[0] }));'

  for (const section of book.sections) {
    if (isSection(section)) {
      section.Chapter.content = section.Chapter.content.replaceAll(
        "{{gitv}}",
        gitv,
      );
    }
  }

  console.log(JSON.stringify(book));
}
