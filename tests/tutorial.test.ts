/**
 * Tests for the Git Analyzer tutorial examples.
 *
 * These tests verify that all code examples in the tutorial work correctly.
 * Run with: deno test --allow-run tests/tutorial.test.ts
 */

import { assertEquals, assertExists, assertGreater } from "@std/assert";
import { ExitCodeError, run } from "../mod.ts";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

Deno.test("tutorial: get commits", async () => {
  const commits = await run("git", "log", "--oneline", "-100")
    .lines
    .collect();

  assertGreater(commits.length, 0, "Should find at least one commit");
  assertExists(commits[0], "First commit should exist");
});

Deno.test("tutorial: filter fixes", async () => {
  const fixes = await run("git", "log", "--oneline", "-100")
    .lines
    .filter((line) => line.toLowerCase().includes("fix"))
    .collect();

  // We just verify it runs without error - may or may not find fixes
  assertEquals(Array.isArray(fixes), true);
});

Deno.test("tutorial: count by author", async () => {
  const authorCounts = await run("git", "log", "--format=%an", "-100")
    .lines
    .filter((name) => name.trim() !== "")
    .reduce((counts, name) => {
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  assertGreater(topAuthors.length, 0, "Should find at least one author");
  const [name, count] = topAuthors[0]!;
  assertExists(name, "Author should have a name");
  assertGreater(count, 0, "Author should have commits");
});

Deno.test("tutorial: active day", async () => {
  const dayCounts = await run(
    "git",
    "log",
    "--format=%ad",
    "--date=format:%u",
    "-100",
  )
    .lines
    .filter((line) => line.trim() !== "")
    .reduce((counts, dayNum) => {
      const day = days[parseInt(dayNum) % 7];
      counts[day] = (counts[day] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

  const busiest = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])[0];

  assertExists(busiest, "Should find a busiest day");
  assertExists(busiest[0], "Day should have a name");
  assertGreater(busiest[1], 0, "Day should have commits");
});

Deno.test("tutorial: error handling", async () => {
  // This test verifies the pattern works - we're in a git repo so it should succeed
  try {
    const result = await run("git", "rev-parse", "--git-dir")
      .lines
      .collect();

    assertGreater(result.length, 0, "Should return git dir");
  } catch (error) {
    if (error instanceof ExitCodeError) {
      // This is fine - means we're not in a git repo (unlikely in this test)
    } else {
      throw error;
    }
  }
});

Deno.test("tutorial: complete script", async () => {
  async function analyzeRepo(commitCount = 100) {
    // Verify we're in a git repo
    try {
      await run("git", "rev-parse", "--git-dir").lines.collect();
    } catch (error) {
      if (error instanceof ExitCodeError) {
        throw new Error("Not a git repository");
      }
      throw error;
    }

    // Get commits
    const commits = await run("git", "log", "--oneline", `-${commitCount}`)
      .lines
      .collect();

    // Count bug fixes
    const fixes = commits.filter((c) => c.toLowerCase().includes("fix"));

    // Get top authors
    const authorCounts = await run(
      "git",
      "log",
      "--format=%an",
      `-${commitCount}`,
    )
      .lines
      .filter((name) => name.trim() !== "")
      .reduce((counts, name) => {
        counts[name] = (counts[name] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

    const authors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Count by day of week
    const dayCounts = await run(
      "git",
      "log",
      "--format=%ad",
      "--date=format:%u",
      `-${commitCount}`,
    )
      .lines
      .filter((line) => line.trim() !== "")
      .reduce((counts, dayNum) => {
        const day = days[parseInt(dayNum) % 7];
        counts[day] = (counts[day] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

    const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

    return { commits, fixes, authors, busiestDay };
  }

  const result = await analyzeRepo(50);

  assertGreater(result.commits.length, 0, "Should have commits");
  assertEquals(Array.isArray(result.fixes), true, "Fixes should be array");
  assertGreater(result.authors.length, 0, "Should have authors");
  assertExists(result.busiestDay, "Should have busiest day");
});
