#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run=git

/**
 * Write `llms.txt` and `llms-full.txt` for the book, following
 * https://llmstxt.org: an index of the pages with links, and the whole book as
 * one Markdown file, examples and their output included. LLMs read these more
 * reliably than they crawl HTML.
 *
 * Both are built from `SUMMARY.md` and the pages it lists, so they say what
 * the book says.
 *
 *     deno run --allow-read --allow-write --allow-run=git tools/llms-txt.ts site/src docs
 */

import { dirname, join } from "@std/path";

const SITE = "https://j50n.github.io/deno-proc/";
const [src, out] = Deno.args;
if (src == null || out == null) {
  console.error("usage: llms-txt.ts <book src dir> <output dir>");
  Deno.exit(2);
}

const version = new TextDecoder().decode(
  (await new Deno.Command("git", { args: ["describe", "--tags", "--abbrev=0"] })
    .output())
    .stdout,
).trim();

interface Page {
  title: string;
  path: string;
}
interface Section {
  title: string;
  pages: Page[];
}

/** The book's parts and pages, in order, from `SUMMARY.md`. */
function readSummary(text: string): Section[] {
  const sections: Section[] = [{ title: "", pages: [] }];
  for (const line of text.split("\n")) {
    const heading = line.match(/^# (.+)$/);
    const link = line.match(/^\s*-?\s*\[(.+)\]\(\.?\/?(.+\.md)\)/);
    if (heading && heading[1] !== "Summary") {
      sections.push({ title: heading[1], pages: [] });
    } else if (link) {
      sections.at(-1)!.pages.push({ title: link[1], path: link[2] });
    }
  }
  return sections.filter((section) => section.pages.length > 0);
}

/** A page's Markdown with `{{#include}}` and `{{gitv}}` filled in. */
async function expand(path: string): Promise<string> {
  const text = await Deno.readTextFile(join(src, path));
  let result = text.replaceAll("{{gitv}}", version);
  // mdBook leaves `\{{#include ...}}` alone apart from the backslash.
  const includes = /(\\?)\{\{#include (.+?)\}\}/g;
  for (const [directive, escaped, file] of text.matchAll(includes)) {
    const included = escaped
      ? directive.slice(1)
      : (await Deno.readTextFile(join(src, dirname(path), file))).trimEnd();
    result = result.replace(directive, () => included);
  }
  return result;
}

const url = (path: string) => SITE + path.replace(/\.md$/, ".html");

const sections = readSummary(await Deno.readTextFile(join(src, "SUMMARY.md")));
const intro = await expand(sections[0].pages[0].path);
const pitch = intro.split("\n\n")[1].replaceAll("\n", " ");

const index = [
  `# proc`,
  ``,
  `> ${pitch}`,
  ``,
  `Deno library, version ${version}, on JSR as \`@j50n/proc\` ` +
  `(\`deno add jsr:@j50n/proc\`). Data transforms are a separate entry ` +
  `point, \`@j50n/proc/transforms\`. Read "Key ideas" first: it covers how ` +
  `every part behaves and the traps.`,
  ``,
  `- [The whole book as one file](${SITE}llms-full.txt)`,
  `- [API reference on JSR](https://jsr.io/@j50n/proc/doc)`,
];
for (const section of sections) {
  index.push("", `## ${section.title || "Introduction"}`, "");
  for (const page of section.pages) {
    index.push(`- [${page.title}](${url(page.path)})`);
  }
}

const full: string[] = [];
for (const section of sections) {
  for (const page of section.pages) {
    full.push(
      `<!-- ${url(page.path)} -->`,
      "",
      (await expand(page.path)).trimEnd(),
      "",
    );
  }
}

await Deno.writeTextFile(join(out, "llms.txt"), index.join("\n") + "\n");
await Deno.writeTextFile(join(out, "llms-full.txt"), full.join("\n"));
