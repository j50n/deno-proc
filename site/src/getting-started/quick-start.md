# Quick Start

Let's get you running code in 5 minutes.

## Your First Process

Create a file called `hello.ts`:

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: basic run and capture" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

// Run a command and capture output
const lines = await run("echo", "Hello, proc!").lines.collect();
console.log(lines); // ["Hello, proc!"]
```

Run it:

```bash
deno run --allow-run hello.ts
```

**What just happened?**
- `run()` started the `echo` command
- `.lines` converted the output to text lines
- `.collect()` gathered all lines into an array

## Chaining Processes

Let's chain commands together, like shell pipes:

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: chain processes" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const result = await run("echo", "HELLO WORLD")
  .run("tr", "A-Z", "a-z")  // Convert to lowercase
  .lines.first;

console.log(result); // "hello world"
```

Each `.run()` pipes the previous output to the next command's input.

## Working with Files

Process a file line by line:

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: process file" -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const errorCount = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .count();

console.log(`Found ${errorCount} errors`);
```

## Handling Errors

Errors propagate naturally—catch them once at the end:

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: handle errors" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

try {
  await run("false")  // This command exits with code 1
    .lines
    .collect();
} catch (error) {
  console.error(`Command failed: ${error.code}`);
}
```

No need to check errors at each step. They flow through the pipeline and you catch them once. For details, see [Error Handling](../core/error-handling.md).

## Using Array Methods

Work with async data using familiar Array methods:

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: enumerate with indices" -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const data = ["apple", "banana", "cherry"];

const numbered = await enumerate(data)
  .enum()  // Add indices
  .map(([fruit, i]) => `${i + 1}. ${fruit}`)
  .collect();

console.log(numbered);
// ["1. apple", "2. banana", "3. cherry"]
```

## A Real Example

Let's find the 5 most recent commits that mention "fix":

<!-- TESTED: tests/mdbook_examples.test.ts - "quick-start: git log example" -->
```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";

const commits = await run("git", "log", "--oneline")
  .lines
  .filter(line => line.includes("fix"))
  .take(5)
  .collect();

commits.forEach(commit => console.log(commit));
```

This chains multiple operations, all streaming, using minimal memory. For more complex examples, see [Recipes](../recipes/counting-words.md).

## What's Next?

Now that you've got the basics, learn about:

- [Key Concepts](./key-concepts.md) - Properties vs methods, resource management
- [Error Handling](../core/error-handling.md) - The killer feature explained
- [Running Processes](../core/running-processes.md) - All the ways to run commands

Or jump straight to [Recipes](../recipes/counting-words.md) for copy-paste solutions.
