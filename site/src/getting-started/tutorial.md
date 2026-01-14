# Tutorial: Building a Git Analyzer

In this tutorial, you'll build a command-line tool that analyzes a git repository's commit history. Along the way, you'll learn proc's core features by using them to solve a real problem.

By the end, you'll have a working script that:
- Lists recent commits
- Finds bug fixes
- Counts commits by author
- Identifies the most active day of the week
- Handles errors gracefully

The final script is about 40 lines of code.

## Prerequisites

- Deno installed
- A git repository to analyze (this tutorial works on any repo)
- Basic TypeScript knowledge

## What We're Building

Here's what the finished analyzer outputs:

```
=== Git Repository Analysis ===

Recent commits: 25
Bug fixes found: 7

Top contributors:
  alice: 12 commits
  bob: 8 commits
  carol: 5 commits

Most active day: Tuesday (8 commits)
```

Let's build it step by step.

## Step 1: Getting Commits

Create a file called `git-analyzer.ts`. We'll start by fetching the last 100 commits:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: get commits" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// Get the last 100 commits (one line each)
const commits = await run("git", "log", "--oneline", "-100")
  .lines
  .collect();

console.log(`Found ${commits.length} commits`);
console.log("First commit:", commits[0]);
```

Run it:

```bash
deno run --allow-run git-analyzer.ts
```

**What's happening:**
- `run()` executes the git command
- `.lines` converts the byte output to text lines
- `.collect()` gathers all lines into an array

Try changing `-100` to `-10` to see fewer commits.

## Step 2: Filtering for Bug Fixes

Now let's find commits that mention "fix" — likely bug fixes:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: filter fixes" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const fixes = await run("git", "log", "--oneline", "-100")
  .lines
  .filter(line => line.toLowerCase().includes("fix"))
  .collect();

console.log(`Found ${fixes.length} bug fixes:`);
for (const fix of fixes.slice(0, 5)) {
  console.log(`  ${fix}`);
}
```

**What's happening:**
- `.filter()` keeps only lines containing "fix"
- We use `.slice(0, 5)` to show just the first 5 matches

The filtering happens as data streams through — we never load all 100 commits into memory just to filter them.

## Step 3: Counting Commits by Author

Let's see who's contributing the most. We'll parse the commit log to extract author names:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: count by author" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// Get author of each commit
const authorCounts = await run("git", "log", "--format=%an", "-100")
  .lines
  .filter(name => name.trim() !== "")
  .reduce((counts, name) => {
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

// Sort by count and take top 5
const topAuthors = Object.entries(authorCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

console.log("Top contributors:");
for (const [name, count] of topAuthors) {
  console.log(`  ${name}: ${count} commits`);
}
```

**What's happening:**
- `--format=%an` outputs just the author name for each commit
- `.reduce()` accumulates counts into an object
- We sort and slice to get the top 5

## Step 4: Finding the Most Active Day

Which day of the week sees the most commits? We'll parse commit dates and count them:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: active day" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Get commit dates
const dayCounts = await run("git", "log", "--format=%ad", "--date=format:%u", "-100")
  .lines
  .filter(line => line.trim() !== "")
  .reduce((counts, dayNum) => {
    const day = days[parseInt(dayNum) % 7];
    counts[day] = (counts[day] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

// Find the busiest day
const busiest = Object.entries(dayCounts)
  .sort((a, b) => b[1] - a[1])[0];

console.log(`Most active day: ${busiest[0]} (${busiest[1]} commits)`);
```

**What's happening:**
- `--format=%ad --date=format:%u` outputs just the day of week (1-7)
- `.reduce()` accumulates counts into an object
- We sort to find the maximum

## Step 5: Handling Errors

What happens if someone runs this outside a git repository? Let's handle that gracefully:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: error handling" -->
```typescript
import { run, ExitCodeError } from "jsr:@j50n/proc@{{gitv}}";

try {
  const commits = await run("git", "rev-parse", "--git-dir")
    .lines
    .collect();
  
  console.log("This is a git repository");
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.error("Error: Not a git repository");
    console.error("Please run this command from within a git repository.");
    Deno.exit(1);
  }
  throw error;
}
```

**What's happening:**
- `git rev-parse --git-dir` fails with exit code 128 if not in a repo
- proc throws `ExitCodeError` for non-zero exit codes
- We catch it and show a friendly message

## Step 6: The Complete Script

Now let's put it all together into a polished tool:

<!-- TESTED: tests/tutorial.test.ts - "tutorial: complete script" -->
```typescript
import { run, ExitCodeError } from "jsr:@j50n/proc@{{gitv}}";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const fixes = commits.filter(c => c.toLowerCase().includes("fix"));

  // Get top authors
  const authorCounts = await run("git", "log", "--format=%an", `-${commitCount}`)
    .lines
    .filter(name => name.trim() !== "")
    .reduce((counts, name) => {
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

  const authors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Count by day of week
  const dayCounts = await run("git", "log", "--format=%ad", "--date=format:%u", `-${commitCount}`)
    .lines
    .filter(line => line.trim() !== "")
    .reduce((counts, dayNum) => {
      const day = days[parseInt(dayNum) % 7];
      counts[day] = (counts[day] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

  const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

  return { commits, fixes, authors, busiestDay };
}

// Run the analysis
try {
  const result = await analyzeRepo(100);

  console.log("=== Git Repository Analysis ===\n");
  console.log(`Recent commits: ${result.commits.length}`);
  console.log(`Bug fixes found: ${result.fixes.length}`);
  console.log("\nTop contributors:");
  for (const author of result.authors) {
    console.log(`  ${author.name}: ${author.count} commits`);
  }
  console.log(`\nMost active day: ${result.busiestDay[0]} (${result.busiestDay[1]} commits)`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  Deno.exit(1);
}
```

Run the complete analyzer:

```bash
deno run --allow-run git-analyzer.ts
```

## What You've Learned

In building this tool, you've used proc's core features:

| Feature | How We Used It |
|---------|----------------|
| `run()` | Execute git commands |
| `.lines` | Convert output to text |
| `.collect()` | Gather results into arrays |
| `.filter()` | Find bug fixes, remove empty lines |
| `.reduce()` | Count commits by author and day |
| `ExitCodeError` | Handle "not a repo" error |

All of this with streaming — even if you analyzed 10,000 commits, memory usage stays constant.

## Exercises

Try extending the analyzer:

1. **Add a date range filter** — Only analyze commits from the last month
2. **Find the longest commit message** — Use `.reduce()` to track the max
3. **Export to JSON** — Output results as JSON for other tools
4. **Add file change stats** — Use `git log --stat` to count files changed

## See Also

- [Running Processes](../core/running-processes.md) — More ways to run commands
- [Error Handling](../core/error-handling.md) — Deep dive into error propagation
- [Array-Like Methods](../iterables/array-methods.md) — All the methods you can use
- [Recipes](../recipes/counting-words.md) — More practical examples
