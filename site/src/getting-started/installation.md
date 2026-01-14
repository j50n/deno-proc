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

## Data Transforms (Optional)

The data transforms module is **separate from the core library** to keep the main import lightweight. Import it when you need CSV, TSV, JSON, or Record format conversions:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Core library - process management and async iterables
import { run, enumerate, read } from "jsr:@j50n/proc@{{gitv}}";

// Data transforms - CSV, TSV, JSON, Record conversions
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";
```

**Why separate?**
- **Smaller bundles**: Users who only need process management don't import transform code
- **Clear separation**: Core library vs specialized data format conversions
- **Optional feature**: Transforms are powerful but not required for basic usage

See the [Data Transforms](../data-transforms/README.md) guide for details.

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
