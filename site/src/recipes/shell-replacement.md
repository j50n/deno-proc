# Shell Script Replacement

Replace Bash scripts with type-safe Deno.

## Why Replace Shell Scripts?

**Shell scripts are:**
- Hard to debug
- No type safety
- Limited error handling
- Platform-specific

**proc gives you:**
- Full TypeScript
- IDE support
- Proper error handling
- Cross-platform

## Common Patterns

### File Operations

**Bash:**
```bash
#!/bin/bash
for file in *.txt; do
  wc -l "$file"
done
```

**proc:**
<!-- NOT TESTED: Illustrative example -->
```typescript
#!/usr/bin/env -S deno run --allow-read --allow-run
import { run } from "jsr:@j50n/proc@{{gitv}}";

for await (const entry of Deno.readDir(".")) {
  if (entry.name.endsWith(".txt")) {
    const count = await run("wc", "-l", entry.name).lines.first;
    console.log(count);
  }
}
```

### Process Logs

**Bash:**
```bash
#!/bin/bash
grep ERROR app.log | wc -l
```

**proc:**
<!-- NOT TESTED: Illustrative example -->
```typescript
#!/usr/bin/env -S deno run --allow-read --allow-run
import { read } from "jsr:@j50n/proc@{{gitv}}";

const errors = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .count();

console.log(`${errors} errors`);
```

### Backup Script

**Bash:**
```bash
#!/bin/bash
tar -czf backup-$(date +%Y%m%d).tar.gz /data
```

**proc:**
<!-- NOT TESTED: Illustrative example -->
```typescript
#!/usr/bin/env -S deno run --allow-read --allow-run
import { run } from "jsr:@j50n/proc@{{gitv}}";

const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
await run("tar", "-czf", `backup-${date}.tar.gz`, "/data").toStdout();
```

### System Monitoring

**Bash:**
```bash
#!/bin/bash
while true; do
  df -h | grep /dev/sda1
  sleep 60
done
```

**proc:**
<!-- NOT TESTED: Illustrative example -->
```typescript
#!/usr/bin/env -S deno run --allow-run
import { run, sleep } from "jsr:@j50n/proc@{{gitv}}";

while (true) {
  const usage = await run("df", "-h")
    .lines
    .find(line => line.includes("/dev/sda1"));
  
  console.log(usage);
  await sleep(60000);  // sleep() is exported from proc
}
```

## Real Script Example

Complete deployment script:

<!-- NOT TESTED: Illustrative example -->
```typescript
#!/usr/bin/env -S deno run --allow-all
import { run } from "jsr:@j50n/proc@{{gitv}}";

console.log("🚀 Deploying application...");

try {
  // Pull latest code
  console.log("📥 Pulling latest code...");
  await run("git", "pull").toStdout();
  
  // Install dependencies
  console.log("📦 Installing dependencies...");
  await run("npm", "install").toStdout();
  
  // Run tests
  console.log("🧪 Running tests...");
  await run("npm", "test").toStdout();
  
  // Build
  console.log("🔨 Building...");
  await run("npm", "run", "build").toStdout();
  
  // Restart service
  console.log("🔄 Restarting service...");
  await run("systemctl", "restart", "myapp").toStdout();
  
  console.log("✅ Deployment complete!");
} catch (error) {
  console.error("❌ Deployment failed:", error.message);
  Deno.exit(1);
}
```

## Benefits

1. **Type Safety** - Catch errors before running
2. **IDE Support** - Autocomplete and refactoring
3. **Error Handling** - Proper try-catch
4. **Debugging** - Use debugger, breakpoints
5. **Testing** - Write unit tests
6. **Portability** - Works on any platform with Deno

## Making Scripts Executable

```bash
chmod +x script.ts
./script.ts
```

## Next Steps

- [Running Processes](../core/running-processes.md) - Process basics
- [Error Handling](../core/error-handling.md) - Handle failures
- [Process Pipelines](../core/pipelines.md) - Chain commands
