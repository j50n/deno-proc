# Installation

Getting started with proc is simple—it's just a Deno import away.

## Import from JSR

Add proc to your Deno project:

<!-- NOT TESTED: Illustrative example -->
```typescript
import * as proc from "jsr:@j50n/proc@{{gitv}}";
```

Or import just what you need:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run, enumerate, read } from "jsr:@j50n/proc@{{gitv}}";
```

That's it! No installation step, no package.json, no node_modules.

## Permissions

proc needs permissions to run child processes and access files. When you run your script, Deno will prompt you, or you can grant them upfront:

```bash
deno run --allow-run --allow-read your-script.ts
```

**Common permissions:**
- `--allow-run` - Required to run child processes
- `--allow-read` - Needed to read files
- `--allow-write` - Needed to write files
- `--allow-env` - If your processes need environment variables

You can be more specific:

```bash
# Only allow running specific commands
deno run --allow-run=ls,grep,wc your-script.ts

# Only allow reading specific directories
deno run --allow-read=/var/log your-script.ts
```

## Version Pinning

For production, pin to a specific version:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc@1.0.0";
```

For development, use the latest:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run } from "jsr:@j50n/proc";
```

## Next Steps

Ready to write your first proc script? Head to the [Quick Start](./quick-start.md) guide.
