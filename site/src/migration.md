# Migration Guide

Migrating from other tools to proc.

## From Deno.Command

**Before:**

```typescript
const command = new Deno.Command("ls", { args: ["-la"] });
const output = await command.output();
const text = new TextDecoder().decode(output.stdout);
```

**After:**

```typescript
import { run } from "jsr:@j50n/proc@{{gitv}}";
const lines = await run("ls", "-la").lines.collect();
```

## From Shell Scripts

See [Shell Script Replacement](./recipes/shell-replacement.md) for detailed
examples.

## Key Differences

- Properties vs methods: `.lines` not `.lines()`
- Always consume output to avoid leaks
- Errors propagate through pipelines
- Use `enumerate()` then `.enum()` for indices

## See Also

- [Getting Started](./getting-started/installation.md) - Installation
- [Key Concepts](./getting-started/key-concepts.md) - Important concepts
- [FAQ](./faq.md) - Common questions
